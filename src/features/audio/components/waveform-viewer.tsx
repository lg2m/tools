import { useCallback, useMemo, useRef } from "react";
import { useShallow } from "zustand/shallow";

import { useCanvas, useWaveformData, useWaveformInteraction } from "@/features/audio/hooks";
import { useAudioDomainStore, useAudioUiStore } from "@/features/audio/store";
import {
  drawAnnotations,
  drawBackground,
  drawDragPreview,
  drawGrid,
  drawPlayhead,
  drawSelection,
  drawTimeAxis,
  drawTrimRegion,
  drawWaveform,
  type ViewState,
} from "@/features/audio/types/waveform-drawing";

export function WaveformViewer() {
  const containerRef = useRef<HTMLDivElement>(null);

  const { currentFile, currentFileId, currentTime, allAnnotations, labels, pendingSelection, selectedAnnotationId } =
    useAudioDomainStore(
      useShallow((s) => {
        const file = s.files[s.currentFileIndex];
        return {
          currentFile: file,
          currentFileId: file?.id,
          currentTime: s.currentTime,
          allAnnotations: s.annotations,
          labels: s.labels,
          pendingSelection: s.pendingSelection,
          selectedAnnotationId: s.selectedAnnotationId,
        };
      }),
    );

  const { zoom, panOffset, mode } = useAudioUiStore(
    useShallow((s) => ({
      zoom: s.zoom,
      panOffset: s.panOffset,
      mode: s.mode,
    })),
  );

  // Filter annotations for current file
  const annotations = useMemo(
    () => allAnnotations.filter((a) => a.fileId === currentFileId),
    [allAnnotations, currentFileId],
  );

  // Load waveform data
  const { data } = useWaveformData(currentFile?.url ?? null);
  const duration = currentFile?.duration ?? data?.duration ?? 0;

  // View state for drawing utilities
  const view: ViewState = useMemo(() => ({ zoom, panOffset, duration }), [zoom, panOffset, duration]);

  // Use interaction hook for all mouse handling
  const {
    dragMode,
    dragStartX,
    dragCurrentX,
    cursorStyle,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    handleWheel,
  } = useWaveformInteraction({ containerRef, annotations, view });

  // Label map for drawing
  const labelMap = useMemo(() => new Map(labels.map((l) => [l.id, l])), [labels]);

  // Trim region from current file
  const trimStart = currentFile?.trimStart;
  const trimEnd = currentFile?.trimEnd;

  // Drawing function using extracted utilities
  const draw = useCallback(
    ({ ctx, width, height }: { ctx: CanvasRenderingContext2D; width: number; height: number }) => {
      if (!data?.samples) return;

      const waveformHeight = height - 24;
      const dc = { ctx, width, height };

      // Background and grid
      drawBackground(dc);
      drawGrid(dc, waveformHeight);

      // Trim mode visualization
      if (mode === "trim" && trimStart != null && trimEnd != null) {
        drawTrimRegion(dc, trimStart, trimEnd, view, waveformHeight);
      }

      // Waveform
      drawWaveform(dc, data.samples, view, waveformHeight);

      // Annotations (only in annotate mode)
      if (mode === "annotate") {
        drawAnnotations(dc, annotations, labelMap, selectedAnnotationId, view, waveformHeight);
      }

      // Pending selection
      if (mode === "annotate" && pendingSelection) {
        drawSelection(dc, pendingSelection.startTime, pendingSelection.endTime, view, waveformHeight);
      }

      // Active drag preview
      if (dragMode === "create" && dragStartX !== null && dragCurrentX !== null) {
        drawDragPreview(dc, dragStartX, dragCurrentX, waveformHeight, mode === "trim");
      }

      // Playhead
      drawPlayhead(dc, currentTime, view, waveformHeight);

      // Time axis
      drawTimeAxis(dc, view, waveformHeight);
    },
    [
      data,
      view,
      mode,
      trimStart,
      trimEnd,
      annotations,
      labelMap,
      selectedAnnotationId,
      pendingSelection,
      dragMode,
      dragStartX,
      dragCurrentX,
      currentTime,
    ],
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
    <div className="relative h-full rounded-lg border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-[10px] font-medium tracking-wider text-muted-foreground">WAVEFORM</div>
          {mode === "trim" && (
            <div className="text-[10px] text-destructive">
              {trimStart != null && trimEnd != null
                ? `Trim: ${trimStart.toFixed(2)}s - ${trimEnd.toFixed(2)}s`
                : "Select region to trim"}
            </div>
          )}
        </div>
        <div className="font-mono text-[10px] text-muted-foreground">
          Zoom: {zoom.toFixed(1)}x | Scroll to zoom, Mid-drag to pan
        </div>
      </div>
      <div
        ref={containerRef}
        role="application"
        aria-label="Waveform editor"
        className="relative h-[calc(100%-1.75rem)] overflow-hidden rounded"
        style={{ cursor: cursorStyle }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
      >
        <canvas ref={canvasRef} className="h-full w-full" />
      </div>
    </div>
  );
}
