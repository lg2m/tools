import { Play as PlayIcon, X } from "lucide-react";
import type { Label } from "@/features/audio/types";

function formatTimeShort(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toFixed(2).padStart(5, "0")}`;
}

interface SelectionOverlayProps {
  mode: "annotate" | "trim";
  pendingSelection: { startTime: number; endTime: number } | null;
  labels: Label[];
  onAddAnnotation: (labelId: string) => void;
  onPlaySelection: () => void;
  onCancelSelection: () => void;
}

export function SelectionOverlay({
  mode,
  pendingSelection,
  labels,
  onAddAnnotation,
  onPlaySelection,
  onCancelSelection,
}: SelectionOverlayProps) {
  if (
    mode !== "annotate" ||
    !pendingSelection ||
    Math.abs(pendingSelection.endTime - pendingSelection.startTime) <= 0.05
  ) {
    return null;
  }

  return (
    <div className="absolute left-1/2 top-6 z-20 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5 shadow-xl backdrop-blur">
      <span className="font-mono text-xs text-muted-foreground">
        {formatTimeShort(pendingSelection.startTime)} → {formatTimeShort(pendingSelection.endTime)}
      </span>
      <div className="h-4 w-px bg-border" />
      <div className="flex items-center gap-1.5">
        {labels.slice(0, 5).map((label) => (
          <button
            key={label.id}
            type="button"
            onClick={() => onAddAnnotation(label.id)}
            className="flex items-center gap-1.5 rounded px-2 py-1 text-[11px] font-medium transition-colors hover:bg-border"
            title={`Create ${label.name} annotation (${label.hotkey})`}
          >
            <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: label.color }} />
            <span className="text-foreground">{label.name}</span>
          </button>
        ))}
      </div>
      <div className="h-4 w-px bg-border" />
      <button
        type="button"
        onClick={onPlaySelection}
        className="flex items-center gap-1.5 rounded px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-border hover:text-foreground"
        title="Play selection (Enter)"
      >
        <PlayIcon className="h-3 w-3" />
        Play
      </button>
      <button
        type="button"
        onClick={onCancelSelection}
        className="flex items-center justify-center rounded p-1 text-muted-foreground transition-colors hover:bg-border hover:text-foreground"
        title="Cancel selection (Esc)"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
