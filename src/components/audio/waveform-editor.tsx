import { useRef, useState, useEffect, useCallback } from 'react';

import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Check,
  Volume2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';

type WaveformEditorProps = {
  file: File;
  initialTrimStart?: number;
  initialTrimEnd?: number | null;
  onSave: (trimStart: number, trimEnd: number | null) => void;
  onCancel: () => void;
};

export function WaveformEditor({
  file,
  initialTrimStart = 0,
  initialTrimEnd = null,
  onSave,
  onCancel,
}: WaveformEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [trimStart, setTrimStart] = useState(initialTrimStart);
  const [trimEnd, setTrimEnd] = useState<number | null>(initialTrimEnd);

  const [zoom, setZoom] = useState(1);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [volume, setVolume] = useState(1);

  const [isDragging, setIsDragging] = useState<
    'start' | 'end' | 'playhead' | null
  >(null);

  // Load and decode audio
  useEffect(() => {
    const loadAudio = async () => {
      setIsLoading(true);
      try {
        const arrayBuffer = await file.arrayBuffer();
        audioContextRef.current = new AudioContext();
        const buffer =
          await audioContextRef.current.decodeAudioData(arrayBuffer);
        setAudioBuffer(buffer);
        setDuration(buffer.duration);
        if (trimEnd === null) {
          setTrimEnd(buffer.duration);
        }

        // Generate waveform data
        const channelData = buffer.getChannelData(0);
        const samples = 2000;
        const blockSize = Math.floor(channelData.length / samples);
        const waveform: number[] = [];
        for (let i = 0; i < samples; i++) {
          let sum = 0;
          for (let j = 0; j < blockSize; j++) {
            sum += Math.abs(channelData[i * blockSize + j]);
          }
          waveform.push(sum / blockSize);
        }
        // Normalize
        const max = Math.max(...waveform);
        setWaveformData(waveform.map((v) => v / max));
      } catch (error) {
        console.error('Failed to load audio:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAudio();

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [file]);

  // Create object URL for audio element
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setAudioUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Draw waveform
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || waveformData.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    const visibleDuration = duration / zoom;
    const startTime = scrollOffset;
    const endTime = startTime + visibleDuration;

    const startIdx = Math.floor((startTime / duration) * waveformData.length);
    const endIdx = Math.ceil((endTime / duration) * waveformData.length);
    const visibleData = waveformData.slice(startIdx, endIdx);

    const barWidth = width / visibleData.length;
    const centerY = height / 2;

    // Draw trim regions (dimmed)
    const trimStartX = ((trimStart - startTime) / visibleDuration) * width;
    const trimEndX =
      (((trimEnd ?? duration) - startTime) / visibleDuration) * width;

    // Dim regions outside trim
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    if (trimStartX > 0) {
      ctx.fillRect(0, 0, trimStartX, height);
    }
    if (trimEndX < width) {
      ctx.fillRect(trimEndX, 0, width - trimEndX, height);
    }

    // Draw waveform
    visibleData.forEach((value, i) => {
      const x = i * barWidth;
      const barHeight = value * (height * 0.8);
      const timeAtX = startTime + (i / visibleData.length) * visibleDuration;
      const isInTrim = timeAtX >= trimStart && timeAtX <= (trimEnd ?? duration);

      ctx.fillStyle = isInTrim ? '#e5e5e5' : '#404040';
      ctx.fillRect(
        x,
        centerY - barHeight / 2,
        Math.max(barWidth - 1, 1),
        barHeight,
      );
    });

    // Draw trim handles
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    if (trimStartX >= 0 && trimStartX <= width) {
      ctx.beginPath();
      ctx.moveTo(trimStartX, 0);
      ctx.lineTo(trimStartX, height);
      ctx.stroke();
      // Handle grip
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(trimStartX - 4, 0, 8, 20);
      ctx.fillRect(trimStartX - 4, height - 20, 8, 20);
    }
    if (trimEndX >= 0 && trimEndX <= width) {
      ctx.beginPath();
      ctx.moveTo(trimEndX, 0);
      ctx.lineTo(trimEndX, height);
      ctx.stroke();
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(trimEndX - 4, 0, 8, 20);
      ctx.fillRect(trimEndX - 4, height - 20, 8, 20);
    }

    // Draw playhead
    const playheadX = ((currentTime - startTime) / visibleDuration) * width;
    if (playheadX >= 0 && playheadX <= width) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();
      // Playhead triangle
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(playheadX - 6, 0);
      ctx.lineTo(playheadX + 6, 0);
      ctx.lineTo(playheadX, 10);
      ctx.closePath();
      ctx.fill();
    }
  }, [
    waveformData,
    duration,
    zoom,
    scrollOffset,
    trimStart,
    trimEnd,
    currentTime,
  ]);

  useEffect(() => {
    drawWaveform();
  }, [drawWaveform]);

  // Update current time from audio element
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      // Stop at trim end if playing
      if (trimEnd !== null && audio.currentTime >= trimEnd) {
        audio.pause();
        setIsPlaying(false);
      }
    };

    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [trimEnd]);

  // Handle volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const handlePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      // If at trim end, restart from trim start
      if (trimEnd !== null && audio.currentTime >= trimEnd) {
        audio.currentTime = trimStart;
      }
      // If before trim start, jump to trim start
      if (audio.currentTime < trimStart) {
        audio.currentTime = trimStart;
      }
      audio.play();
      setIsPlaying(true);
    }
  };

  const handlePlayTrimmedSection = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = trimStart;
    audio.play();
    setIsPlaying(true);
  };

  const handleSeek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, Math.min(time, duration));
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const visibleDuration = duration / zoom;
    const startTime = scrollOffset;
    const clickTime = startTime + (x / rect.width) * visibleDuration;

    const trimStartX = ((trimStart - startTime) / visibleDuration) * rect.width;
    const trimEndX =
      (((trimEnd ?? duration) - startTime) / visibleDuration) * rect.width;

    // Check if clicking on trim handles (within 10px)
    if (Math.abs(x - trimStartX) < 10) {
      setIsDragging('start');
    } else if (Math.abs(x - trimEndX) < 10) {
      setIsDragging('end');
    } else {
      // Click to seek
      handleSeek(clickTime);
      setIsDragging('playhead');
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const visibleDuration = duration / zoom;
    const startTime = scrollOffset;
    const time = Math.max(
      0,
      Math.min(duration, startTime + (x / rect.width) * visibleDuration),
    );

    if (isDragging === 'start') {
      setTrimStart(Math.min(time, (trimEnd ?? duration) - 0.01));
    } else if (isDragging === 'end') {
      setTrimEnd(Math.max(time, trimStart + 0.01));
    } else if (isDragging === 'playhead') {
      handleSeek(time);
    }
  };

  const handleCanvasMouseUp = () => {
    setIsDragging(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom((z) => Math.max(1, Math.min(50, z * delta)));
    } else {
      const delta = e.deltaX !== 0 ? e.deltaX : e.deltaY;
      const visibleDuration = duration / zoom;
      const maxOffset = duration - visibleDuration;
      setScrollOffset((o) =>
        Math.max(0, Math.min(maxOffset, o + (delta / 500) * visibleDuration)),
      );
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

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
    <div className="rounded-lg border border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h3 className="font-mono text-sm font-medium">{file.name}</h3>
          <p className="text-xs text-muted-foreground">
            Duration: {formatTime(duration)} | Sample Rate:{' '}
            {audioBuffer?.sampleRate ?? 0} Hz
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => onSave(trimStart, trimEnd)}
            className="bg-green-600 hover:bg-green-700"
          >
            <Check className="mr-1 h-4 w-4" />
            Apply Trim
          </Button>
        </div>
      </div>

      {/* Waveform */}
      <div ref={containerRef} className="relative p-4">
        <canvas
          ref={canvasRef}
          className="h-40 w-full cursor-crosshair rounded-md"
          style={{ imageRendering: 'pixelated' }}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
          onWheel={handleWheel}
        />

        {/* Time display */}
        <div className="mt-2 flex items-center justify-between font-mono text-xs text-muted-foreground">
          <span>{formatTime(scrollOffset)}</span>
          <span className="text-foreground">{formatTime(currentTime)}</span>
          <span>
            {formatTime(Math.min(duration, scrollOffset + duration / zoom))}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="border-t border-border px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Playback controls */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleSeek(Math.max(0, currentTime - 1))}
              className="h-8 w-8"
            >
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handlePlayPause}
              className="h-10 w-10 bg-transparent"
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
              onClick={() => handleSeek(Math.min(duration, currentTime + 1))}
              className="h-8 w-8"
            >
              <SkipForward className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePlayTrimmedSection}
              className="text-xs"
            >
              Play Selection
            </Button>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setZoom((z) => Math.max(1, z / 1.5))}
              className="h-8 w-8"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="w-12 text-center font-mono text-xs">
              {zoom.toFixed(1)}x
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setZoom((z) => Math.min(50, z * 1.5))}
              className="h-8 w-8"
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

      {/* Precise trim inputs */}
      <div className="border-t border-border px-4 py-3">
        <div className="flex items-end gap-6">
          <div className="flex-1">
            <Label className="mb-2 block text-xs text-muted-foreground">
              Trim Start (ms)
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={formatMs(trimEnd ?? duration)}
                step={1}
                value={formatMs(trimStart)}
                onChange={(e) =>
                  setTrimStart(parseMs(Number.parseInt(e.target.value) || 0))
                }
                className="h-8 w-28 bg-background font-mono"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTrimStart(currentTime)}
                className="h-8 text-xs"
              >
                Set to playhead
              </Button>
            </div>
          </div>
          <div className="flex-1">
            <Label className="mb-2 block text-xs text-muted-foreground">
              Trim End (ms)
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={formatMs(trimStart)}
                max={formatMs(duration)}
                step={1}
                value={formatMs(trimEnd ?? duration)}
                onChange={(e) =>
                  setTrimEnd(parseMs(Number.parseInt(e.target.value) || 0))
                }
                className="h-8 w-28 bg-background font-mono"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTrimEnd(currentTime)}
                className="h-8 text-xs"
              >
                Set to playhead
              </Button>
            </div>
          </div>
          <div className="text-right">
            <Label className="mb-2 block text-xs text-muted-foreground">
              Selection Duration
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
          >
            <RotateCcw className="mr-1 h-3 w-3" />
            Reset
          </Button>
        </div>
      </div>

      {/* Hidden audio element for playback */}
      {audioUrl && <audio ref={audioRef} src={audioUrl} preload="auto" />}
    </div>
  );
}
