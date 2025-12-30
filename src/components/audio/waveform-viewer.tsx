import { useEffect, useRef, useState, useCallback } from "react";

import type { Annotation, Label } from "@/lib/audio/types";

import { LabelSelector } from "./label-selector";

export interface Selection {
  startTime: number;
  endTime: number;
  startX: number;
  endX: number;
}

interface WaveformViewerProps {
  audioUrl: string;
  currentTime: number;
  zoom: number;
  panOffset: number;
  annotations: Annotation[];
  labels: Label[];
  lastUsedLabel: string;
  fileId: string;
  onZoomChange: (zoom: number) => void;
  onPanChange: (offset: number) => void;
  onAddAnnotation: (annotation: Annotation) => void;
  onRemoveAnnotation: (annotationId: string) => void;
  onUpdateAnnotation?: (annotationId: string, updates: { startTime?: number; endTime?: number }) => void;
  mode: "annotate" | "trim";
  trimStart?: number;
  trimEnd?: number;
  onSetTrimRegion: (startTime: number, endTime: number) => void;
  onSelectionChange?: (selection: Selection | null) => void;
  pendingSelection?: Selection | null;
  selectedAnnotationId?: string | null;
  onAnnotationSelect?: (annotationId: string | null) => void;
}

type DragMode = "none" | "create" | "move" | "resize-start" | "resize-end" | "pan";

function formatTimeLabel(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins > 0) {
    return `${mins}:${secs.toFixed(1).padStart(4, "0")}`;
  }
  return `${secs.toFixed(1)}s`;
}

export function WaveformViewer({
  audioUrl,
  currentTime,
  zoom,
  panOffset,
  annotations,
  labels,
  lastUsedLabel,
  fileId,
  onZoomChange,
  onPanChange,
  onAddAnnotation,
  onRemoveAnnotation,
  onUpdateAnnotation,
  mode,
  trimStart,
  trimEnd,
  onSetTrimRegion,
  onSelectionChange,
  pendingSelection,
  selectedAnnotationId,
  onAnnotationSelect,
}: WaveformViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [waveformData, setWaveformData] = useState<Float32Array | null>(null);
  const [duration, setDuration] = useState(0);
  const [showLabelSelector, setShowLabelSelector] = useState(false);
  const [selectorPosition, setSelectorPosition] = useState({ x: 0, y: 0 });

  // Drag state - use refs for values needed immediately during drag
  const [dragMode, setDragMode] = useState<DragMode>("none");
  const dragStartXRef = useRef<number | null>(null);
  const dragStartSelectionRef = useRef<Selection | null>(null);
  const [dragCurrentX, setDragCurrentX] = useState<number | null>(null);
  const panStartRef = useRef({ x: 0, offset: 0 });

  // Cursor state
  const [cursorStyle, setCursorStyle] = useState("crosshair");

  // Helper: convert X position to time
  const xToTime = useCallback(
    (x: number, width: number) => {
      return panOffset + (x / width) * (duration / zoom);
    },
    [panOffset, duration, zoom],
  );

  // Helper: convert time to X position
  const timeToX = useCallback(
    (time: number, width: number) => {
      return ((time - panOffset) / duration) * width * zoom;
    },
    [panOffset, duration, zoom],
  );

  useEffect(() => {
    const loadAudio = async () => {
      try {
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        const audioContext = new AudioContext();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        const channelData = audioBuffer.getChannelData(0);
        const samples = 2000;
        const blockSize = Math.floor(channelData.length / samples);
        const filteredData = new Float32Array(samples);

        for (let i = 0; i < samples; i++) {
          let sum = 0;
          for (let j = 0; j < blockSize; j++) {
            sum += Math.abs(channelData[i * blockSize + j]);
          }
          filteredData[i] = sum / blockSize;
        }

        setWaveformData(filteredData);
        setDuration(audioBuffer.duration);
      } catch (error) {
        console.error("[v0] Error loading audio:", error);
      }
    };

    loadAudio();
  }, [audioUrl]);

  // Draw waveform
  useEffect(() => {
    if (!canvasRef.current || !waveformData) return;

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
    const waveformHeight = height - 24; // Reserve space for time labels
    const middle = waveformHeight / 2;

    // Background
    ctx.fillStyle = "#0d0d0f";
    ctx.fillRect(0, 0, width, height);

    // Grid lines
    ctx.strokeStyle = "#1a1a24";
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const y = (waveformHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Trim mode visualization
    if (mode === "trim" && trimStart != null && trimEnd != null) {
      const startX = timeToX(trimStart, width);
      const endX = timeToX(trimEnd, width);

      ctx.fillStyle = "#00000080";
      ctx.fillRect(0, 0, Math.max(0, startX), waveformHeight);
      ctx.fillRect(Math.min(width, endX), 0, width - Math.min(width, endX), waveformHeight);

      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 3;
      if (startX >= 0 && startX <= width) {
        ctx.beginPath();
        ctx.moveTo(startX, 0);
        ctx.lineTo(startX, waveformHeight);
        ctx.stroke();
      }
      if (endX >= 0 && endX <= width) {
        ctx.beginPath();
        ctx.moveTo(endX, 0);
        ctx.lineTo(endX, waveformHeight);
        ctx.stroke();
      }

      ctx.fillStyle = "#ef444420";
      ctx.fillRect(Math.max(0, startX), 0, Math.min(width, endX) - Math.max(0, startX), waveformHeight);

      ctx.fillStyle = "#ef4444";
      ctx.font = "11px monospace";
      if (startX > 0 && startX < width - 50) {
        ctx.fillText(`Start: ${trimStart.toFixed(2)}s`, startX + 4, 14);
      }
      if (endX > 50 && endX < width) {
        const text = `End: ${trimEnd.toFixed(2)}s`;
        const metrics = ctx.measureText(text);
        ctx.fillText(text, endX - metrics.width - 4, 14);
      }
    }

    // Draw annotations
    if (mode === "annotate") {
      for (const annotation of annotations) {
        const label = labels.find((l) => l.id === annotation.labelId);
        if (!label) continue;

        const startX = timeToX(annotation.startTime, width);
        const endX = timeToX(annotation.endTime, width);

        if (endX < 0 || startX > width) continue;

        const isSelected = annotation.id === selectedAnnotationId;

        // Background fill
        ctx.fillStyle = isSelected ? `${label.color}40` : `${label.color}20`;
        ctx.fillRect(Math.max(0, startX), 0, Math.min(width, endX) - Math.max(0, startX), waveformHeight);

        // Border lines
        ctx.strokeStyle = label.color;
        ctx.lineWidth = isSelected ? 3 : 2;
        ctx.beginPath();
        ctx.moveTo(startX, 0);
        ctx.lineTo(startX, waveformHeight);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(endX, 0);
        ctx.lineTo(endX, waveformHeight);
        ctx.stroke();

        // Label name
        if (startX > 0 && startX < width - 50) {
          ctx.fillStyle = label.color;
          ctx.font = isSelected ? "bold 11px monospace" : "11px monospace";
          ctx.fillText(label.name, startX + 4, 14);
        }

        // Draw resize handles when selected
        if (isSelected) {
          ctx.fillStyle = label.color;
          // Left handle
          if (startX >= 0 && startX <= width) {
            ctx.fillRect(startX - 4, middle - 15, 8, 30);
          }
          // Right handle
          if (endX >= 0 && endX <= width) {
            ctx.fillRect(endX - 4, middle - 15, 8, 30);
          }
        }
      }
    }

    // Draw waveform
    ctx.strokeStyle = "#a78bfa";
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    const startSample = Math.floor((panOffset / duration) * waveformData.length);
    const samplesVisible = Math.ceil(waveformData.length / zoom);

    for (let i = 0; i < width; i++) {
      const sampleIndex = Math.floor(startSample + (i / width) * samplesVisible);
      if (sampleIndex >= 0 && sampleIndex < waveformData.length) {
        const value = waveformData[sampleIndex];
        const y = middle - value * middle * 0.9;
        if (i === 0) {
          ctx.moveTo(i, y);
        } else {
          ctx.lineTo(i, y);
        }
      }
    }
    ctx.stroke();

    ctx.beginPath();
    for (let i = 0; i < width; i++) {
      const sampleIndex = Math.floor(startSample + (i / width) * samplesVisible);
      if (sampleIndex >= 0 && sampleIndex < waveformData.length) {
        const value = waveformData[sampleIndex];
        const y = middle + value * middle * 0.9;
        if (i === 0) {
          ctx.moveTo(i, y);
        } else {
          ctx.lineTo(i, y);
        }
      }
    }
    ctx.stroke();

    // Show active drag selection (creating new selection)
    if (dragMode === "create" && dragStartXRef.current !== null && dragCurrentX !== null) {
      const startX = Math.min(dragStartXRef.current, dragCurrentX);
      const endX = Math.max(dragStartXRef.current, dragCurrentX);

      const selectionColor = mode === "trim" ? "#ef4444" : "#3b82f6";
      ctx.fillStyle = `${selectionColor}40`;
      ctx.fillRect(startX, 0, endX - startX, waveformHeight);
      ctx.strokeStyle = selectionColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(startX, 0, endX - startX, waveformHeight);
    }

    // Show pending selection (from actions overlay) - also show during resize/move
    if (pendingSelection && mode === "annotate") {
      const selStartX = timeToX(pendingSelection.startTime, width);
      const selEndX = timeToX(pendingSelection.endTime, width);

      ctx.fillStyle = "rgba(59, 130, 246, 0.25)";
      ctx.fillRect(Math.max(0, selStartX), 0, Math.min(width, selEndX) - Math.max(0, selStartX), waveformHeight);

      // Border lines
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 2;
      if (selStartX >= 0 && selStartX <= width) {
        ctx.beginPath();
        ctx.moveTo(selStartX, 0);
        ctx.lineTo(selStartX, waveformHeight);
        ctx.stroke();
      }
      if (selEndX >= 0 && selEndX <= width) {
        ctx.beginPath();
        ctx.moveTo(selEndX, 0);
        ctx.lineTo(selEndX, waveformHeight);
        ctx.stroke();
      }

      // Draw resize handles
      ctx.fillStyle = "#3b82f6";
      if (selStartX >= 0 && selStartX <= width) {
        ctx.fillRect(selStartX - 4, middle - 15, 8, 30);
      }
      if (selEndX >= 0 && selEndX <= width) {
        ctx.fillRect(selEndX - 4, middle - 15, 8, 30);
      }
    }

    // Playhead
    const playheadX = timeToX(currentTime, width);
    if (playheadX >= 0 && playheadX <= width) {
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, waveformHeight);
      ctx.stroke();

      // Playhead triangle
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.moveTo(playheadX - 5, 0);
      ctx.lineTo(playheadX + 5, 0);
      ctx.lineTo(playheadX, 8);
      ctx.closePath();
      ctx.fill();
    }

    // Time labels at the bottom
    ctx.fillStyle = "#525252";
    ctx.font = "10px monospace";
    const timelineY = height - 6;

    // Draw time axis background
    ctx.fillStyle = "#0d0d0f";
    ctx.fillRect(0, waveformHeight, width, 24);

    // Draw time markers
    const visibleDuration = duration / zoom;
    const startTime = panOffset;
    const endTime = panOffset + visibleDuration;

    // Determine appropriate time interval based on visible duration
    let interval: number;
    if (visibleDuration <= 5) {
      interval = 0.5;
    } else if (visibleDuration <= 15) {
      interval = 1;
    } else if (visibleDuration <= 60) {
      interval = 5;
    } else if (visibleDuration <= 300) {
      interval = 30;
    } else {
      interval = 60;
    }

    // Find first marker
    const firstMarker = Math.ceil(startTime / interval) * interval;

    ctx.fillStyle = "#525252";
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1;

    for (let time = firstMarker; time <= endTime; time += interval) {
      const x = timeToX(time, width);
      if (x >= 0 && x <= width) {
        // Draw tick
        ctx.beginPath();
        ctx.moveTo(x, waveformHeight);
        ctx.lineTo(x, waveformHeight + 4);
        ctx.stroke();

        // Draw label
        const label = formatTimeLabel(time);
        const labelWidth = ctx.measureText(label).width;
        ctx.fillText(label, x - labelWidth / 2, timelineY);
      }
    }

    // Draw edge labels (start and end of visible area)
    ctx.fillStyle = "#666";
    const startLabel = formatTimeLabel(startTime);
    ctx.fillText(startLabel, 4, timelineY);

    const endLabel = formatTimeLabel(endTime);
    const endLabelWidth = ctx.measureText(endLabel).width;
    ctx.fillText(endLabel, width - endLabelWidth - 4, timelineY);
  }, [
    waveformData,
    currentTime,
    zoom,
    panOffset,
    duration,
    annotations,
    labels,
    dragMode,
    dragCurrentX,
    mode,
    trimStart,
    trimEnd,
    pendingSelection,
    selectedAnnotationId,
    timeToX,
  ]);

  // Determine what's under the cursor and set appropriate cursor style
  const getHitTarget = useCallback(
    (x: number, width: number): { type: DragMode; annotationId?: string } => {
      const handleThreshold = 8;

      // Check pending selection handles first
      if (pendingSelection && mode === "annotate") {
        const selStartX = timeToX(pendingSelection.startTime, width);
        const selEndX = timeToX(pendingSelection.endTime, width);

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
          const startX = timeToX(annotation.startTime, width);
          const endX = timeToX(annotation.endTime, width);

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
          const startX = timeToX(annotation.startTime, width);
          const endX = timeToX(annotation.endTime, width);

          if (x >= startX && x <= endX) {
            return { type: "move", annotationId: annotation.id };
          }
        }
      }

      return { type: "create" };
    },
    [pendingSelection, selectedAnnotationId, annotations, mode, timeToX],
  );

  // Update cursor based on mouse position
  const handleMouseMoveForCursor = useCallback(
    (e: React.MouseEvent) => {
      if (dragMode !== "none") return;
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const width = rect.width;

      const hitTarget = getHitTarget(x, width);

      switch (hitTarget.type) {
        case "resize-start":
        case "resize-end":
          setCursorStyle("ew-resize");
          break;
        case "move":
          setCursorStyle("grab");
          break;
        default:
          setCursorStyle("crosshair");
      }
    },
    [dragMode, getHitTarget],
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;

    // Middle click = pan
    if (e.button === 1) {
      e.preventDefault();
      setDragMode("pan");
      panStartRef.current = { x: e.clientX, offset: panOffset };
      setCursorStyle("grabbing");
      return;
    }

    if (e.button !== 0) return;

    const hitTarget = getHitTarget(x, width);

    if (hitTarget.type === "resize-start" || hitTarget.type === "resize-end") {
      setDragMode(hitTarget.type);
      dragStartXRef.current = x;
      setDragCurrentX(x);

      // Store initial state for dragging
      if (pendingSelection) {
        dragStartSelectionRef.current = pendingSelection;
      } else if (hitTarget.annotationId) {
        // Resizing an annotation
        const annotation = annotations.find((a) => a.id === hitTarget.annotationId);
        if (annotation) {
          dragStartSelectionRef.current = {
            startTime: annotation.startTime,
            endTime: annotation.endTime,
            startX: timeToX(annotation.startTime, width),
            endX: timeToX(annotation.endTime, width),
          };
          // Store which annotation we're editing
          dragStartXRef.current = x;
          onAnnotationSelect?.(hitTarget.annotationId);
        }
      }
      setCursorStyle("ew-resize");
    } else if (hitTarget.type === "move") {
      if (hitTarget.annotationId) {
        // Start dragging an annotation
        const annotation = annotations.find((a) => a.id === hitTarget.annotationId);
        if (annotation) {
          setDragMode("move");
          dragStartXRef.current = x;
          setDragCurrentX(x);
          dragStartSelectionRef.current = {
            startTime: annotation.startTime,
            endTime: annotation.endTime,
            startX: timeToX(annotation.startTime, width),
            endX: timeToX(annotation.endTime, width),
          };
          onAnnotationSelect?.(hitTarget.annotationId);
          onSelectionChange?.(null); // Clear pending selection
          setCursorStyle("grabbing");
        }
      } else if (pendingSelection) {
        // Moving the pending selection
        setDragMode("move");
        dragStartXRef.current = x;
        setDragCurrentX(x);
        dragStartSelectionRef.current = pendingSelection;
        setCursorStyle("grabbing");
      }
    } else {
      // Creating new selection
      setDragMode("create");
      dragStartXRef.current = x;
      setDragCurrentX(x);
      onAnnotationSelect?.(null); // Deselect any annotation
      onSelectionChange?.(null); // Clear pending selection while dragging
      setCursorStyle("crosshair");
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;

    if (dragMode === "pan") {
      const dx = e.clientX - panStartRef.current.x;
      const panDelta = (dx / width) * (duration / zoom);
      const newOffset = Math.max(0, Math.min(duration - duration / zoom, panStartRef.current.offset - panDelta));
      onPanChange(newOffset);
      return;
    }

    if (dragMode === "create") {
      setDragCurrentX(x);
      return;
    }

    const dragStartSelection = dragStartSelectionRef.current;
    const dragStartX = dragStartXRef.current;

    if ((dragMode === "resize-start" || dragMode === "resize-end" || dragMode === "move") && dragStartSelection) {
      const deltaX = x - (dragStartX ?? 0);
      const deltaTime = (deltaX / width) * (duration / zoom);

      let newSelection: Selection;

      if (dragMode === "resize-start") {
        const newStartTime = Math.max(
          0,
          Math.min(dragStartSelection.endTime - 0.05, dragStartSelection.startTime + deltaTime),
        );
        newSelection = {
          ...dragStartSelection,
          startTime: newStartTime,
          startX: timeToX(newStartTime, width),
        };
      } else if (dragMode === "resize-end") {
        const newEndTime = Math.max(
          dragStartSelection.startTime + 0.05,
          Math.min(duration, dragStartSelection.endTime + deltaTime),
        );
        newSelection = {
          ...dragStartSelection,
          endTime: newEndTime,
          endX: timeToX(newEndTime, width),
        };
      } else {
        // Move
        const selectionDuration = dragStartSelection.endTime - dragStartSelection.startTime;
        let newStartTime = dragStartSelection.startTime + deltaTime;
        let newEndTime = dragStartSelection.endTime + deltaTime;

        // Clamp to bounds
        if (newStartTime < 0) {
          newStartTime = 0;
          newEndTime = selectionDuration;
        }
        if (newEndTime > duration) {
          newEndTime = duration;
          newStartTime = duration - selectionDuration;
        }

        newSelection = {
          startTime: newStartTime,
          endTime: newEndTime,
          startX: timeToX(newStartTime, width),
          endX: timeToX(newEndTime, width),
        };
      }

      // Update annotation or pending selection
      if (selectedAnnotationId && onUpdateAnnotation) {
        const updates: { startTime?: number; endTime?: number } = {};
        if (dragMode === "resize-start" || dragMode === "move") {
          updates.startTime = newSelection.startTime;
        }
        if (dragMode === "resize-end" || dragMode === "move") {
          updates.endTime = newSelection.endTime;
        }
        onUpdateAnnotation(selectedAnnotationId, updates);
      } else {
        onSelectionChange?.(newSelection);
      }
      return;
    }

    // Update cursor when not dragging
    handleMouseMoveForCursor(e);
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const width = rect.width;
    const dragStartX = dragStartXRef.current;

    if (dragMode === "pan") {
      setDragMode("none");
      setCursorStyle("crosshair");
      return;
    }

    if (dragMode === "create" && dragStartX !== null && dragCurrentX !== null) {
      const startTime = xToTime(Math.min(dragStartX, dragCurrentX), width);
      const endTime = xToTime(Math.max(dragStartX, dragCurrentX), width);

      if (Math.abs(endTime - startTime) > 0.1) {
        if (mode === "trim") {
          onSetTrimRegion(startTime, endTime);
        } else if (onSelectionChange) {
          onSelectionChange({
            startTime,
            endTime,
            startX: Math.min(dragStartX, dragCurrentX),
            endX: Math.max(dragStartX, dragCurrentX),
          });
        } else {
          // Fallback to popup selector
          setSelectorPosition({ x: e.clientX, y: e.clientY });
          setShowLabelSelector(true);
        }
      }
    }

    // Reset drag state
    setDragMode("none");
    dragStartXRef.current = null;
    setDragCurrentX(null);
    dragStartSelectionRef.current = null;
    setCursorStyle("crosshair");
  };

  const handleMouseLeave = () => {
    if (dragMode !== "none") {
      setDragMode("none");
      dragStartXRef.current = null;
      setDragCurrentX(null);
      dragStartSelectionRef.current = null;
    }
    setCursorStyle("crosshair");
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(1, Math.min(20, zoom * delta));
    onZoomChange(newZoom);
  };

  const handleLabelSelect = (labelId: string) => {
    const dragStartX = dragStartXRef.current;
    if (!containerRef.current || dragStartX === null || dragCurrentX === null) return;

    const rect = containerRef.current.getBoundingClientRect();
    const width = rect.width;

    const startTime = xToTime(Math.min(dragStartX, dragCurrentX), width);
    const endTime = xToTime(Math.max(dragStartX, dragCurrentX), width);

    onAddAnnotation({
      id: `${Date.now()}`,
      fileId,
      labelId,
      startTime,
      endTime,
    });

    setShowLabelSelector(false);
  };

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

      {mode === "annotate" && showLabelSelector && (
        <LabelSelector
          labels={labels}
          defaultLabelId={lastUsedLabel}
          position={selectorPosition}
          onSelect={handleLabelSelect}
          onClose={() => setShowLabelSelector(false)}
        />
      )}
    </div>
  );
}
