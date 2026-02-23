import { useCallback, useRef, useState } from "react";
import { useShallow } from "zustand/shallow";
import { type Selection, useAudioDomainStore, useAudioUiStore } from "@/features/audio/store";
import type { Annotation } from "@/features/audio/types";
import { timeToX, type ViewState, xToTime } from "@/features/audio/types/waveform-drawing";
import { usePanInteraction } from "./use-pan-interaction";

type DragMode = "none" | "create" | "move" | "resize-start" | "resize-end" | "pan";

interface HitTarget {
  type: DragMode;
  annotationId?: string;
}

const CURSOR_MAP: Record<DragMode, string> = {
  "resize-start": "ew-resize",
  "resize-end": "ew-resize",
  move: "grab",
  create: "crosshair",
  pan: "grabbing",
  none: "crosshair",
};

interface UseWaveformInteractionProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  annotations: Annotation[];
  view: ViewState;
}

export function useWaveformInteraction({ containerRef, annotations, view }: UseWaveformInteractionProps) {
  const {
    pendingSelection,
    selectedAnnotationId,
    updateAnnotation,
    setSelectedAnnotation,
    setPendingSelection,
    patchFile,
  } = useAudioDomainStore(
    useShallow((s) => ({
      pendingSelection: s.pendingSelection,
      selectedAnnotationId: s.selectedAnnotationId,
      updateAnnotation: s.updateAnnotation,
      setSelectedAnnotation: s.setSelectedAnnotation,
      setPendingSelection: s.setPendingSelection,
      patchFile: s.patchFile,
    })),
  );

  const { mode, setZoom, setPanOffset } = useAudioUiStore(
    useShallow((s) => ({
      mode: s.mode,
      setZoom: s.setZoom,
      setPanOffset: s.setPanOffset,
    })),
  );

  const currentFile = useAudioDomainStore((s) => s.files[s.currentFileIndex]);

  // Pan interaction hook
  const { handlePanStart, handlePanMove } = usePanInteraction({ view, setPanOffset });

  // Drag state
  const [dragMode, setDragMode] = useState<DragMode>("none");
  const [dragCurrentX, setDragCurrentX] = useState<number | null>(null);
  const dragStartX = useRef<number | null>(null);
  const dragInitialValue = useRef<Selection | null>(null);

  // Cursor
  const [cursorStyle, setCursorStyle] = useState("crosshair");

  const isDragging = dragMode !== "none";

  // Helper to get selection from annotation ID
  const getSelectionFromAnnotation = useCallback(
    (id: string | undefined): Selection | null => {
      if (!id) return null;
      const ann = annotations.find((a) => a.id === id);
      return ann ? { startTime: ann.startTime, endTime: ann.endTime } : null;
    },
    [annotations],
  );

  // Reset drag state helper
  const resetDragState = useCallback(() => {
    setDragMode("none");
    dragStartX.current = null;
    setDragCurrentX(null);
    dragInitialValue.current = null;
    setCursorStyle("crosshair");
  }, []);

  // Hit detection
  const getHitTarget = useCallback(
    (x: number, width: number): HitTarget => {
      const handleThreshold = 8;

      // Check pending selection handles
      if (pendingSelection && mode === "annotate") {
        const selStartX = timeToX(pendingSelection.startTime, width, view);
        const selEndX = timeToX(pendingSelection.endTime, width, view);

        if (Math.abs(x - selStartX) < handleThreshold) {
          return { type: "resize-start" };
        }
        if (Math.abs(x - selEndX) < handleThreshold) {
          return { type: "resize-end" };
        }
        if (x > selStartX + handleThreshold && x < selEndX - handleThreshold) {
          return { type: "move" };
        }
      }

      // Check selected annotation handles
      if (selectedAnnotationId && mode === "annotate") {
        const annotation = annotations.find((a) => a.id === selectedAnnotationId);
        if (annotation) {
          const startX = timeToX(annotation.startTime, width, view);
          const endX = timeToX(annotation.endTime, width, view);

          if (Math.abs(x - startX) < handleThreshold) {
            return { type: "resize-start", annotationId: annotation.id };
          }
          if (Math.abs(x - endX) < handleThreshold) {
            return { type: "resize-end", annotationId: annotation.id };
          }
        }
      }

      // Check if clicking inside any annotation
      if (mode === "annotate") {
        for (const annotation of annotations) {
          const startX = timeToX(annotation.startTime, width, view);
          const endX = timeToX(annotation.endTime, width, view);

          if (x >= startX && x <= endX) {
            return { type: "move", annotationId: annotation.id };
          }
        }
      }

      return { type: "create" };
    },
    [pendingSelection, selectedAnnotationId, annotations, mode, view],
  );

  // Start drag
  const startDrag = useCallback((newMode: DragMode, x: number, initialValue?: Selection) => {
    setDragMode(newMode);
    dragStartX.current = x;
    setDragCurrentX(x);
    dragInitialValue.current = initialValue ?? null;
  }, []);

  // Handle mouse down
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const width = rect.width;

      // Middle click = pan
      if (e.button === 1) {
        e.preventDefault();
        startDrag("pan", e.clientX);
        handlePanStart(e.clientX);
        setCursorStyle("grabbing");
        return;
      }

      if (e.button !== 0) return;

      const hitTarget = getHitTarget(x, width);

      if (hitTarget.type === "resize-start" || hitTarget.type === "resize-end") {
        const initialSelection = pendingSelection ?? getSelectionFromAnnotation(hitTarget.annotationId);

        if (initialSelection) {
          startDrag(hitTarget.type, x, initialSelection);
          if (hitTarget.annotationId) {
            setSelectedAnnotation(hitTarget.annotationId);
          }
          setCursorStyle("ew-resize");
        }
      } else if (hitTarget.type === "move") {
        const initialSelection = hitTarget.annotationId
          ? getSelectionFromAnnotation(hitTarget.annotationId)
          : pendingSelection;

        if (initialSelection) {
          startDrag("move", x, initialSelection);
          if (hitTarget.annotationId) {
            setSelectedAnnotation(hitTarget.annotationId);
            setPendingSelection(null);
          }
          setCursorStyle("grabbing");
        }
      } else {
        startDrag("create", x);
        setSelectedAnnotation(null);
        setPendingSelection(null);
        setCursorStyle("crosshair");
      }
    },
    [
      containerRef,
      getHitTarget,
      pendingSelection,
      getSelectionFromAnnotation,
      startDrag,
      handlePanStart,
      setSelectedAnnotation,
      setPendingSelection,
    ],
  );

  // Handle mouse move
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const width = rect.width;

      // Handle pan
      if (dragMode === "pan") {
        handlePanMove(e.clientX, width);
        return;
      }

      // Handle other drag modes
      if (isDragging) {
        setDragCurrentX(x);

        if (dragMode === "resize-start" || dragMode === "resize-end" || dragMode === "move") {
          const initialSelection = dragInitialValue.current;
          if (!initialSelection) return;

          const deltaX = x - (dragStartX.current ?? 0);
          const deltaTime = (deltaX / width) * (view.duration / view.zoom);

          let newStartTime = initialSelection.startTime;
          let newEndTime = initialSelection.endTime;

          if (dragMode === "resize-start") {
            newStartTime = Math.max(
              0,
              Math.min(initialSelection.endTime - 0.05, initialSelection.startTime + deltaTime),
            );
          } else if (dragMode === "resize-end") {
            newEndTime = Math.max(
              initialSelection.startTime + 0.05,
              Math.min(view.duration, initialSelection.endTime + deltaTime),
            );
          } else {
            // Move
            const selectionDuration = initialSelection.endTime - initialSelection.startTime;
            newStartTime = initialSelection.startTime + deltaTime;
            newEndTime = initialSelection.endTime + deltaTime;

            if (newStartTime < 0) {
              newStartTime = 0;
              newEndTime = selectionDuration;
            }
            if (newEndTime > view.duration) {
              newEndTime = view.duration;
              newStartTime = view.duration - selectionDuration;
            }
          }

          // Update annotation or pending selection
          if (selectedAnnotationId) {
            const updates: { startTime?: number; endTime?: number } = {};
            if (dragMode === "resize-start" || dragMode === "move") {
              updates.startTime = newStartTime;
            }
            if (dragMode === "resize-end" || dragMode === "move") {
              updates.endTime = newEndTime;
            }
            updateAnnotation(selectedAnnotationId, updates);
          } else {
            setPendingSelection({ startTime: newStartTime, endTime: newEndTime });
          }
        }
        return;
      }

      // Update cursor when not dragging
      const hitTarget = getHitTarget(x, width);
      setCursorStyle(hitTarget.type === "move" ? "grab" : CURSOR_MAP[hitTarget.type]);
    },
    [
      containerRef,
      dragMode,
      isDragging,
      view,
      selectedAnnotationId,
      getHitTarget,
      handlePanMove,
      updateAnnotation,
      setPendingSelection,
    ],
  );

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const width = rect.width;

    if (dragMode === "pan") {
      resetDragState();
      return;
    }

    if (dragMode === "create" && dragStartX.current !== null && dragCurrentX !== null) {
      const startTime = xToTime(Math.min(dragStartX.current, dragCurrentX), width, view);
      const endTime = xToTime(Math.max(dragStartX.current, dragCurrentX), width, view);

      if (Math.abs(endTime - startTime) > 0.1) {
        if (mode === "trim") {
          if (currentFile) {
            patchFile(currentFile.id, { trimStart: startTime, trimEnd: endTime });
          }
        } else {
          setPendingSelection({ startTime, endTime });
        }
      }
    }

    resetDragState();
  }, [containerRef, dragMode, dragCurrentX, view, mode, currentFile, patchFile, setPendingSelection, resetDragState]);

  // Handle mouse leave
  const handleMouseLeave = useCallback(() => {
    if (isDragging) {
      resetDragState();
    } else {
      setCursorStyle("crosshair");
    }
  }, [isDragging, resetDragState]);

  // Handle wheel (zoom)
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(1, Math.min(20, view.zoom * delta));
      setZoom(newZoom);
    },
    [view.zoom, setZoom],
  );

  return {
    // State for rendering
    dragMode,
    dragStartX: dragStartX.current,
    dragCurrentX,
    cursorStyle,
    isDragging,

    // Event handlers
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    handleWheel,
  };
}
