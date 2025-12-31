import { Play as PlayIcon, Trash2, X } from "lucide-react";
import type { Annotation, Label } from "@/lib/audio/types";
import { cn } from "@/lib/utils";

function formatTimeShort(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toFixed(2).padStart(5, "0")}`;
}

interface AnnotationOverlayProps {
  mode: "annotate" | "trim";
  selectedAnnotationId: string | null;
  pendingSelection: { startTime: number; endTime: number } | null;
  annotations: Annotation[];
  labels: Label[];
  onChangeLabel: (annotationId: string, labelId: string) => void;
  onPlayAnnotation: (startTime: number, endTime: number) => void;
  onDeleteAnnotation: (annotationId: string) => void;
  onDeselectAnnotation: () => void;
}

export function AnnotationOverlay({
  mode,
  selectedAnnotationId,
  pendingSelection,
  annotations,
  labels,
  onChangeLabel,
  onPlayAnnotation,
  onDeleteAnnotation,
  onDeselectAnnotation,
}: AnnotationOverlayProps) {
  if (mode !== "annotate" || !selectedAnnotationId || pendingSelection) {
    return null;
  }

  const annotation = annotations.find((a) => a.id === selectedAnnotationId);
  const label = annotation ? labels.find((l) => l.id === annotation.labelId) : null;

  if (!annotation || !label) {
    return null;
  }

  return (
    <div className="absolute left-1/2 top-6 z-20 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5 shadow-xl backdrop-blur">
      <div className="flex items-center gap-2">
        <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: label.color }} />
        <span className="text-xs font-medium text-foreground">{label.name}</span>
      </div>
      <span className="font-mono text-xs text-muted-foreground">
        {formatTimeShort(annotation.startTime)} → {formatTimeShort(annotation.endTime)}
      </span>
      <div className="h-4 w-px bg-border" />
      <div className="flex items-center gap-1">
        {labels.slice(0, 5).map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => onChangeLabel(selectedAnnotationId, l.id)}
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded transition-colors",
              l.id === label.id
                ? "ring-2 ring-muted-foreground"
                : "opacity-60 hover:opacity-100 hover:ring-1 hover:ring-muted-foreground/40",
            )}
            style={{ backgroundColor: l.color }}
            title={`Change to ${l.name} (${l.hotkey})`}
          >
            {l.id === label.id && <span className="text-[10px] font-bold text-primary-foreground">✓</span>}
          </button>
        ))}
      </div>
      <div className="h-4 w-px bg-border" />
      <button
        type="button"
        onClick={() => onPlayAnnotation(annotation.startTime, annotation.endTime)}
        className="flex items-center gap-1.5 rounded px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-border hover:text-foreground"
        title="Play annotation (Enter)"
      >
        <PlayIcon className="h-3 w-3" />
        Play
      </button>
      <button
        type="button"
        onClick={() => onDeleteAnnotation(selectedAnnotationId)}
        className="flex items-center gap-1.5 rounded px-2 py-1 text-[11px] font-medium text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
        title="Delete annotation (Delete)"
      >
        <Trash2 className="h-3 w-3" />
        Delete
      </button>
      <button
        type="button"
        onClick={onDeselectAnnotation}
        className="flex items-center justify-center rounded p-1 text-muted-foreground transition-colors hover:bg-border hover:text-foreground"
        title="Deselect (Esc)"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
