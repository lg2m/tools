import { useEffect, useRef } from "react";

import type { Label } from "@/features/audio/types";
import { cn } from "@/lib/utils";

interface LabelSelectorProps {
  labels: Label[];
  defaultLabelId: string;
  position: { x: number; y: number };
  onSelect: (labelId: string) => void;
  onClose: () => void;
}

export function LabelSelector({ labels, defaultLabelId, position, onSelect, onClose }: LabelSelectorProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "Enter") {
        onSelect(defaultLabelId);
      } else if (e.code.startsWith("Digit")) {
        const num = e.code.replace("Digit", "");
        const label = labels.find((l) => l.hotkey === num);
        if (label) {
          onSelect(label.id);
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [defaultLabelId, labels, onSelect, onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-50 rounded-lg border border-border bg-card p-2 shadow-2xl"
      style={{
        left: position.x,
        top: position.y,
        transform: "translate(-50%, -100%) translateY(-8px)",
      }}
    >
      <div className="mb-1.5 px-2 py-1 text-[10px] font-medium text-muted-foreground">SELECT LABEL</div>
      <div className="space-y-0.5">
        {labels.map((label) => (
          <button
            key={label.id}
            onClick={() => onSelect(label.id)}
            className={cn(
              "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors",
              label.id === defaultLabelId ? "bg-primary text-primary-foreground" : "hover:bg-muted",
            )}
          >
            <div className="h-2.5 w-2.5 rounded" style={{ backgroundColor: label.color }} />
            <span className="flex-1">{label.name}</span>
            <kbd className="rounded bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">{label.hotkey}</kbd>
          </button>
        ))}
      </div>
      <div className="mt-1.5 border-t border-border/50 pt-1.5 text-center text-[10px] text-muted-foreground">
        Press number or <kbd className="rounded bg-muted px-1 py-0.5">Enter</kbd>
      </div>
    </div>
  );
}
