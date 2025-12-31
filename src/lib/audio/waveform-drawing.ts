import type { Annotation, Label } from "./types";

export interface DrawContext {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
}

export interface TimeRange {
  start: number;
  end: number;
}

export interface ViewState {
  zoom: number;
  panOffset: number;
  duration: number;
}

// Pure utility functions for time/position conversion
export function timeToX(time: number, width: number, view: ViewState): number {
  const { panOffset, duration, zoom } = view;
  return ((time - panOffset) / duration) * width * zoom;
}

export function xToTime(x: number, width: number, view: ViewState): number {
  const { panOffset, duration, zoom } = view;
  return panOffset + (x / width) * (duration / zoom);
}

export function getVisibleTimeRange(view: ViewState): TimeRange {
  const { panOffset, duration, zoom } = view;
  return {
    start: panOffset,
    end: panOffset + duration / zoom,
  };
}

// Drawing functions - all pure, testable
export function drawBackground(dc: DrawContext): void {
  const { ctx, width, height } = dc;
  ctx.fillStyle = "#0d0d0f";
  ctx.fillRect(0, 0, width, height);
}

export function drawGrid(dc: DrawContext, waveformHeight: number): void {
  const { ctx, width } = dc;
  ctx.strokeStyle = "#1a1a24";
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const y = (waveformHeight / 4) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

export function drawWaveform(dc: DrawContext, samples: Float32Array, view: ViewState, waveformHeight: number): void {
  const { ctx, width } = dc;
  const { panOffset, duration, zoom } = view;
  const middle = waveformHeight / 2;

  if (samples.length === 0 || duration === 0) return;

  // Calculate visible time range
  const visibleStart = panOffset;
  const visibleEnd = panOffset + duration / zoom;

  // Calculate which sample indices are visible
  const startSampleIndex = Math.max(0, Math.floor((visibleStart / duration) * samples.length));
  const endSampleIndex = Math.min(samples.length, Math.ceil((visibleEnd / duration) * samples.length));

  if (startSampleIndex >= endSampleIndex) return;

  ctx.fillStyle = "#3b82f6";

  // Draw each sample in the visible range
  for (let i = startSampleIndex; i < endSampleIndex; i++) {
    const sample = samples[i];

    // Calculate the time position of this sample
    const sampleTime = (i / samples.length) * duration;

    // Convert to screen x using timeToX (consistent with playhead)
    const x = timeToX(sampleTime, width, view);

    // Calculate next sample x to determine bar width
    const nextSampleTime = ((i + 1) / samples.length) * duration;
    const nextX = timeToX(nextSampleTime, width, view);
    const barWidth = Math.max(1, nextX - x);

    // Draw the bar
    const barHeight = sample * middle * 0.95;
    ctx.fillRect(x, middle - barHeight, barWidth, barHeight * 2);
  }
}

export function drawTrimRegion(
  dc: DrawContext,
  trimStart: number,
  trimEnd: number,
  view: ViewState,
  waveformHeight: number,
): void {
  const { ctx, width } = dc;
  const startX = timeToX(trimStart, width, view);
  const endX = timeToX(trimEnd, width, view);

  // Dimmed areas outside trim
  ctx.fillStyle = "#00000080";
  ctx.fillRect(0, 0, Math.max(0, startX), waveformHeight);
  ctx.fillRect(Math.min(width, endX), 0, width - Math.min(width, endX), waveformHeight);

  // Trim boundaries
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

  // Trim region fill
  ctx.fillStyle = "#ef444420";
  ctx.fillRect(Math.max(0, startX), 0, Math.min(width, endX) - Math.max(0, startX), waveformHeight);

  // Labels
  ctx.fillStyle = "#ef4444";
  ctx.font = "11px monospace";
  if (startX > 0 && startX < width - 50) {
    ctx.fillText(`Start: ${trimStart.toFixed(2)}s`, startX + 4, 14);
  }
  if (endX > 50 && endX < width) {
    ctx.textAlign = "right";
    ctx.fillText(`End: ${trimEnd.toFixed(2)}s`, endX - 4, 14);
    ctx.textAlign = "left";
  }
}

export function drawAnnotation(
  dc: DrawContext,
  annotation: Annotation,
  label: Label | undefined,
  isSelected: boolean,
  view: ViewState,
  waveformHeight: number,
): void {
  const { ctx, width } = dc;
  const startX = timeToX(annotation.startTime, width, view);
  const endX = timeToX(annotation.endTime, width, view);

  // Skip if not visible
  if (endX < 0 || startX > width) return;

  const color = label?.color ?? "#666";

  // Fill
  ctx.fillStyle = `${color}30`;
  ctx.fillRect(startX, 0, endX - startX, waveformHeight);

  // Border
  ctx.strokeStyle = isSelected ? "#fff" : color;
  ctx.lineWidth = isSelected ? 2 : 1;
  ctx.strokeRect(startX, 0, endX - startX, waveformHeight);

  // Label text
  if (label && endX - startX > 40) {
    ctx.fillStyle = color;
    ctx.font = "11px sans-serif";
    ctx.fillText(label.name, startX + 4, 14);
  }

  // Resize handles for selected
  if (isSelected) {
    ctx.fillStyle = "#fff";
    ctx.fillRect(startX - 3, waveformHeight / 2 - 12, 6, 24);
    ctx.fillRect(endX - 3, waveformHeight / 2 - 12, 6, 24);
  }
}

export function drawAnnotations(
  dc: DrawContext,
  annotations: Annotation[],
  labelMap: Map<string, Label>,
  selectedId: string | null,
  view: ViewState,
  waveformHeight: number,
): void {
  for (const annotation of annotations) {
    const label = labelMap.get(annotation.labelId);
    const isSelected = annotation.id === selectedId;
    drawAnnotation(dc, annotation, label, isSelected, view, waveformHeight);
  }
}

export function drawSelection(
  dc: DrawContext,
  startTime: number,
  endTime: number,
  view: ViewState,
  waveformHeight: number,
  isDashed = true,
): void {
  const { ctx, width } = dc;
  const startX = timeToX(startTime, width, view);
  const endX = timeToX(endTime, width, view);

  ctx.fillStyle = "#3b82f640";
  ctx.fillRect(startX, 0, endX - startX, waveformHeight);

  ctx.strokeStyle = "#3b82f6";
  ctx.lineWidth = 2;
  if (isDashed) {
    ctx.setLineDash([4, 4]);
  }
  ctx.strokeRect(startX, 0, endX - startX, waveformHeight);
  ctx.setLineDash([]);

  // Resize handles
  ctx.fillStyle = "#3b82f6";
  ctx.fillRect(startX - 3, waveformHeight / 2 - 12, 6, 24);
  ctx.fillRect(endX - 3, waveformHeight / 2 - 12, 6, 24);
}

export function drawDragPreview(
  dc: DrawContext,
  startX: number,
  currentX: number,
  waveformHeight: number,
  isTrimMode: boolean,
): void {
  const { ctx } = dc;
  const left = Math.min(startX, currentX);
  const right = Math.max(startX, currentX);

  ctx.fillStyle = isTrimMode ? "#ef444430" : "#3b82f640";
  ctx.fillRect(left, 0, right - left, waveformHeight);

  ctx.strokeStyle = isTrimMode ? "#ef4444" : "#3b82f6";
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.strokeRect(left, 0, right - left, waveformHeight);
  ctx.setLineDash([]);
}

export function drawPlayhead(dc: DrawContext, currentTime: number, view: ViewState, waveformHeight: number): void {
  const { ctx, width } = dc;
  const x = timeToX(currentTime, width, view);

  if (x < 0 || x > width) return;

  ctx.strokeStyle = "#ef4444";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, waveformHeight);
  ctx.stroke();

  // Triangle indicator
  ctx.fillStyle = "#ef4444";
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x - 5, 8);
  ctx.lineTo(x + 5, 8);
  ctx.closePath();
  ctx.fill();
}

function formatTimeLabel(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins > 0) {
    return `${mins}:${secs.toFixed(1).padStart(4, "0")}`;
  }
  return `${secs.toFixed(1)}s`;
}

export function drawTimeAxis(dc: DrawContext, view: ViewState, waveformHeight: number): void {
  const { ctx, width } = dc;
  const timelineY = waveformHeight + 16;
  const { start: startTime, end: endTime } = getVisibleTimeRange(view);
  const visibleDuration = endTime - startTime;
  const step = 10 ** Math.floor(Math.log10(visibleDuration)) / 2;

  ctx.strokeStyle = "#333";
  ctx.fillStyle = "#666";
  ctx.font = "10px monospace";
  ctx.textAlign = "center";
  ctx.lineWidth = 1;

  for (let time = Math.ceil(startTime / step) * step; time <= endTime; time += step) {
    const x = timeToX(time, width, view);

    if (x >= 0 && x <= width) {
      ctx.beginPath();
      ctx.moveTo(x, waveformHeight);
      ctx.lineTo(x, waveformHeight + 4);
      ctx.stroke();

      const label = formatTimeLabel(time);
      const labelWidth = ctx.measureText(label).width;
      ctx.fillText(label, x - labelWidth / 2, timelineY);
    }
  }

  // Edge labels
  ctx.fillStyle = "#666";
  ctx.fillText(formatTimeLabel(startTime), 4, timelineY);

  const endLabel = formatTimeLabel(endTime);
  const endLabelWidth = ctx.measureText(endLabel).width;
  ctx.fillText(endLabel, width - endLabelWidth - 4, timelineY);
}
