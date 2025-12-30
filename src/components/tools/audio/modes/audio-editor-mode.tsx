import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2, Trash2, Play as PlayIcon } from "lucide-react";

import type { AudioFileData, TrimRegion, AudioSegment, AudioWorkflow } from "@/lib/tools/types";
import { formatTimeShort, formatTime, generateId } from "@/lib/tools/utils";

import type { Hotkey } from "@/components/tools/editor/hotkeys-display";
import { EditorHeader } from "@/components/tools/editor/editor-header";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";

import type { LabelConfig } from "../audio-tool";

// Use a perceptually distinct color palette for labels (colorblind-friendly)
const LABEL_COLORS = [
  "#2563eb", // blue
  "#dc2626", // red
  "#16a34a", // green
  "#9333ea", // purple
  "#ea580c", // orange
  "#0891b2", // cyan
  "#db2777", // pink
  "#ca8a04", // yellow
  "#4f46e5", // indigo
  "#059669", // emerald
  "#e11d48", // rose
  "#7c3aed", // violet
  "#0284c7", // sky
  "#65a30d", // lime
  "#d97706", // amber
  "#6366f1", // slate indigo
];

// Generate consistent color for a label based on its index in the label list
function getLabelColor(label: string, labels: string[]): string {
  const index = labels.indexOf(label);
  if (index < 0) return LABEL_COLORS[0];
  return LABEL_COLORS[index % LABEL_COLORS.length];
}

interface AudioEditorModeProps {
  file: AudioFileData;
  fileIndex: number;
  totalFiles: number;
  workflow: AudioWorkflow;
  labelConfig: LabelConfig;
  onSave: (updates: { trimOverride?: TrimRegion; segments?: AudioSegment[]; fileLabel?: string }) => void;
  onNavigate: (direction: "prev" | "next") => void;
  onClose: () => void;
}

const PROCESS_HOTKEYS: Hotkey[] = [
  { keys: ["Space"], description: "Play / Pause", category: "Playback" },
  { keys: ["Enter"], description: "Play selection", category: "Playback" },
  { keys: ["←"], description: "Skip back 1s", category: "Playback" },
  { keys: ["→"], description: "Skip forward 1s", category: "Playback" },
  { keys: ["I"], description: "Set in point", category: "Trim" },
  { keys: ["O"], description: "Set out point", category: "Trim" },
  { keys: ["R"], description: "Reset trim", category: "Trim" },
  { keys: ["⌘/Ctrl", "S"], description: "Save & next", category: "Workflow" },
  { keys: [","], description: "Previous file", category: "Workflow" },
  { keys: ["."], description: "Next file", category: "Workflow" },
];

const LABEL_HOTKEYS: Hotkey[] = [
  { keys: ["Space"], description: "Play / Pause", category: "Playback" },
  { keys: ["Enter"], description: "Play selection", category: "Playback" },
  { keys: ["←"], description: "Skip back 1s", category: "Playback" },
  { keys: ["→"], description: "Skip forward 1s", category: "Playback" },
  { keys: ["1-9"], description: "Add segment with label", category: "Label" },
  { keys: ["I"], description: "Set segment start", category: "Label" },
  { keys: ["O"], description: "Create segment to here", category: "Label" },
  { keys: ["Delete"], description: "Delete selected segment", category: "Label" },
  { keys: ["⌘/Ctrl", "S"], description: "Save & next", category: "Workflow" },
  { keys: [","], description: "Previous file", category: "Workflow" },
  { keys: ["."], description: "Next file", category: "Workflow" },
];

export function AudioEditorMode({
  file,
  fileIndex,
  totalFiles,
  workflow,
  labelConfig,
  onSave,
  onNavigate,
  onClose,
}: AudioEditorModeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationRef = useRef<number | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [volume, setVolume] = useState(1);
  const [waveformPeaks, setWaveformPeaks] = useState<Float32Array | null>(null);
  const [sampleRate, setSampleRate] = useState(0);

  // Trim state (for process workflow)
  const initialStart = file.trimOverride?.start ?? 0;
  const initialEnd = file.trimOverride?.end ?? null;
  const [trimStart, setTrimStart] = useState(initialStart);
  const [trimEnd, setTrimEnd] = useState<number | null>(initialEnd);
  const [isDraggingTrim, setIsDraggingTrim] = useState<"start" | "end" | null>(null);

  // Segment state (for label workflow)
  const [segments, setSegments] = useState<AudioSegment[]>(file.segments ?? []);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [pendingSegmentStart, setPendingSegmentStart] = useState<number | null>(null);
  const [isDraggingSegment, setIsDraggingSegment] = useState<{
    id: string;
    edge: "start" | "end";
  } | null>(null);

  // Selection state (time range selection for both workflows)
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);
  const [isSelectingRange, setIsSelectingRange] = useState(false);
  const [selectionStart, setSelectionStart] = useState<number | null>(null);

  // Panning state - use ref for pan start to avoid stale closure issues
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; scrollOffset: number } | null>(null);

  // Reset state when file changes
  useEffect(() => {
    setTrimStart(file.trimOverride?.start ?? 0);
    setTrimEnd(file.trimOverride?.end ?? null);
    setSegments(file.segments ?? []);
    setSelectedSegmentId(null);
    setPendingSegmentStart(null);
    setCurrentTime(0);
    setZoom(1);
    setScrollOffset(0);
    setIsPlaying(false);
    setSelection(null);
  }, [file.trimOverride?.start, file.trimOverride?.end, file.segments]);

  const hasChanges =
    workflow === "process"
      ? trimStart !== initialStart || trimEnd !== initialEnd
      : JSON.stringify(segments) !== JSON.stringify(file.segments ?? []);

  // Decode audio
  useEffect(() => {
    const loadAudio = async () => {
      setIsLoading(true);
      try {
        const arrayBuffer = await file.file.arrayBuffer();
        const audioContext = new AudioContext();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        setDuration(audioBuffer.duration);
        setSampleRate(audioBuffer.sampleRate);
        if (workflow === "process") {
          setTrimEnd((prev) => prev ?? audioBuffer.duration);
        }

        const channelData = audioBuffer.getChannelData(0);
        const samplesPerPixel = Math.max(1, Math.floor(channelData.length / 4000));
        const peaks = new Float32Array(Math.ceil(channelData.length / samplesPerPixel));

        for (let i = 0; i < peaks.length; i++) {
          let max = 0;
          const start = i * samplesPerPixel;
          const end = Math.min(start + samplesPerPixel, channelData.length);
          for (let j = start; j < end; j++) {
            const abs = Math.abs(channelData[j]);
            if (abs > max) max = abs;
          }
          peaks[i] = max;
        }
        setWaveformPeaks(peaks);

        const audio = new Audio();
        audio.src = URL.createObjectURL(file.file);
        audio.preload = "auto";
        audioRef.current = audio;
        audio.addEventListener("ended", () => setIsPlaying(false));

        audioContext.close();
        setIsLoading(false);
      } catch (error) {
        console.error("Failed to decode audio:", error);
        setIsLoading(false);
      }
    };

    loadAudio();

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [file.file, workflow]);

  // Helper to convert time to X position
  const timeToX = useCallback(
    (time: number, width: number) => {
      const totalWidth = width * zoom;
      const visibleStart = scrollOffset / totalWidth;
      const visibleEnd = (scrollOffset + width) / totalWidth;
      return ((time / duration - visibleStart) / (visibleEnd - visibleStart)) * width;
    },
    [zoom, scrollOffset, duration],
  );

  // Helper to convert X position to time
  const xToTime = useCallback(
    (x: number, width: number) => {
      const totalWidth = width * zoom;
      const visibleStart = scrollOffset / totalWidth;
      const visibleEnd = (scrollOffset + width) / totalWidth;
      return (visibleStart + (x / width) * (visibleEnd - visibleStart)) * duration;
    },
    [zoom, scrollOffset, duration],
  );

  // Draw waveform
  useEffect(() => {
    if (!canvasRef.current || !waveformPeaks) return;

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
    const centerY = height / 2;

    // Background
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, width, height);

    const totalWidth = width * zoom;
    const visibleStart = scrollOffset / totalWidth;
    const visibleEnd = (scrollOffset + width) / totalWidth;

    const startPeak = Math.floor(visibleStart * waveformPeaks.length);
    const endPeak = Math.ceil(visibleEnd * waveformPeaks.length);
    const peaksToShow = endPeak - startPeak;
    const barWidth = Math.max(1, width / peaksToShow - 1);

    // Draw selection highlight (both workflows)
    if (selection) {
      const selStartX = timeToX(selection.start, width);
      const selEndX = timeToX(selection.end, width);
      ctx.fillStyle = "rgba(59, 130, 246, 0.2)";
      ctx.fillRect(Math.max(0, selStartX), 0, Math.min(width, selEndX) - Math.max(0, selStartX), height);
      // Selection borders
      ctx.fillStyle = "#3b82f6";
      if (selStartX >= 0 && selStartX <= width) {
        ctx.fillRect(selStartX - 1, 0, 2, height);
      }
      if (selEndX >= 0 && selEndX <= width) {
        ctx.fillRect(selEndX - 1, 0, 2, height);
      }
    }

    if (workflow === "process") {
      // === PROCESS WORKFLOW: Show trim region ===
      const trimStartX = timeToX(trimStart, width);
      const trimEndX = timeToX(trimEnd ?? duration, width);

      // Dim outside trim
      ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      ctx.fillRect(0, 0, Math.max(0, trimStartX), height);
      ctx.fillRect(Math.min(width, trimEndX), 0, width - Math.min(width, trimEndX), height);

      // Highlight selection
      ctx.fillStyle = "rgba(34, 197, 94, 0.1)";
      ctx.fillRect(Math.max(0, trimStartX), 0, Math.min(width, trimEndX) - Math.max(0, trimStartX), height);

      // Draw waveform bars
      for (let i = 0; i < peaksToShow; i++) {
        const peakIndex = startPeak + i;
        if (peakIndex < 0 || peakIndex >= waveformPeaks.length) continue;

        const peak = waveformPeaks[peakIndex];
        const x = i * (width / peaksToShow);
        const barHeight = peak * (height - 20);

        const time = (peakIndex / waveformPeaks.length) * duration;
        ctx.fillStyle = time >= trimStart && time <= (trimEnd ?? duration) ? "#a3a3a3" : "#404040";
        ctx.fillRect(x, centerY - barHeight / 2, barWidth, barHeight);
      }

      // Trim handles
      ctx.fillStyle = "#22c55e";
      if (trimStartX >= 0 && trimStartX <= width) {
        ctx.fillRect(trimStartX - 2, 0, 4, height);
        ctx.fillStyle = "#16a34a";
        ctx.fillRect(trimStartX - 6, height / 2 - 20, 8, 40);
      }

      ctx.fillStyle = "#22c55e";
      if (trimEndX >= 0 && trimEndX <= width) {
        ctx.fillRect(trimEndX - 2, 0, 4, height);
        ctx.fillStyle = "#16a34a";
        ctx.fillRect(trimEndX - 2, height / 2 - 20, 8, 40);
      }
    } else {
      // === LABEL WORKFLOW: Show segments ===

      // Draw waveform bars first (all same color)
      for (let i = 0; i < peaksToShow; i++) {
        const peakIndex = startPeak + i;
        if (peakIndex < 0 || peakIndex >= waveformPeaks.length) continue;

        const peak = waveformPeaks[peakIndex];
        const x = i * (width / peaksToShow);
        const barHeight = peak * (height - 20);
        ctx.fillStyle = "#525252";
        ctx.fillRect(x, centerY - barHeight / 2, barWidth, barHeight);
      }

      // Draw segments
      for (const segment of segments) {
        const startX = timeToX(segment.start, width);
        const endX = timeToX(segment.end, width);
        const segmentWidth = endX - startX;

        if (endX < 0 || startX > width) continue;

        const color = segment.color || getLabelColor(segment.label, labelConfig.labels);
        const isSelected = segment.id === selectedSegmentId;

        // Segment background
        ctx.fillStyle = isSelected ? `${color}40` : `${color}25`;
        ctx.fillRect(Math.max(0, startX), 0, Math.min(segmentWidth, width - startX), height);

        // Segment borders
        ctx.fillStyle = color;
        if (startX >= 0 && startX <= width) {
          ctx.fillRect(startX - 1, 0, 3, height);
        }
        if (endX >= 0 && endX <= width) {
          ctx.fillRect(endX - 2, 0, 3, height);
        }

        // Segment label
        if (segmentWidth > 30) {
          ctx.fillStyle = color;
          ctx.font = "bold 11px sans-serif";
          const labelX = Math.max(startX + 4, 4);
          ctx.fillText(segment.label, labelX, 14);
        }

        // Drag handles (when selected)
        if (isSelected) {
          ctx.fillStyle = color;
          if (startX >= 0 && startX <= width) {
            ctx.fillRect(startX - 4, height / 2 - 15, 8, 30);
          }
          if (endX >= 0 && endX <= width) {
            ctx.fillRect(endX - 4, height / 2 - 15, 8, 30);
          }
        }
      }

      // Draw pending segment (while creating)
      if (pendingSegmentStart !== null) {
        const startX = timeToX(pendingSegmentStart, width);
        ctx.fillStyle = "#ffffff50";
        ctx.fillRect(startX - 1, 0, 2, height);
        ctx.fillStyle = "#ffffff";
        ctx.font = "10px sans-serif";
        ctx.fillText("IN", startX + 4, height - 20);
      }
    }

    // Playhead (both workflows)
    const playheadX = timeToX(currentTime, width);
    if (playheadX >= 0 && playheadX <= width) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(playheadX - 1, 0, 2, height);
      ctx.beginPath();
      ctx.moveTo(playheadX - 6, 0);
      ctx.lineTo(playheadX + 6, 0);
      ctx.lineTo(playheadX, 10);
      ctx.closePath();
      ctx.fill();
    }

    // Time labels
    ctx.fillStyle = "#737373";
    ctx.font = "10px monospace";
    const numLabels = Math.ceil(zoom * 5);
    for (let i = 0; i <= numLabels; i++) {
      const time = visibleStart * duration + (i / numLabels) * (visibleEnd - visibleStart) * duration;
      const x = (i / numLabels) * width;
      ctx.fillText(formatTimeShort(time), x, height - 4);
    }
  }, [
    waveformPeaks,
    zoom,
    scrollOffset,
    trimStart,
    trimEnd,
    duration,
    currentTime,
    workflow,
    segments,
    selectedSegmentId,
    pendingSegmentStart,
    selection,
    timeToX,
    labelConfig.labels,
  ]);

  // Animation loop
  useEffect(() => {
    if (!isPlaying || !audioRef.current) return;

    const updateTime = () => {
      if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
      animationRef.current = requestAnimationFrame(updateTime);
    };

    animationRef.current = requestAnimationFrame(updateTime);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // === Playback handlers ===
  const handlePlayPause = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const handleSeek = useCallback(
    (time: number) => {
      if (audioRef.current) {
        audioRef.current.currentTime = Math.max(0, Math.min(time, duration));
        setCurrentTime(audioRef.current.currentTime);
      }
    },
    [duration],
  );

  const handlePlaySelection = useCallback(() => {
    if (!audioRef.current) return;

    let start: number;
    let end: number;

    // Priority: selection > selected segment > trim (process mode)
    if (selection) {
      start = selection.start;
      end = selection.end;
    } else if (workflow === "label" && selectedSegmentId) {
      const seg = segments.find((s) => s.id === selectedSegmentId);
      start = seg?.start ?? 0;
      end = seg?.end ?? duration;
    } else if (workflow === "process") {
      start = trimStart;
      end = trimEnd ?? duration;
    } else {
      start = 0;
      end = duration;
    }

    // Store end time in ref to avoid stale closure
    const endTimeRef = { current: end };

    audioRef.current.currentTime = start;
    setCurrentTime(start);
    audioRef.current.play();
    setIsPlaying(true);

    // Use more precise timing check with requestAnimationFrame
    const checkEnd = () => {
      if (!audioRef.current) return;

      if (audioRef.current.currentTime >= endTimeRef.current - 0.05) {
        audioRef.current.pause();
        audioRef.current.currentTime = endTimeRef.current;
        setCurrentTime(endTimeRef.current);
        setIsPlaying(false);
        return;
      }

      if (!audioRef.current.paused) {
        requestAnimationFrame(checkEnd);
      }
    };

    requestAnimationFrame(checkEnd);
  }, [workflow, trimStart, trimEnd, duration, selectedSegmentId, segments, selection]);

  // === Segment handlers ===
  const addSegment = useCallback(
    (label: string, start?: number, end?: number) => {
      const segStart = start ?? pendingSegmentStart ?? currentTime;
      const segEnd = end ?? currentTime;

      if (Math.abs(segEnd - segStart) < 0.01) return; // Too short

      const newSegment: AudioSegment = {
        id: generateId(),
        start: Math.min(segStart, segEnd),
        end: Math.max(segStart, segEnd),
        label,
        color: getLabelColor(label, labelConfig.labels),
      };

      setSegments((prev) => [...prev, newSegment].sort((a, b) => a.start - b.start));
      setPendingSegmentStart(null);
      setSelectedSegmentId(newSegment.id);
    },
    [pendingSegmentStart, currentTime, labelConfig.labels],
  );

  const addSegmentFromSelection = useCallback(
    (label: string) => {
      if (!selection) return;
      addSegment(label, selection.start, selection.end);
      setSelection(null);
    },
    [selection, addSegment],
  );

  const deleteSegment = useCallback(
    (id: string) => {
      setSegments((prev) => prev.filter((s) => s.id !== id));
      if (selectedSegmentId === id) {
        setSelectedSegmentId(null);
      }
    },
    [selectedSegmentId],
  );

  // === Mouse handlers ===
  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = e.currentTarget;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const width = rect.width;
      const clickTime = xToTime(x, width);

      // Middle click = pan
      if (e.button === 1) {
        e.preventDefault();
        setIsPanning(true);
        panStartRef.current = { x: e.clientX, scrollOffset };
        return;
      }

      // Left click
      if (e.button === 0) {
        if (workflow === "process") {
          // Check if clicking on trim handles
          const trimStartX = timeToX(trimStart, width);
          const trimEndX = timeToX(trimEnd ?? duration, width);

          if (Math.abs(x - trimStartX) < 10) {
            setIsDraggingTrim("start");
            return;
          }
          if (Math.abs(x - trimEndX) < 10) {
            setIsDraggingTrim("end");
            return;
          }
          // Click elsewhere = seek
          handleSeek(clickTime);
        } else {
          // Label workflow
          // Check if clicking on a segment edge (for resizing)
          for (const segment of segments) {
            const startX = timeToX(segment.start, width);
            const endX = timeToX(segment.end, width);

            if (Math.abs(x - startX) < 8) {
              setIsDraggingSegment({ id: segment.id, edge: "start" });
              setSelectedSegmentId(segment.id);
              return;
            }
            if (Math.abs(x - endX) < 8) {
              setIsDraggingSegment({ id: segment.id, edge: "end" });
              setSelectedSegmentId(segment.id);
              return;
            }
          }

          // Check if clicking inside a segment (to select it)
          for (const segment of segments) {
            if (clickTime >= segment.start && clickTime <= segment.end) {
              setSelectedSegmentId(segment.id);
              setSelection(null);
              handleSeek(clickTime);
              return;
            }
          }

          // Click on empty area = start selection drag
          setIsSelectingRange(true);
          setSelectionStart(clickTime);
          setSelection({ start: clickTime, end: clickTime });
          setSelectedSegmentId(null);
        }
      }
    },
    [workflow, xToTime, timeToX, trimStart, trimEnd, duration, segments, handleSeek, scrollOffset],
  );

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = e.currentTarget;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const width = rect.width;
      const time = xToTime(x, width);

      // Handle panning
      if (isPanning && panStartRef.current) {
        const deltaX = e.clientX - panStartRef.current.x;
        const maxScroll = (zoom - 1) * (containerRef.current?.clientWidth || 0);
        setScrollOffset(Math.max(0, Math.min(maxScroll, panStartRef.current.scrollOffset - deltaX)));
        return;
      }

      // Handle range selection
      if (isSelectingRange && selectionStart !== null) {
        setSelection({
          start: Math.min(selectionStart, time),
          end: Math.max(selectionStart, time),
        });
        return;
      }

      if (workflow === "process" && isDraggingTrim) {
        if (isDraggingTrim === "start") {
          setTrimStart(Math.max(0, Math.min(time, (trimEnd ?? duration) - 0.01)));
        } else {
          setTrimEnd(Math.max(trimStart + 0.01, Math.min(time, duration)));
        }
      } else if (workflow === "label" && isDraggingSegment) {
        setSegments((prev) =>
          prev.map((s) => {
            if (s.id !== isDraggingSegment.id) return s;
            if (isDraggingSegment.edge === "start") {
              return { ...s, start: Math.max(0, Math.min(time, s.end - 0.01)) };
            }
            return { ...s, end: Math.max(s.start + 0.01, Math.min(time, duration)) };
          }),
        );
      }
    },
    [
      workflow,
      isDraggingTrim,
      isDraggingSegment,
      isSelectingRange,
      selectionStart,
      xToTime,
      trimStart,
      trimEnd,
      duration,
      isPanning,
      zoom,
    ],
  );

  const handleCanvasMouseUp = useCallback(() => {
    if (isPanning) {
      setIsPanning(false);
      panStartRef.current = null;
      return;
    }

    if (isSelectingRange) {
      setIsSelectingRange(false);
      setSelectionStart(null);
      // Keep selection visible for actions
      return;
    }

    setIsDraggingTrim(null);
    setIsDraggingSegment(null);
  }, [isPanning, isSelectingRange]);

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      e.preventDefault();

      // Scroll = zoom at cursor position
      const rect = e.currentTarget.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const width = rect.width;

      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(1, Math.min(100, zoom * delta));

      if (newZoom === zoom) return;

      const mouseRatio = mouseX / width;
      const currentViewStart = scrollOffset / (width * zoom);
      const currentViewWidth = 1 / zoom;
      const mouseTime = currentViewStart + mouseRatio * currentViewWidth;

      const newViewWidth = 1 / newZoom;
      const newViewStart = mouseTime - mouseRatio * newViewWidth;
      const newScrollOffset = newViewStart * width * newZoom;

      setZoom(newZoom);
      setScrollOffset(Math.max(0, Math.min((newZoom - 1) * width, newScrollOffset)));
    },
    [zoom, scrollOffset],
  );

  // === Save handlers ===
  const handleReset = useCallback(() => {
    if (workflow === "process") {
      setTrimStart(0);
      setTrimEnd(duration);
    } else {
      setSegments([]);
      setSelectedSegmentId(null);
    }
    setSelection(null);
  }, [workflow, duration]);

  const handleSave = useCallback(() => {
    if (workflow === "process") {
      const trimRegion: TrimRegion | undefined =
        trimStart !== 0 || (trimEnd !== null && trimEnd !== duration) ? { start: trimStart, end: trimEnd } : undefined;
      onSave({ trimOverride: trimRegion });
    } else {
      onSave({ segments: segments.length > 0 ? segments : undefined });
    }
  }, [workflow, trimStart, trimEnd, duration, segments, onSave]);

  const handleFitToView = useCallback(() => {
    setZoom(1);
    setScrollOffset(0);
  }, []);

  // === Keyboard shortcuts ===
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      const isMod = e.metaKey || e.ctrlKey;

      // === PLAYBACK (both workflows) ===
      if (e.code === "Space") {
        e.preventDefault();
        handlePlayPause();
        return;
      }

      if (e.key === "Enter" && !isMod) {
        e.preventDefault();
        handlePlaySelection();
        return;
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handleSeek(currentTime - (e.shiftKey ? 5 : 1));
        return;
      }

      if (e.key === "ArrowRight") {
        e.preventDefault();
        handleSeek(currentTime + (e.shiftKey ? 5 : 1));
        return;
      }

      // Clear selection with Escape
      if (e.key === "Escape") {
        e.preventDefault();
        if (selection) {
          setSelection(null);
          return;
        }
        if (pendingSegmentStart !== null) {
          setPendingSegmentStart(null);
          return;
        }
        onClose();
        return;
      }

      // === WORKFLOW-SPECIFIC ===
      if (workflow === "process") {
        if (e.key.toLowerCase() === "i" && !isMod && !e.shiftKey) {
          e.preventDefault();
          setTrimStart(currentTime);
          return;
        }

        if (e.key.toLowerCase() === "o" && !isMod && !e.shiftKey) {
          e.preventDefault();
          setTrimEnd(currentTime);
          return;
        }

        if (e.key.toLowerCase() === "r" && !isMod) {
          e.preventDefault();
          handleReset();
          return;
        }
      } else {
        // Label workflow
        // Number keys 1-9 to add segment with that label
        const num = Number.parseInt(e.key);
        if (num >= 1 && num <= 9 && !isMod) {
          e.preventDefault();
          const label = labelConfig.labels[num - 1];
          if (label) {
            // If we have a selection, create segment from it
            if (selection) {
              addSegmentFromSelection(label);
              return;
            }
            // Otherwise use pending segment or start new one
            if (pendingSegmentStart !== null) {
              addSegment(label);
            } else {
              setPendingSegmentStart(currentTime);
            }
          }
          return;
        }

        if (e.key.toLowerCase() === "i" && !isMod && !e.shiftKey) {
          e.preventDefault();
          setPendingSegmentStart(currentTime);
          return;
        }

        if (e.key.toLowerCase() === "o" && !isMod && !e.shiftKey && pendingSegmentStart !== null) {
          e.preventDefault();
          addSegment(labelConfig.labels[0] || "unlabeled");
          return;
        }

        if ((e.key === "Delete" || e.key === "Backspace") && selectedSegmentId) {
          e.preventDefault();
          deleteSegment(selectedSegmentId);
          return;
        }

        if (e.key.toLowerCase() === "r" && !isMod) {
          e.preventDefault();
          handleReset();
          return;
        }
      }

      // === NAVIGATION (both workflows) ===
      if (e.key.toLowerCase() === "s" && isMod) {
        e.preventDefault();
        handleSave();
        if (fileIndex < totalFiles - 1) {
          setTimeout(() => onNavigate("next"), 100);
        }
        return;
      }

      if (e.key === "," && !isMod) {
        e.preventDefault();
        if (fileIndex > 0) onNavigate("prev");
        return;
      }

      if (e.key === "." && !isMod) {
        e.preventDefault();
        if (fileIndex < totalFiles - 1) onNavigate("next");
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    workflow,
    handlePlayPause,
    handleSeek,
    handlePlaySelection,
    handleSave,
    handleReset,
    addSegment,
    addSegmentFromSelection,
    deleteSegment,
    currentTime,
    fileIndex,
    totalFiles,
    onNavigate,
    onClose,
    pendingSegmentStart,
    selectedSegmentId,
    selection,
    labelConfig.labels,
  ]);

  // Cursor style
  const getCursor = () => {
    if (isPanning) return "grabbing";
    if (isDraggingTrim || isDraggingSegment) return "ew-resize";
    if (isSelectingRange) return "crosshair";
    return "crosshair";
  };

  if (isLoading) {
    return (
      <div className="flex h-full min-h-[400px] items-center justify-center rounded-lg border border-border bg-card">
        <div className="text-center">
          <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
          <p className="text-sm text-muted-foreground">Decoding audio...</p>
        </div>
      </div>
    );
  }

  const selectedSegment = segments.find((s) => s.id === selectedSegmentId);

  return (
    <div className="flex h-full min-h-[400px] flex-col overflow-hidden rounded-lg border border-border bg-card">
      <EditorHeader
        fileName={file.name}
        fileInfo={`${formatTime(duration)} · ${(sampleRate / 1000).toFixed(1)} kHz`}
        currentIndex={fileIndex}
        totalFiles={totalFiles}
        zoom={zoom}
        onZoomChange={setZoom}
        onFitToView={handleFitToView}
        onPrevious={() => onNavigate("prev")}
        onNext={() => onNavigate("next")}
        onSave={handleSave}
        onReset={handleReset}
        onClose={onClose}
        hotkeys={workflow === "process" ? PROCESS_HOTKEYS : LABEL_HOTKEYS}
        hasChanges={hasChanges}
      />

      {/* Canvas area */}
      <div ref={containerRef} className="relative min-h-0 flex-1 bg-black">
        <canvas
          ref={canvasRef}
          className="h-full w-full"
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
          onWheel={handleWheel}
          style={{ cursor: getCursor() }}
        />

        {/* Label workflow: segment list overlay */}
        {workflow === "label" && segments.length > 0 && (
          <div className="absolute right-2 top-2 w-48 rounded-lg border border-border bg-card/95 shadow-lg backdrop-blur">
            <div className="flex items-center justify-between border-b border-border px-2 py-1.5">
              <span className="text-xs font-medium">Segments ({segments.length})</span>
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={handleReset} title="Clear all">
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
            <ScrollArea className="max-h-40">
              <div className="space-y-0.5 p-1">
                {segments.map((seg) => (
                  <button
                    type="button"
                    key={seg.id}
                    onClick={() => {
                      setSelectedSegmentId(seg.id);
                      handleSeek(seg.start);
                    }}
                    className={`flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-xs transition-colors ${
                      seg.id === selectedSegmentId ? "bg-secondary" : "hover:bg-secondary/50"
                    }`}
                  >
                    <div className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: seg.color }} />
                    <span className="flex-1 truncate font-medium">{seg.label}</span>
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                      {formatTimeShort(seg.start)}
                    </span>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Pending segment indicator */}
        {workflow === "label" && pendingSegmentStart !== null && (
          <div className="absolute left-2 top-2 rounded bg-white/90 px-2 py-1 text-xs font-medium text-black">
            IN: {formatTimeShort(pendingSegmentStart)} → Press O or 1-9 to set OUT
          </div>
        )}

        {/* Selection actions overlay */}
        {workflow === "label" && selection && Math.abs(selection.end - selection.start) > 0.05 && (
          <div className="absolute left-1/2 top-2 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-border bg-card/95 px-3 py-2 shadow-lg backdrop-blur">
            <span className="text-xs text-muted-foreground">
              {formatTimeShort(selection.start)} → {formatTimeShort(selection.end)}
            </span>
            <div className="flex items-center gap-1">
              {labelConfig.labels.slice(0, 5).map((label, i) => (
                <Button
                  key={label}
                  variant="outline"
                  size="sm"
                  className="h-6 gap-1 px-2 text-xs"
                  onClick={() => addSegmentFromSelection(label)}
                  title={`Create ${label} segment (${i + 1})`}
                >
                  <div
                    className="h-2 w-2 rounded-sm"
                    style={{ backgroundColor: getLabelColor(label, labelConfig.labels) }}
                  />
                  {label}
                </Button>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-2 text-xs"
              onClick={handlePlaySelection}
              title="Play selection (Enter)"
            >
              <PlayIcon className="h-3 w-3" />
              Play
            </Button>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setSelection(null)}>
              Cancel
            </Button>
          </div>
        )}

        {/* Controls hint */}
        <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/50 px-2 py-1 text-[10px] text-white/40">
          Scroll to zoom · Middle-drag to pan · Drag to select
        </div>
      </div>

      {/* Bottom controls */}
      <div className="flex shrink-0 items-center justify-between border-t border-border bg-card px-4 py-3">
        {/* Playback controls */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleSeek(currentTime - 5)}>
            <SkipBack className="h-4 w-4" />
          </Button>
          <Button variant="secondary" size="icon" className="h-10 w-10" onClick={handlePlayPause}>
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleSeek(currentTime + 5)}>
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>

        {/* Time display + workflow-specific info */}
        <div className="flex items-center gap-4">
          <div className="font-mono text-sm">
            <span className="text-foreground">{formatTime(currentTime)}</span>
            <span className="text-muted-foreground"> / {formatTime(duration)}</span>
          </div>

          {workflow === "process" ? (
            <span className="rounded bg-green-500/20 px-2 py-0.5 font-mono text-xs text-green-500">
              {formatTime(trimStart)} → {formatTime(trimEnd ?? duration)}
            </span>
          ) : (
            <div className="flex items-center gap-2">
              {selectedSegment && (
                <span
                  className="rounded px-2 py-0.5 font-mono text-xs"
                  style={{ backgroundColor: `${selectedSegment.color}30`, color: selectedSegment.color }}
                >
                  {selectedSegment.label}: {formatTimeShort(selectedSegment.start)} →{" "}
                  {formatTimeShort(selectedSegment.end)}
                </span>
              )}
              <span className="rounded bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                {segments.length} segment{segments.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>

        {/* Volume */}
        <div className="flex items-center gap-2">
          <Volume2 className="h-4 w-4 text-muted-foreground" />
          <Slider
            value={[volume * 100]}
            onValueChange={([v]) => setVolume(v / 100)}
            max={100}
            step={1}
            className="w-20"
          />
        </div>
      </div>
    </div>
  );
}
