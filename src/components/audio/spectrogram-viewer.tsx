import { useCallback } from "react";
import { useShallow } from "zustand/shallow";
import { processSpectrogram, useAudioData } from "@/hooks/use-audio-data";
import { useCanvas } from "@/hooks/use-canvas";
import { useAudioDomainStore, useAudioUiStore } from "@/store/audio";

const FREQUENCY_LABELS = ["20kHz", "15kHz", "10kHz", "5kHz", "0Hz"];

export function SpectrogramViewer() {
  const { currentFile, currentTime } = useAudioDomainStore(
    useShallow((s) => ({
      currentFile: s.files[s.currentFileIndex],
      currentTime: s.currentTime,
    })),
  );

  const { zoom, panOffset } = useAudioUiStore(
    useShallow((s) => ({
      zoom: s.zoom,
      panOffset: s.panOffset,
    })),
  );

  const { data } = useAudioData(currentFile?.url ?? null, processSpectrogram);

  const draw = useCallback(
    ({ ctx, width, height }: { ctx: CanvasRenderingContext2D; width: number; height: number }) => {
      if (!data) return;

      const { result, duration } = data;
      if (!result.length || !result[0]?.length || duration <= 0) return;

      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, width, height);

      const visibleStart = panOffset;
      const visibleDuration = duration / zoom;
      const visibleEnd = visibleStart + visibleDuration;
      const visibleRange = Math.max(visibleEnd - visibleStart, Number.EPSILON);

      const totalSlices = result.length;
      const totalBins = result[0].length;
      const binHeight = height / totalBins;

      const startSlice = Math.max(0, Math.floor((visibleStart / duration) * totalSlices));
      const endSlice = Math.min(totalSlices, Math.ceil((visibleEnd / duration) * totalSlices));

      for (let t = startSlice; t < endSlice; t++) {
        const slice = result[t];
        const sliceTime = (t / totalSlices) * duration;
        const x = ((sliceTime - visibleStart) / visibleRange) * width;
        const nextSliceTime = ((t + 1) / totalSlices) * duration;
        const nextX = ((nextSliceTime - visibleStart) / visibleRange) * width;
        const sliceWidth = Math.max(1, Math.ceil(nextX - x));

        for (let f = 0; f < slice.length; f++) {
          const magnitude = slice[f];
          const y = height - (f + 1) * binHeight;
          const intensity = Math.min(255, magnitude * 2000);
          const hue = 140 + (1 - magnitude * 100) * 100;

          ctx.fillStyle = `hsla(${hue}, 70%, ${30 + intensity / 8}%, ${0.3 + magnitude * 70})`;
          ctx.fillRect(x, y, sliceWidth, Math.ceil(binHeight) + 1);
        }
      }

      ctx.strokeStyle = "#1a1a1a";
      ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i++) {
        const y = (height / 4) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      const playheadX = ((currentTime - visibleStart) / visibleRange) * width;
      if (playheadX >= 0 && playheadX <= width) {
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(playheadX, 0);
        ctx.lineTo(playheadX, height);
        ctx.stroke();
      }

      ctx.fillStyle = "#666";
      ctx.font = "10px monospace";
      ctx.textAlign = "right";
      for (let i = 0; i < FREQUENCY_LABELS.length; i++) {
        ctx.fillText(FREQUENCY_LABELS[i], width - 4, (height / 4) * i + 12);
      }
    },
    [data, zoom, panOffset, currentTime],
  );

  const canvasRef = useCanvas(draw);

  if (!currentFile) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-border bg-card p-3">
        <div className="text-sm text-muted-foreground">No file selected</div>
      </div>
    );
  }

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
