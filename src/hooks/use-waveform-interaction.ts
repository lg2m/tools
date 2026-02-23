import { useCallback, useMemo, useRef, useState } from "react";

import { xToTime } from "@/lib/audio/waveform";
import { useAudioDomainStore, useAudioUiStore } from "@/store/audio";
import type { Annotation, Selection, ViewState } from "@/types/audio";

type DragMode = "none" | "create" | "move" | "resize-start" | "resize-end" | "pan";

interface HitTarget {
  type: DragMode;
  annotationId?: string;
  selection?: Selection;
}

const HANDLE_THRESHOLD_PX = 8;
const MIN_REGION_DURATION = 0.05;
const MIN_CREATE_DURATION = 0.1;
const MIN_ZOOM = 1;
const MAX_ZOOM = 20;

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
  // Pan interaction state
  const panStartRef = useRef({ x: 0, offset: 0 });

  // Drag state
  const [dragMode, setDragMode] = useState<DragMode>("none");
  const [dragCurrentX, setDragCurrentX] = useState<number | null>(null);
  const dragStartX = useRef<number | null>(null);
  const dragCurrentXRef = useRef<number | null>(null);
  const dragInitialValue = useRef<Selection | null>(null);
  const dragAnnotationIdRef = useRef<string | null>(null);
  const dragFileIdRef = useRef<string | null>(null);

  // Cursor
  const [cursorStyle, setCursorStyle] = useState("crosshair");

  const isDragging = dragMode !== "none";

  const annotationById = useMemo(
    () => new Map(annotations.map((annotation) => [annotation.id, annotation])),
    [annotations],
  );

  // Helper to get selection from annotation ID
  const getSelectionFromAnnotation = useCallback(
    (id: string | undefined): Selection | null => {
      if (!id) return null;
      const ann = annotationById.get(id);
      return ann ? { startTime: ann.startTime, endTime: ann.endTime } : null;
    },
    [annotationById],
  );

  const setCursorIfChanged = useCallback((nextCursor: string) => {
    setCursorStyle((currentCursor) => (currentCursor === nextCursor ? currentCursor : nextCursor));
  }, []);

  // Reset drag state helper
  const resetDragState = useCallback(() => {
    setDragMode("none");
    dragStartX.current = null;
    dragCurrentXRef.current = null;
    setDragCurrentX(null);
    dragInitialValue.current = null;
    dragAnnotationIdRef.current = null;
    dragFileIdRef.current = null;
    setCursorIfChanged("crosshair");
  }, [setCursorIfChanged]);

  const getTimeAtX = useCallback(
    (x: number, width: number): number => view.panOffset + (x / width) * (view.duration / view.zoom),
    [view.panOffset, view.duration, view.zoom],
  );

  const getDeltaTimeForDeltaX = useCallback(
    (deltaX: number, width: number): number => (deltaX / width) * (view.duration / view.zoom),
    [view.duration, view.zoom],
  );

  // Hit detection - reads fresh state from store
  const getHitTarget = useCallback(
    (x: number, width: number): HitTarget => {
      if (width <= 0) {
        return { type: "create" };
      }

      const timeAtCursor = getTimeAtX(x, width);
      const handleThresholdTime = (HANDLE_THRESHOLD_PX / width) * (view.duration / view.zoom);

      const { pendingSelection, selectedAnnotationId, files, currentFileIndex } = useAudioDomainStore.getState();
      const { mode } = useAudioUiStore.getState();
      const currentFile = files[currentFileIndex];

      // Check pending selection handles (annotate mode)
      if (pendingSelection && mode === "annotate") {
        const selection = { startTime: pendingSelection.startTime, endTime: pendingSelection.endTime };

        if (Math.abs(timeAtCursor - selection.startTime) < handleThresholdTime) {
          return { type: "resize-start", selection };
        }
        if (Math.abs(timeAtCursor - selection.endTime) < handleThresholdTime) {
          return { type: "resize-end", selection };
        }
        if (
          timeAtCursor > selection.startTime + handleThresholdTime &&
          timeAtCursor < selection.endTime - handleThresholdTime
        ) {
          return { type: "move", selection };
        }
      }

      // Check trim region handles (trim mode)
      if (mode === "trim" && currentFile?.trimStart != null && currentFile?.trimEnd != null) {
        const selection = { startTime: currentFile.trimStart, endTime: currentFile.trimEnd };

        if (Math.abs(timeAtCursor - selection.startTime) < handleThresholdTime) {
          return { type: "resize-start", selection };
        }
        if (Math.abs(timeAtCursor - selection.endTime) < handleThresholdTime) {
          return { type: "resize-end", selection };
        }
        if (
          timeAtCursor > selection.startTime + handleThresholdTime &&
          timeAtCursor < selection.endTime - handleThresholdTime
        ) {
          return { type: "move", selection };
        }
      }

      // Check selected annotation handles
      if (selectedAnnotationId && mode === "annotate") {
        const annotation = annotationById.get(selectedAnnotationId);
        if (annotation) {
          const selection = { startTime: annotation.startTime, endTime: annotation.endTime };

          if (Math.abs(timeAtCursor - selection.startTime) < handleThresholdTime) {
            return { type: "resize-start", annotationId: annotation.id, selection };
          }
          if (Math.abs(timeAtCursor - selection.endTime) < handleThresholdTime) {
            return { type: "resize-end", annotationId: annotation.id, selection };
          }
        }
      }

      // Check if clicking inside any annotation
      if (mode === "annotate") {
        for (const annotation of annotations) {
          if (timeAtCursor >= annotation.startTime && timeAtCursor <= annotation.endTime) {
            return {
              type: "move",
              annotationId: annotation.id,
              selection: { startTime: annotation.startTime, endTime: annotation.endTime },
            };
          }
        }
      }

      return { type: "create" };
    },
    [annotations, annotationById, getTimeAtX, view.duration, view.zoom],
  );

  // Start drag
  const startDrag = useCallback(
    (
      newMode: DragMode,
      x: number,
      options?: { initialValue?: Selection; annotationId?: string | null; fileId?: string | null },
    ) => {
      setDragMode(newMode);
      dragStartX.current = x;
      dragCurrentXRef.current = x;
      setDragCurrentX(newMode === "create" ? x : null);
      dragInitialValue.current = options?.initialValue ?? null;
      dragAnnotationIdRef.current = options?.annotationId ?? null;
      dragFileIdRef.current = options?.fileId ?? null;
    },
    [],
  );

  // Handle mouse down
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const width = rect.width;
      if (width <= 0) return;

      // Get fresh state
      const { pendingSelection, setSelectedAnnotation, setPendingSelection, files, currentFileIndex } =
        useAudioDomainStore.getState();
      const { mode } = useAudioUiStore.getState();
      const currentFile = files[currentFileIndex];

      // Middle click = pan
      if (e.button === 1) {
        e.preventDefault();
        startDrag("pan", e.clientX);
        panStartRef.current = { x: e.clientX, offset: view.panOffset };
        setCursorIfChanged("grabbing");
        return;
      }

      if (e.button !== 0) return;

      const hitTarget = getHitTarget(x, width);

      if (hitTarget.type === "resize-start" || hitTarget.type === "resize-end") {
        if (hitTarget.selection) {
          startDrag(hitTarget.type, x, {
            initialValue: hitTarget.selection,
            annotationId: hitTarget.annotationId,
            fileId: mode === "trim" ? currentFile?.id : null,
          });
          if (hitTarget.annotationId) {
            setSelectedAnnotation(hitTarget.annotationId);
          }
          setCursorIfChanged("ew-resize");
        }
      } else if (hitTarget.type === "move") {
        const initialSelection =
          hitTarget.selection ??
          (hitTarget.annotationId ? getSelectionFromAnnotation(hitTarget.annotationId) : pendingSelection);

        if (initialSelection) {
          startDrag("move", x, {
            initialValue: initialSelection,
            annotationId: hitTarget.annotationId,
            fileId: mode === "trim" ? currentFile?.id : null,
          });
          if (hitTarget.annotationId) {
            setSelectedAnnotation(hitTarget.annotationId);
            setPendingSelection(null);
          }
          setCursorIfChanged("grabbing");
        }
      } else {
        startDrag("create", x);
        setSelectedAnnotation(null);
        setPendingSelection(null);
        setCursorIfChanged("crosshair");
      }
    },
    [containerRef, view.panOffset, getHitTarget, getSelectionFromAnnotation, setCursorIfChanged, startDrag],
  );

  // Handle mouse move
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const width = rect.width;
      if (width <= 0) return;

      // Handle pan
      if (dragMode === "pan") {
        const { setPanOffset } = useAudioUiStore.getState();
        const dx = e.clientX - panStartRef.current.x;
        const panDelta = (dx / width) * (view.duration / view.zoom);
        const newOffset = Math.max(
          0,
          Math.min(view.duration - view.duration / view.zoom, panStartRef.current.offset - panDelta),
        );
        setPanOffset(newOffset);
        return;
      }

      // Handle create drag preview
      if (dragMode === "create") {
        dragCurrentXRef.current = x;
        setDragCurrentX(x);
        return;
      }

      // Handle selection/annotation/trim drag updates
      if (isDragging) {
        if (dragMode !== "resize-start" && dragMode !== "resize-end" && dragMode !== "move") {
          return;
        }

        const initialSelection = dragInitialValue.current;
        if (!initialSelection) return;

        const deltaX = x - (dragStartX.current ?? 0);
        const deltaTime = getDeltaTimeForDeltaX(deltaX, width);

        let newStartTime = initialSelection.startTime;
        let newEndTime = initialSelection.endTime;

        if (dragMode === "resize-start") {
          newStartTime = Math.max(
            0,
            Math.min(initialSelection.endTime - MIN_REGION_DURATION, initialSelection.startTime + deltaTime),
          );
        } else if (dragMode === "resize-end") {
          newEndTime = Math.max(
            initialSelection.startTime + MIN_REGION_DURATION,
            Math.min(view.duration, initialSelection.endTime + deltaTime),
          );
        } else {
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

        const { mode } = useAudioUiStore.getState();
        const { patchFile, updateAnnotation, setPendingSelection } = useAudioDomainStore.getState();

        if (mode === "trim" && dragFileIdRef.current) {
          patchFile(dragFileIdRef.current, { trimStart: newStartTime, trimEnd: newEndTime });
        } else if (dragAnnotationIdRef.current) {
          const updates: { startTime?: number; endTime?: number } = {};
          if (dragMode === "resize-start" || dragMode === "move") {
            updates.startTime = newStartTime;
          }
          if (dragMode === "resize-end" || dragMode === "move") {
            updates.endTime = newEndTime;
          }
          updateAnnotation(dragAnnotationIdRef.current, updates);
        } else {
          setPendingSelection({ startTime: newStartTime, endTime: newEndTime });
        }

        return;
      }

      // Update cursor when not dragging
      const hitTarget = getHitTarget(x, width);
      setCursorIfChanged(hitTarget.type === "move" ? "grab" : CURSOR_MAP[hitTarget.type]);
    },
    [
      containerRef,
      dragMode,
      isDragging,
      view.duration,
      view.zoom,
      getDeltaTimeForDeltaX,
      getHitTarget,
      setCursorIfChanged,
    ],
  );

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const width = rect.width;
    if (width <= 0) {
      resetDragState();
      return;
    }

    if (dragMode === "pan") {
      resetDragState();
      return;
    }

    if (dragMode === "create" && dragStartX.current !== null && dragCurrentXRef.current !== null) {
      const startTime = xToTime(Math.min(dragStartX.current, dragCurrentXRef.current), width, view);
      const endTime = xToTime(Math.max(dragStartX.current, dragCurrentXRef.current), width, view);

      if (Math.abs(endTime - startTime) > MIN_CREATE_DURATION) {
        const { mode } = useAudioUiStore.getState();
        const { setPendingSelection, patchFile, files, currentFileIndex } = useAudioDomainStore.getState();
        const currentFile = files[currentFileIndex];

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
  }, [containerRef, dragMode, view, resetDragState]);

  // Handle mouse leave
  const handleMouseLeave = useCallback(() => {
    if (isDragging) {
      resetDragState();
    } else {
      setCursorIfChanged("crosshair");
    }
  }, [isDragging, resetDragState, setCursorIfChanged]);

  // Handle wheel (zoom)
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const { setZoom } = useAudioUiStore.getState();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, view.zoom * delta));
      setZoom(newZoom);
    },
    [view.zoom],
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
