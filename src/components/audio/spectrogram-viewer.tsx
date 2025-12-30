import { useEffect, useRef, useState } from "react";

interface SpectrogramViewerProps {
  audioUrl: string;
  currentTime: number;
  zoom: number;
  panOffset: number;
}

export function SpectrogramViewer({ audioUrl, currentTime, zoom, panOffset }: SpectrogramViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [spectrogramData, setSpectrogramData] = useState<number[][]>([]);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const loadAudio = async () => {
      try {
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        const audioContext = new AudioContext();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        // Generate spectrogram data (simplified)
        const channelData = audioBuffer.getChannelData(0);
        const fftSize = 2048;
        const frequencyBins = fftSize / 2;
        const timeSlices = 200;
        const samplesPerSlice = Math.floor(channelData.length / timeSlices);

        const data: number[][] = [];

        for (let t = 0; t < timeSlices; t++) {
          const slice: number[] = [];
          const startSample = t * samplesPerSlice;

          for (let f = 0; f < frequencyBins / 8; f++) {
            // Simplified frequency analysis
            let sum = 0;
            const freqSamples = 32;
            for (let i = 0; i < freqSamples; i++) {
              const sample = startSample + f * freqSamples + i;
              if (sample < channelData.length) {
                sum += Math.abs(channelData[sample]);
              }
            }
            slice.push(sum / freqSamples);
          }
          data.push(slice);
        }

        setSpectrogramData(data);
        setDuration(audioBuffer.duration);
      } catch (error) {
        console.error("[v0] Error loading audio for spectrogram:", error);
      }
    };

    loadAudio();
  }, [audioUrl]);

  useEffect(() => {
    if (!canvasRef.current || spectrogramData.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    // Clear
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, width, height);

    // Draw spectrogram
    const sliceWidth = width / spectrogramData.length;
    const binHeight = height / spectrogramData[0].length;

    spectrogramData.forEach((slice, t) => {
      slice.forEach((magnitude, f) => {
        const x = t * sliceWidth;
        const y = height - f * binHeight - binHeight;

        // Color based on magnitude
        const intensity = Math.min(255, magnitude * 2000);
        const hue = 140 + (1 - magnitude * 100) * 100;
        ctx.fillStyle = `hsla(${hue}, 70%, ${30 + intensity / 8}%, ${0.3 + magnitude * 70})`;
        ctx.fillRect(x, y, Math.ceil(sliceWidth) + 1, Math.ceil(binHeight) + 1);
      });
    });

    // Draw frequency grid
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = (height / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw playhead
    const playheadX = (currentTime / duration) * width;
    if (playheadX >= 0 && playheadX <= width) {
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();
    }

    // Frequency labels
    ctx.fillStyle = "#666";
    ctx.font = "10px monospace";
    ctx.textAlign = "right";
    const freqs = ["20kHz", "15kHz", "10kHz", "5kHz", "0Hz"];
    freqs.forEach((freq, i) => {
      ctx.fillText(freq, width - 4, (height / 4) * i + 12);
    });
  }, [spectrogramData, currentTime, duration, zoom, panOffset]);

  return (
    <div className="relative h-full rounded-lg border border-border bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-medium text-muted-foreground">SPECTROGRAM</div>
        <div className="text-xs text-muted-foreground">Real-time frequency analysis</div>
      </div>
      <div className="relative h-[calc(100%-2rem)] overflow-hidden rounded">
        <canvas ref={canvasRef} className="h-full w-full" />
      </div>
    </div>
  );
}
