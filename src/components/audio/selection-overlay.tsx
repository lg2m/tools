import { Play, Trash2, X } from "lucide-react";
import { formatTime } from "@/lib/time";
import { cn } from "@/lib/utils";

import type { Annotation, Label } from "@/types/audio";

interface TimeRange {
  startTime: number;
  endTime: number;
}

interface BaseProps {
  labels: Label[];
  onPlay: () => void;
  onClose: () => void;
}

interface SelectionProps extends BaseProps {
  variant: "selection";
  selection: TimeRange;
  onAddAnnotation: (labelId: string) => void;
}

interface AnnotationProps extends BaseProps {
  variant: "annotation";
  annotation: Annotation;
  currentLabel: Label;
  onChangeLabel: (labelId: string) => void;
  onDelete: () => void;
}

type SelectionOverlayProps = SelectionProps | AnnotationProps;

export function SelectionOverlay(props: SelectionOverlayProps) {
  const { labels, onPlay, onClose } = props;
  const time =
    props.variant === "selection"
      ? props.selection
      : { startTime: props.annotation.startTime, endTime: props.annotation.endTime };

  return (
    <div className="absolute left-1/2 top-6 z-20 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5 shadow-xl backdrop-blur">
      {props.variant === "annotation" && (
        <div className="flex items-center gap-2">
          <div className="size-2.5 rounded-sm" style={{ backgroundColor: props.currentLabel.color }} />
          <span className="text-xs font-medium">{props.currentLabel.name}</span>
        </div>
      )}

      <span className="font-mono text-xs text-muted-foreground">
        {formatTime(time.startTime)} → {formatTime(time.endTime)}
      </span>

      <div className="h-4 w-px bg-border" />

      {props.variant === "selection" ? (
        <div className="flex items-center gap-1.5">
          {labels.slice(0, 5).map((label) => (
            <button
              key={label.id}
              type="button"
              onClick={() => props.onAddAnnotation(label.id)}
              className="flex items-center gap-1.5 rounded px-2 py-1 text-[11px] font-medium hover:bg-border"
              title={`Create ${label.name} (${label.hotkey})`}
            >
              <div className="size-2.5 rounded-sm" style={{ backgroundColor: label.color }} />
              <span>{label.name}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-1">
          {labels.slice(0, 5).map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => props.onChangeLabel(l.id)}
              className={cn(
                "flex size-6 items-center justify-center rounded",
                l.id === props.currentLabel.id
                  ? "ring-2 ring-muted-foreground"
                  : "opacity-60 hover:opacity-100 hover:ring-1 hover:ring-muted-foreground/40",
              )}
              style={{ backgroundColor: l.color }}
              title={`Change to ${l.name} (${l.hotkey})`}
            >
              {l.id === props.currentLabel.id && (
                <span className="text-[10px] font-bold text-primary-foreground">✓</span>
              )}
            </button>
          ))}
        </div>
      )}

      <div className="h-4 w-px bg-border" />

      <button
        type="button"
        onClick={onPlay}
        className="flex items-center gap-1.5 rounded px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-border hover:text-foreground"
        title="Play (Enter)"
      >
        <Play className="size-3" />
        Play
      </button>

      {props.variant === "annotation" && (
        <button
          type="button"
          onClick={props.onDelete}
          className="flex items-center gap-1.5 rounded px-2 py-1 text-[11px] font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300"
          title="Delete (Delete)"
        >
          <Trash2 className="size-3" />
          Delete
        </button>
      )}

      <button
        type="button"
        onClick={onClose}
        className="flex size-6 items-center justify-center rounded p-1 text-muted-foreground hover:bg-border hover:text-foreground"
        title="Close (Esc)"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
