'use client';

import type React from 'react';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import {
  BarChart3,
  Check,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  Volume2,
  Waves,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type WaveformEditorProps = {
  file: File;
  initialTrimStart?: number;
  initialTrimEnd?: number | null;
  onSave: (trimStart: number, trimEnd: number | null) => void;
  onCancel: () => void;
};

// Pre-computed color lookup table for spectrogram (256 colors)
const SPECTROGRAM_LUT = (() => {
  const lut = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    const t = (i / 255) ** 0.8; // Gamma correction
    let r: number, g: number, b: number;

    if (t < 0.2) {
      const s = t / 0.2;
      r = Math.floor(s * 40);
      g = 0;
      b = Math.floor(s * 60);
    } else if (t < 0.4) {
      const s = (t - 0.2) / 0.2;
      r = Math.floor(40 + s * 80);
      g = 0;
      b = Math.floor(60 + s * 100);
    } else if (t < 0.6) {
      const s = (t - 0.4) / 0.2;
      r = Math.floor(120 - s * 80);
      g = Math.floor(s * 180);
      b = Math.floor(160 + s * 40);
    } else if (t < 0.8) {
      const s = (t - 0.6) / 0.2;
      r = Math.floor(40 + s * 180);
      g = Math.floor(180 + s * 75);
      b = Math.floor(200 - s * 100);
    } else {
      const s = (t - 0.8) / 0.2;
      r = Math.floor(220 + s * 35);
      g = 255;
      b = Math.floor(100 + s * 155);
    }

    // Store as ABGR for little-endian ImageData
    lut[i] = (255 << 24) | (b << 16) | (g << 8) | r;
  }
  return lut;
})();

export function WaveformEditor({
  file,
  initialTrimStart = 0,
  initialTrimEnd = null,
  onSave,
  onCancel,
}: WaveformEditorProps) {
  const waveformCanvasRef = useRef<HTMLCanvasElement>(null);
  const spectrogramCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const animationRef = useRef<number | null>(null);
  const spectrogramWorkerRef = useRef<Worker | null>(null);
  const selectionCheckRef = useRef<number | null>(null);

  // Playback state reducer
  type PlaybackState = {
    isLoading: boolean;
    duration: number;
    currentTime: number;
    isPlaying: boolean;
    sampleRate: number;
  };

  type PlaybackAction =
    | { type: 'SET_LOADING'; payload: boolean }
    | {
        type: 'SET_AUDIO_LOADED';
        payload: { duration: number; sampleRate: number };
      }
    | { type: 'SET_CURRENT_TIME'; payload: number }
    | { type: 'SET_PLAYING'; payload: boolean };

  const playbackReducer = (
    state: PlaybackState,
    action: PlaybackAction,
  ): PlaybackState => {
    switch (action.type) {
      case 'SET_LOADING':
        return { ...state, isLoading: action.payload };
      case 'SET_AUDIO_LOADED':
        return {
          ...state,
          isLoading: false,
          duration: action.payload.duration,
          sampleRate: action.payload.sampleRate,
        };
      case 'SET_CURRENT_TIME':
        return { ...state, currentTime: action.payload };
      case 'SET_PLAYING':
        return { ...state, isPlaying: action.payload };
      default:
        return state;
    }
  };

  const [playbackState, dispatchPlayback] = useReducer(playbackReducer, {
    isLoading: true,
    duration: 0,
    currentTime: 0,
    isPlaying: false,
    sampleRate: 0,
  });

  const { isLoading, duration, currentTime, isPlaying, sampleRate } =
    playbackState;

  const [viewMode, setViewMode] = useState<'waveform' | 'spectrogram'>(
    'waveform',
  );
  const [trimStart, setTrimStart] = useState(initialTrimStart);
  const [trimEnd, setTrimEnd] = useState<number | null>(initialTrimEnd);
  const [zoom, setZoom] = useState(1);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [volume, setVolume] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isDragging, setIsDragging] = useState<
    'start' | 'end' | 'playhead' | null
  >(null);
  const [waveformPeaks, setWaveformPeaks] = useState<Float32Array | null>(null);
  const [spectrogramData, setSpectrogramData] = useState<{
    frames: Float32Array;
    numFrames: number;
    numBins: number;
  } | null>(null);
  const [isGeneratingSpectrogram, setIsGeneratingSpectrogram] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // Initialize spectrogram worker
  useEffect(() => {
    const workerCode = `
      function fft(real, imag) {
        const n = real.length;
        if (n <= 1) return;
        let j = 0;
        for (let i = 0; i < n - 1; i++) {
          if (i < j) {
            let t = real[i]; real[i] = real[j]; real[j] = t;
            t = imag[i]; imag[i] = imag[j]; imag[j] = t;
          }
          let k = n >> 1;
          while (k <= j) { j -= k; k >>= 1; }
          j += k;
        }
        for (let len = 2; len <= n; len <<= 1) {
          const halfLen = len >> 1;
          const angle = -2 * Math.PI / len;
          const wPrReal = Math.cos(angle), wPrImag = Math.sin(angle);
          for (let i = 0; i < n; i += len) {
            let wReal = 1, wImag = 0;
            for (let j = 0; j < halfLen; j++) {
              const e = i + j, o = e + halfLen;
              const tReal = wReal * real[o] - wImag * imag[o];
              const tImag = wReal * imag[o] + wImag * real[o];
              real[o] = real[e] - tReal; imag[o] = imag[e] - tImag;
              real[e] += tReal; imag[e] += tImag;
              const nw = wReal * wPrReal - wImag * wPrImag;
              wImag = wReal * wPrImag + wImag * wPrReal;
              wReal = nw;
            }
          }
        }
      }

      self.onmessage = (e) => {
        const { channelData, fftSize, targetFrames } = e.data;
        const hopSize = Math.max(256, Math.floor((channelData.length - fftSize) / targetFrames));
        const numFrames = Math.floor((channelData.length - fftSize) / hopSize);
        const numBins = fftSize / 2;
        
        const hannWindow = new Float32Array(fftSize);
        for (let i = 0; i < fftSize; i++) {
          hannWindow[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / fftSize));
        }
        
        const frames = new Float32Array(numFrames * numBins);
        const real = new Float32Array(fftSize);
        const imag = new Float32Array(fftSize);
        let maxMag = 0;
        
        for (let frame = 0; frame < numFrames; frame++) {
          const start = frame * hopSize;
          const offset = frame * numBins;
          for (let i = 0; i < fftSize; i++) {
            real[i] = (channelData[start + i] || 0) * hannWindow[i];
            imag[i] = 0;
          }
          fft(real, imag);
          for (let i = 0; i < numBins; i++) {
            const mag = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
            frames[offset + i] = mag;
            if (mag > maxMag) maxMag = mag;
          }
        }
        
        if (maxMag > 0) {
          const inv = 9 / maxMag;
          for (let i = 0; i < frames.length; i++) {
            frames[i] = Math.log10(1 + frames[i] * inv);
          }
        }
        
        self.postMessage({ frames, numFrames, numBins }, [frames.buffer]);
      };
    `;

    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));
    spectrogramWorkerRef.current = worker;

    return () => {
      worker.terminate();
      URL.revokeObjectURL(blob as unknown as string);
    };
  }, []);

  // Load audio
  useEffect(() => {
    const loadAudio = async () => {
      dispatchPlayback({ type: 'SET_LOADING', payload: true });

      try {
        const arrayBuffer = await file.arrayBuffer();
        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;

        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        audioBufferRef.current = audioBuffer;

        dispatchPlayback({
          type: 'SET_AUDIO_LOADED',
          payload: {
            duration: audioBuffer.duration,
            sampleRate: audioBuffer.sampleRate,
          },
        });
        setTrimEnd(initialTrimEnd ?? audioBuffer.duration);

        // Extract waveform peaks
        const channelData = audioBuffer.getChannelData(0);
        const samplesPerPixel = Math.max(
          1,
          Math.floor(channelData.length / 4000),
        );
        const peaks = new Float32Array(
          Math.ceil(channelData.length / samplesPerPixel),
        );

        for (let i = 0; i < peaks.length; i++) {
          let max = 0;
          const start = i * samplesPerPixel;
          const end = Math.min(start + samplesPerPixel, channelData.length);
          for (let j = start; j < end; j++) {
            const abs = Math.abs(channelData[j]);
            if (abs > max) max = abs;
          }
          peaks[i] = max;
        }
        setWaveformPeaks(peaks);

        // Create audio element
        const audio = new Audio();
        audio.src = URL.createObjectURL(file);
        audio.preload = 'auto';
        audioRef.current = audio;
        audio.addEventListener('ended', () =>
          dispatchPlayback({ type: 'SET_PLAYING', payload: false }),
        );
      } catch (error) {
        console.error('Failed to decode audio:', error);
        dispatchPlayback({ type: 'SET_LOADING', payload: false });
      }
    };

    loadAudio();

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [file, initialTrimEnd]);

  // Generate spectrogram using Web Worker
  useEffect(() => {
    if (
      viewMode !== 'spectrogram' ||
      !audioBufferRef.current ||
      spectrogramData
    )
      return;
    if (!spectrogramWorkerRef.current) return;

    setIsGeneratingSpectrogram(true);

    const worker = spectrogramWorkerRef.current;
    const channelData = audioBufferRef.current.getChannelData(0);
    const fftSize = 1024; // Smaller FFT for speed
    const audioDuration = audioBufferRef.current.duration;
    const targetFrames = Math.min(
      2000,
      Math.max(500, Math.floor(audioDuration * 50)),
    );

    worker.onmessage = (e) => {
      setSpectrogramData(e.data);
      setIsGeneratingSpectrogram(false);
    };

    worker.postMessage(
      { channelData, sampleRate, fftSize, targetFrames },
      { transfer: [] },
    );
  }, [viewMode, spectrogramData, sampleRate]);

  // Format time helper
  const formatTime = useMemo(
    () => (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      const ms = Math.floor((seconds % 1) * 1000);
      return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
    },
    [],
  );

  const formatTimeShort = useMemo(
    () => (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = (seconds % 60).toFixed(1);
      return `${mins}:${secs.padStart(4, '0')}`;
    },
    [],
  );

  // Draw waveform
  useLayoutEffect(() => {
    if (!waveformCanvasRef.current || !waveformPeaks || viewMode !== 'waveform')
      return;

    const canvas = waveformCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const centerY = height / 2;

    // Clear
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    // Calculate visible range
    const totalWidth = width * zoom;
    const visibleStart = scrollOffset / totalWidth;
    const visibleEnd = (scrollOffset + width) / totalWidth;

    const startPeak = Math.floor(visibleStart * waveformPeaks.length);
    const endPeak = Math.ceil(visibleEnd * waveformPeaks.length);
    const peaksToShow = endPeak - startPeak;
    const barWidth = Math.max(1, width / peaksToShow - 1);

    // Trim positions
    const trimStartX =
      ((trimStart / duration - visibleStart) / (visibleEnd - visibleStart)) *
      width;
    const trimEndX =
      (((trimEnd ?? duration) / duration - visibleStart) /
        (visibleEnd - visibleStart)) *
      width;

    // Dim areas outside trim
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, Math.max(0, trimStartX), height);
    ctx.fillRect(
      Math.min(width, trimEndX),
      0,
      width - Math.min(width, trimEndX),
      height,
    );

    // Trim region highlight
    ctx.fillStyle = 'rgba(34, 197, 94, 0.1)';
    ctx.fillRect(
      Math.max(0, trimStartX),
      0,
      Math.min(width, trimEndX) - Math.max(0, trimStartX),
      height,
    );

    // Draw waveform
    for (let i = 0; i < peaksToShow; i++) {
      const peakIndex = startPeak + i;
      if (peakIndex < 0 || peakIndex >= waveformPeaks.length) continue;

      const peak = waveformPeaks[peakIndex];
      const x = i * (width / peaksToShow);
      const barHeight = peak * (height - 20);

      const time = (peakIndex / waveformPeaks.length) * duration;
      ctx.fillStyle =
        time >= trimStart && time <= (trimEnd ?? duration)
          ? '#a3a3a3'
          : '#404040';
      ctx.fillRect(x, centerY - barHeight / 2, barWidth, barHeight);
    }

    // Trim handles
    const drawHandle = (x: number, isHovered: boolean) => {
      if (x < -20 || x > width + 20) return;
      ctx.fillStyle = isHovered ? '#4ade80' : '#22c55e';
      ctx.fillRect(x - 2, 0, 4, height);
      ctx.fillStyle = isHovered ? '#22c55e' : '#16a34a';
      ctx.beginPath();
      ctx.roundRect(x - 8, height / 2 - 24, 16, 48, 4);
      ctx.fill();
      // Grip lines
      ctx.strokeStyle = '#0a0a0a';
      ctx.lineWidth = 1;
      for (let i = -8; i <= 8; i += 4) {
        ctx.beginPath();
        ctx.moveTo(x - 4, height / 2 + i);
        ctx.lineTo(x + 4, height / 2 + i);
        ctx.stroke();
      }
    };

    drawHandle(trimStartX, isDragging === 'start');
    drawHandle(trimEndX, isDragging === 'end');

    // Playhead
    const playheadX =
      ((currentTime / duration - visibleStart) / (visibleEnd - visibleStart)) *
      width;
    if (playheadX >= 0 && playheadX <= width) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(playheadX - 1, 0, 2, height);
      ctx.beginPath();
      ctx.moveTo(playheadX - 8, 0);
      ctx.lineTo(playheadX + 8, 0);
      ctx.lineTo(playheadX, 12);
      ctx.closePath();
      ctx.fill();
    }

    // Time labels
    ctx.fillStyle = '#737373';
    ctx.font = '10px ui-monospace, monospace';
    const numLabels = Math.ceil(zoom * 5);
    for (let i = 0; i <= numLabels; i++) {
      const time =
        visibleStart * duration +
        (i / numLabels) * (visibleEnd - visibleStart) * duration;
      const x = (i / numLabels) * width;
      ctx.fillText(formatTimeShort(time), x, height - 4);
    }
  }, [
    waveformPeaks,
    viewMode,
    zoom,
    scrollOffset,
    trimStart,
    trimEnd,
    duration,
    currentTime,
    isDragging,
    formatTimeShort,
  ]);

  // Draw spectrogram using ImageData for performance
  useLayoutEffect(() => {
    if (
      !spectrogramCanvasRef.current ||
      !spectrogramData ||
      viewMode !== 'spectrogram'
    )
      return;

    const canvas = spectrogramCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = Math.floor(rect.width);
    const height = Math.floor(rect.height);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const { frames, numFrames, numBins } = spectrogramData;

    // Calculate visible range
    const totalWidth = width * zoom;
    const visibleStart = scrollOffset / totalWidth;
    const visibleEnd = (scrollOffset + width) / totalWidth;

    const startFrame = Math.floor(visibleStart * numFrames);
    const endFrame = Math.ceil(visibleEnd * numFrames);

    // Use ImageData for fast pixel manipulation
    const imageData = ctx.createImageData(width, height);
    const data = new Uint32Array(imageData.data.buffer);

    // Only show lower 40% of spectrum (~8kHz for 44.1kHz)
    const maxBin = Math.floor(numBins * 0.4);

    for (let x = 0; x < width; x++) {
      const frameIdx =
        startFrame + Math.floor((x / width) * (endFrame - startFrame));
      if (frameIdx < 0 || frameIdx >= numFrames) continue;

      const frameOffset = frameIdx * numBins;

      for (let y = 0; y < height; y++) {
        const binIdx = Math.floor(((height - 1 - y) / height) * maxBin);
        const value = frames[frameOffset + binIdx];
        const colorIdx = Math.min(255, Math.floor(value * 255));
        data[y * width + x] = SPECTROGRAM_LUT[colorIdx];
      }
    }

    ctx.putImageData(imageData, 0, 0);

    // Draw trim overlays
    const trimStartX =
      ((trimStart / duration - visibleStart) / (visibleEnd - visibleStart)) *
      width;
    const trimEndX =
      (((trimEnd ?? duration) / duration - visibleStart) /
        (visibleEnd - visibleStart)) *
      width;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, Math.max(0, trimStartX), height);
    ctx.fillRect(
      Math.min(width, trimEndX),
      0,
      width - Math.min(width, trimEndX),
      height,
    );

    // Trim handles
    ctx.fillStyle = '#22c55e';
    if (trimStartX >= 0 && trimStartX <= width) {
      ctx.fillRect(trimStartX - 2, 0, 4, height);
    }
    if (trimEndX >= 0 && trimEndX <= width) {
      ctx.fillRect(trimEndX - 2, 0, 4, height);
    }

    // Playhead
    const playheadX =
      ((currentTime / duration - visibleStart) / (visibleEnd - visibleStart)) *
      width;
    if (playheadX >= 0 && playheadX <= width) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(playheadX - 1, 0, 2, height);
    }

    // Frequency labels
    ctx.fillStyle = '#737373';
    ctx.font = '10px ui-monospace, monospace';
    const maxFreq = (sampleRate / 2) * 0.4;
    for (let i = 0; i <= 4; i++) {
      const freq = (i / 4) * maxFreq;
      const y = height - (i / 4) * height;
      const label =
        freq >= 1000 ? `${(freq / 1000).toFixed(1)}k` : `${Math.round(freq)}`;
      ctx.fillText(`${label} Hz`, 4, y - 2);
    }
  }, [
    spectrogramData,
    viewMode,
    zoom,
    scrollOffset,
    trimStart,
    trimEnd,
    duration,
    currentTime,
    sampleRate,
  ]);

  // Animation loop for playhead
  useEffect(() => {
    if (!isPlaying || !audioRef.current) return;

    const updateTime = () => {
      if (audioRef.current) {
        dispatchPlayback({
          type: 'SET_CURRENT_TIME',
          payload: audioRef.current.currentTime,
        });
      }
      animationRef.current = requestAnimationFrame(updateTime);
    };

    animationRef.current = requestAnimationFrame(updateTime);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying]);

  // Update audio properties
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      audioRef.current.playbackRate = playbackRate;
    }
  }, [volume, playbackRate]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isFocused) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture when typing in inputs
      if (e.target instanceof HTMLInputElement) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          if (!audioRef.current) return;
          if (audioRef.current.paused) {
            // Space plays selection, Shift+Space plays from cursor
            if (e.shiftKey) {
              // Play from current position
              audioRef.current.play();
              dispatchPlayback({ type: 'SET_PLAYING', payload: true });
            } else {
              // Play selection (default)
              audioRef.current.currentTime = trimStart;
              audioRef.current.play();
              dispatchPlayback({ type: 'SET_PLAYING', payload: true });

              // Stop at trim end
              const checkEnd = () => {
                if (
                  audioRef.current &&
                  audioRef.current.currentTime >= (trimEnd ?? duration)
                ) {
                  audioRef.current.pause();
                  audioRef.current.currentTime = trimStart;
                  dispatchPlayback({ type: 'SET_PLAYING', payload: false });
                  dispatchPlayback({
                    type: 'SET_CURRENT_TIME',
                    payload: trimStart,
                  });
                  selectionCheckRef.current = null;
                } else if (audioRef.current && !audioRef.current.paused) {
                  selectionCheckRef.current = requestAnimationFrame(checkEnd);
                }
              };
              selectionCheckRef.current = requestAnimationFrame(checkEnd);
            }
          } else {
            // Stop playback
            if (selectionCheckRef.current) {
              cancelAnimationFrame(selectionCheckRef.current);
              selectionCheckRef.current = null;
            }
            audioRef.current.pause();
            dispatchPlayback({ type: 'SET_PLAYING', payload: false });
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (audioRef.current) {
            const newTime = Math.max(0, currentTime - (e.shiftKey ? 1 : 0.1));
            audioRef.current.currentTime = newTime;
            dispatchPlayback({ type: 'SET_CURRENT_TIME', payload: newTime });
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (audioRef.current) {
            const newTime = Math.min(
              duration,
              currentTime + (e.shiftKey ? 1 : 0.1),
            );
            audioRef.current.currentTime = newTime;
            dispatchPlayback({ type: 'SET_CURRENT_TIME', payload: newTime });
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          setZoom((z) => Math.min(100, z * 1.2));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setZoom((z) => Math.max(1, z / 1.2));
          break;
        case 'Home':
          e.preventDefault();
          if (audioRef.current) {
            audioRef.current.currentTime = 0;
            dispatchPlayback({ type: 'SET_CURRENT_TIME', payload: 0 });
          }
          break;
        case 'End':
          e.preventDefault();
          if (audioRef.current) {
            audioRef.current.currentTime = duration;
            dispatchPlayback({ type: 'SET_CURRENT_TIME', payload: duration });
          }
          break;
        case 'i':
        case 'I':
          e.preventDefault();
          setTrimStart(currentTime);
          break;
        case 'o':
        case 'O':
          e.preventDefault();
          setTrimEnd(currentTime);
          break;
        case '[':
          e.preventDefault();
          if (audioRef.current) {
            audioRef.current.currentTime = trimStart;
            dispatchPlayback({ type: 'SET_CURRENT_TIME', payload: trimStart });
          }
          break;
        case ']':
          e.preventDefault();
          if (audioRef.current) {
            const end = trimEnd ?? duration;
            audioRef.current.currentTime = end;
            dispatchPlayback({ type: 'SET_CURRENT_TIME', payload: end });
          }
          break;
        case 'r':
        case 'R':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            setTrimStart(0);
            setTrimEnd(duration);
          }
          break;
        case '1':
          e.preventDefault();
          setViewMode('waveform');
          break;
        case '2':
          e.preventDefault();
          setViewMode('spectrogram');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFocused, currentTime, duration, trimStart, trimEnd]);

  const handlePlayPause = useCallback(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      if (selectionCheckRef.current) {
        cancelAnimationFrame(selectionCheckRef.current);
        selectionCheckRef.current = null;
      }
      audioRef.current.pause();
      dispatchPlayback({ type: 'SET_PLAYING', payload: false });
    } else {
      // Play selection by default
      audioRef.current.currentTime = trimStart;
      audioRef.current.play();
      dispatchPlayback({ type: 'SET_PLAYING', payload: true });

      const checkEnd = () => {
        if (
          audioRef.current &&
          audioRef.current.currentTime >= (trimEnd ?? duration)
        ) {
          audioRef.current.pause();
          audioRef.current.currentTime = trimStart;
          dispatchPlayback({ type: 'SET_PLAYING', payload: false });
          dispatchPlayback({ type: 'SET_CURRENT_TIME', payload: trimStart });
          selectionCheckRef.current = null;
        } else if (audioRef.current && !audioRef.current.paused) {
          selectionCheckRef.current = requestAnimationFrame(checkEnd);
        }
      };
      selectionCheckRef.current = requestAnimationFrame(checkEnd);
    }
  }, [isPlaying, trimStart, trimEnd, duration]);

  const handlePlayFromCursor = useCallback(() => {
    if (!audioRef.current) return;

    if (selectionCheckRef.current) {
      cancelAnimationFrame(selectionCheckRef.current);
      selectionCheckRef.current = null;
    }

    audioRef.current.play();
    dispatchPlayback({ type: 'SET_PLAYING', payload: true });
  }, []);

  const handleSeek = useCallback(
    (time: number) => {
      if (audioRef.current) {
        audioRef.current.currentTime = Math.max(0, Math.min(time, duration));
        dispatchPlayback({
          type: 'SET_CURRENT_TIME',
          payload: audioRef.current.currentTime,
        });
      }
    },
    [duration],
  );

  const getTimeFromX = useCallback(
    (canvas: HTMLCanvasElement, clientX: number) => {
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const width = rect.width;

      const totalWidth = width * zoom;
      const visibleStart = scrollOffset / totalWidth;
      const visibleEnd = (scrollOffset + width) / totalWidth;

      return (
        (visibleStart + (x / width) * (visibleEnd - visibleStart)) * duration
      );
    },
    [zoom, scrollOffset, duration],
  );

  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = e.currentTarget;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const width = rect.width;

      const totalWidth = width * zoom;
      const visibleStart = scrollOffset / totalWidth;
      const visibleEnd = (scrollOffset + width) / totalWidth;

      const trimStartX =
        ((trimStart / duration - visibleStart) / (visibleEnd - visibleStart)) *
        width;
      const trimEndX =
        (((trimEnd ?? duration) / duration - visibleStart) /
          (visibleEnd - visibleStart)) *
        width;

      // Check handles first (with generous hit area)
      if (Math.abs(x - trimStartX) < 15) {
        setIsDragging('start');
      } else if (Math.abs(x - trimEndX) < 15) {
        setIsDragging('end');
      } else {
        // Click to seek
        setIsDragging('playhead');
        handleSeek(getTimeFromX(canvas, e.clientX));
      }
    },
    [
      zoom,
      scrollOffset,
      trimStart,
      trimEnd,
      duration,
      handleSeek,
      getTimeFromX,
    ],
  );

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDragging) return;

      const time = getTimeFromX(e.currentTarget, e.clientX);

      if (isDragging === 'start') {
        setTrimStart(Math.max(0, Math.min(time, (trimEnd ?? duration) - 0.01)));
      } else if (isDragging === 'end') {
        setTrimEnd(Math.max(trimStart + 0.01, Math.min(time, duration)));
      } else if (isDragging === 'playhead') {
        handleSeek(time);
      }
    },
    [isDragging, getTimeFromX, trimStart, trimEnd, duration, handleSeek],
  );

  const handleCanvasMouseUp = useCallback(() => {
    setIsDragging(null);
  }, []);

  // Scroll to pan (no modifier), pinch/scroll-y to zoom
  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      e.preventDefault();

      // Horizontal scroll or trackpad pan -> pan
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey) {
        const maxScroll = (zoom - 1) * (containerRef.current?.clientWidth || 0);
        setScrollOffset((o) =>
          Math.max(
            0,
            Math.min(maxScroll, o + e.deltaX + (e.shiftKey ? e.deltaY : 0)),
          ),
        );
      } else {
        // Vertical scroll -> zoom (centered on cursor)
        const canvas = e.currentTarget;
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;

        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(1, Math.min(100, zoom * delta));

        // Adjust scroll to keep mouse position fixed
        const oldTotalWidth = rect.width * zoom;
        const newTotalWidth = rect.width * newZoom;
        const oldPos = scrollOffset + mouseX;
        const relPos = oldPos / oldTotalWidth;
        const newPos = relPos * newTotalWidth;
        const newScroll = newPos - mouseX;

        setZoom(newZoom);
        setScrollOffset(
          Math.max(0, Math.min((newZoom - 1) * rect.width, newScroll)),
        );
      }
    },
    [zoom, scrollOffset],
  );

  const formatMs = (seconds: number) => Math.round(seconds * 1000);
  const parseMs = (ms: number) => ms / 1000;

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center rounded-lg border border-border bg-card">
        <div className="text-center">
          <div className="mb-2 h-6 w-6 animate-spin rounded-full border-2 border-foreground border-t-transparent mx-auto" />
          <p className="text-sm text-muted-foreground">Loading audio...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg border border-border bg-card outline-none focus-within:ring-2 focus-within:ring-ring"
      // biome-ignore lint/a11y/noNoninteractiveTabindex: Editor needs focus for keyboard shortcuts
      tabIndex={0}
      // biome-ignore lint/a11y/useSemanticElements: Complex widget requires application role
      role="application"
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h3 className="font-mono text-sm font-medium">{file.name}</h3>
          <p className="text-xs text-muted-foreground">
            {formatTime(duration)} | {sampleRate.toLocaleString()} Hz
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => onSave(trimStart, trimEnd)}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Check className="mr-1 h-4 w-4" />
            Apply
          </Button>
        </div>
      </div>

      {/* View toggle + shortcuts hint */}
      <div className="border-b border-border px-4 py-2 flex items-center justify-between">
        <Tabs
          value={viewMode}
          onValueChange={(v) => setViewMode(v as 'waveform' | 'spectrogram')}
        >
          <TabsList className="h-8 bg-background">
            <TabsTrigger value="waveform" className="h-6 px-3 text-xs gap-1">
              <Waves className="h-3 w-3" />
              Waveform
              <kbd className="ml-1 text-[10px] opacity-50">1</kbd>
            </TabsTrigger>
            <TabsTrigger value="spectrogram" className="h-6 px-3 text-xs gap-1">
              <BarChart3 className="h-3 w-3" />
              Spectrogram
              <kbd className="ml-1 text-[10px] opacity-50">2</kbd>
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="text-[10px] text-muted-foreground hidden sm:block">
          <kbd className="px-1 bg-muted rounded">Space</kbd> play selection
          <span className="mx-1">|</span>
          <kbd className="px-1 bg-muted rounded">I</kbd>/
          <kbd className="px-1 bg-muted rounded">O</kbd> in/out
          <span className="mx-1">|</span>
          <kbd className="px-1 bg-muted rounded">Arrows</kbd> seek/zoom
        </div>
      </div>

      {/* Canvas container */}
      <div ref={containerRef} className="relative bg-[#0a0a0a] p-4">
        {/* Loading indicator for spectrogram */}
        {isGeneratingSpectrogram && viewMode === 'spectrogram' && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a] z-10">
            <div className="text-center">
              <div className="mb-2 h-6 w-6 animate-spin rounded-full border-2 border-foreground border-t-transparent mx-auto" />
              <p className="text-sm text-muted-foreground">
                Generating spectrogram...
              </p>
            </div>
          </div>
        )}

        {/* Waveform Canvas */}
        <canvas
          ref={waveformCanvasRef}
          className={`w-full ${viewMode === 'waveform' ? 'block' : 'hidden'}`}
          style={{ height: 160, cursor: isDragging ? 'grabbing' : 'crosshair' }}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
          onWheel={handleWheel}
        />

        {/* Spectrogram Canvas */}
        <canvas
          ref={spectrogramCanvasRef}
          className={`w-full ${viewMode === 'spectrogram' ? 'block' : 'hidden'}`}
          style={{ height: 200, cursor: isDragging ? 'grabbing' : 'crosshair' }}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
          onWheel={handleWheel}
        />

        {/* Time display */}
        <div className="mt-3 flex items-center justify-between font-mono text-xs">
          <span className="text-muted-foreground">{formatTime(0)}</span>
          <span className="rounded bg-foreground/10 px-2 py-0.5 text-foreground">
            {formatTime(currentTime)}
          </span>
          <span className="text-muted-foreground">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Transport controls */}
      <div className="border-t border-border px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Playback controls */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleSeek(currentTime - 0.1)}
              className="h-8 w-8"
              title="Back 100ms (Left Arrow)"
            >
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handlePlayPause}
              className="h-10 w-10 bg-transparent"
              title="Play selection (Space)"
            >
              {isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleSeek(currentTime + 0.1)}
              className="h-8 w-8"
              title="Forward 100ms (Right Arrow)"
            >
              <SkipForward className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePlayFromCursor}
              className="text-xs ml-1"
              title="Play from cursor (Shift+Space)"
            >
              From Cursor
            </Button>
          </div>

          {/* Speed */}
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Speed</Label>
            <select
              value={playbackRate}
              onChange={(e) => setPlaybackRate(Number(e.target.value))}
              className="h-7 rounded border border-border bg-background px-2 text-xs"
            >
              <option value={0.5}>0.5x</option>
              <option value={0.75}>0.75x</option>
              <option value={1}>1x</option>
              <option value={1.25}>1.25x</option>
              <option value={1.5}>1.5x</option>
              <option value={2}>2x</option>
            </select>
          </div>

          {/* Zoom */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setZoom((z) => Math.max(1, z / 1.5))}
              className="h-8 w-8"
              title="Zoom out (Down Arrow)"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="w-12 text-center font-mono text-xs">
              {zoom.toFixed(1)}x
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setZoom((z) => Math.min(100, z * 1.5))}
              className="h-8 w-8"
              title="Zoom in (Up Arrow)"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>

          {/* Volume */}
          <div className="flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-muted-foreground" />
            <Slider
              value={[volume]}
              onValueChange={([v]) => setVolume(v)}
              min={0}
              max={1}
              step={0.01}
              className="w-20"
            />
          </div>
        </div>
      </div>

      {/* Trim inputs */}
      <div className="border-t border-border px-4 py-3">
        <div className="flex items-end gap-6">
          <div className="flex-1">
            <Label className="mb-2 block text-xs text-muted-foreground">
              Start (ms) <kbd className="ml-1 text-[10px] opacity-50">I</kbd>
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={formatMs(trimEnd ?? duration)}
                step={1}
                value={formatMs(trimStart)}
                onChange={(e) =>
                  setTrimStart(
                    parseMs(Number.parseInt(e.target.value, 10) || 0),
                  )
                }
                className="h-8 w-28 bg-background font-mono"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTrimStart(currentTime)}
                className="h-8 text-xs"
              >
                Set
              </Button>
            </div>
          </div>
          <div className="flex-1">
            <Label className="mb-2 block text-xs text-muted-foreground">
              End (ms) <kbd className="ml-1 text-[10px] opacity-50">O</kbd>
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={formatMs(trimStart)}
                max={formatMs(duration)}
                step={1}
                value={formatMs(trimEnd ?? duration)}
                onChange={(e) =>
                  setTrimEnd(parseMs(Number.parseInt(e.target.value, 10) || 0))
                }
                className="h-8 w-28 bg-background font-mono"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTrimEnd(currentTime)}
                className="h-8 text-xs"
              >
                Set
              </Button>
            </div>
          </div>
          <div className="text-right">
            <Label className="mb-2 block text-xs text-muted-foreground">
              Duration
            </Label>
            <p className="font-mono text-sm">
              {formatTime((trimEnd ?? duration) - trimStart)}
              <span className="ml-2 text-xs text-muted-foreground">
                ({formatMs((trimEnd ?? duration) - trimStart)} ms)
              </span>
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setTrimStart(0);
              setTrimEnd(duration);
            }}
            className="h-8"
            title="Reset trim (R)"
          >
            <RotateCcw className="mr-1 h-3 w-3" />
            Reset
          </Button>
        </div>
      </div>
    </div>
  );
}
