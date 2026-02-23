import { useCallback, useMemo, useRef } from "react";
import { useShallow } from "zustand/shallow";
import { processWaveform, useAudioData } from "@/hooks/use-audio-data";
import { useCanvas } from "@/hooks/use-canvas";
import { useWaveformInteraction } from "@/hooks/use-waveform-interaction";
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
} from "@/lib/audio/waveform";

import { useAudioDomainStore, useAudioUiStore } from "@/store/audio";
import type { ViewState } from "@/types/audio";

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

  const annotations = useMemo(
    () => (currentFileId ? allAnnotations.filter((annotation) => annotation.fileId === currentFileId) : []),
    [allAnnotations, currentFileId],
  );

  const { data } = useAudioData(currentFile?.url ?? null, processWaveform);
  const duration = currentFile?.duration ?? data?.duration ?? 0;
  const view: ViewState = useMemo(() => ({ zoom, panOffset, duration }), [zoom, panOffset, duration]);

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

  const labelMap = useMemo(() => new Map(labels.map((label) => [label.id, label])), [labels]);
  const isTrimMode = mode === "trim";
  const isAnnotateMode = mode === "annotate";
  const trimStart = currentFile?.trimStart;
  const trimEnd = currentFile?.trimEnd;

  const trimStatus =
    isTrimMode && trimStart != null && trimEnd != null
      ? `Trim: ${trimStart.toFixed(2)}s - ${trimEnd.toFixed(2)}s`
      : "Select region to trim";

  const draw = useCallback(
    ({ ctx, width, height }: { ctx: CanvasRenderingContext2D; width: number; height: number }) => {
      if (!data?.result) return;

      const waveformHeight = height - 24;
      const dc = { ctx, width, height };

      drawBackground(dc);
      drawGrid(dc, waveformHeight);

      if (isTrimMode && trimStart != null && trimEnd != null) {
        drawTrimRegion(dc, trimStart, trimEnd, view, waveformHeight);
      }

      drawWaveform(dc, data.result, view, waveformHeight);

      if (isAnnotateMode) {
        drawAnnotations(dc, annotations, labelMap, selectedAnnotationId, view, waveformHeight);
      }

      if (isAnnotateMode && pendingSelection) {
        drawSelection(dc, pendingSelection.startTime, pendingSelection.endTime, view, waveformHeight);
      }

      if (dragMode === "create" && dragStartX !== null && dragCurrentX !== null) {
        drawDragPreview(dc, dragStartX, dragCurrentX, waveformHeight, isTrimMode);
      }

      drawPlayhead(dc, currentTime, view, waveformHeight);
      drawTimeAxis(dc, view, waveformHeight);
    },
    [
      data,
      view,
      isTrimMode,
      trimStart,
      trimEnd,
      isAnnotateMode,
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
          {isTrimMode && <div className="text-[10px] text-destructive">{trimStatus}</div>}
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
        onContextMenu={(event) => event.preventDefault()}
      >
        <canvas ref={canvasRef} className="h-full w-full" />
      </div>
    </div>
  );
}
