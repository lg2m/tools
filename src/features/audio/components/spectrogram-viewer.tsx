import { useCallback, useMemo } from "react";
import { useShallow } from "zustand/shallow";

import { useCanvas, useSpectrogramData } from "@/features/audio/hooks";
import { useAnnotatorStore } from "@/features/audio/store";

export function SpectrogramViewer() {
  // Get state from store - same pattern as WaveformViewer
  const { currentFile, currentTime, zoom, panOffset } = useAnnotatorStore(
    useShallow((s) => {
      const file = s.files[s.currentFileIndex];
      return {
        currentFile: file,
        currentTime: s.currentTime,
        zoom: s.zoom,
        panOffset: s.panOffset,
      };
    }),
  );

  const { data } = useSpectrogramData(currentFile?.url ?? null);
  const duration = currentFile?.duration ?? data?.duration ?? 0;

  // View state for drawing
  const view = useMemo(() => ({ zoom, panOffset, duration }), [zoom, panOffset, duration]);

  const draw = useCallback(
    ({ ctx, width, height }: { ctx: CanvasRenderingContext2D; width: number; height: number }) => {
      if (!data) return;

      const { data: spectrogramData, duration: specDuration } = data;

      // Clear
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, width, height);

      // Calculate visible range based on zoom and pan
      const visibleStart = view.panOffset;
      const visibleEnd = view.panOffset + specDuration / view.zoom;

      // Draw spectrogram
      const sliceWidth = width / spectrogramData.length;
      const binHeight = height / spectrogramData[0].length;

      // Calculate which time slices are visible
      const startSlice = Math.floor((visibleStart / specDuration) * spectrogramData.length);
      const endSlice = Math.ceil((visibleEnd / specDuration) * spectrogramData.length);

      for (let t = Math.max(0, startSlice); t < Math.min(spectrogramData.length, endSlice); t++) {
        const slice = spectrogramData[t];
        const sliceTime = (t / spectrogramData.length) * specDuration;
        const x = ((sliceTime - visibleStart) / (visibleEnd - visibleStart)) * width;

        for (let f = 0; f < slice.length; f++) {
          const magnitude = slice[f];
          const y = height - f * binHeight - binHeight;

          // Color based on magnitude
          const intensity = Math.min(255, magnitude * 2000);
          const hue = 140 + (1 - magnitude * 100) * 100;
          ctx.fillStyle = `hsla(${hue}, 70%, ${30 + intensity / 8}%, ${0.3 + magnitude * 70})`;
          ctx.fillRect(x, y, Math.ceil(sliceWidth * view.zoom) + 1, Math.ceil(binHeight) + 1);
        }
      }

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
      const playheadX = ((currentTime - visibleStart) / (visibleEnd - visibleStart)) * width;
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
      for (let i = 0; i < freqs.length; i++) {
        ctx.fillText(freqs[i], width - 4, (height / 4) * i + 12);
      }
    },
    [data, view, currentTime],
  );

  const canvasRef = useCanvas(draw);

  // Early return after all hooks
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
