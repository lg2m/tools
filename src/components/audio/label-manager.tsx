import { useState } from "react";

import { Plus, X } from "lucide-react";

import type { Label } from "@/lib/audio/types";
import { cn } from "@/lib/utils";

interface LabelManagerProps {
  labels: Label[];
  lastUsedLabel: string;
  onAddLabel: (label: Label) => void;
  onRemoveLabel: (labelId: string) => void;
  onUpdateLabel: (labelId: string, updates: Partial<Label>) => void;
}

const PRESET_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#6366f1", "#ec4899", "#8b5cf6", "#14b8a6", "#f43f5e"];

export function LabelManager({ labels, lastUsedLabel, onAddLabel, onRemoveLabel, onUpdateLabel }: LabelManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState(PRESET_COLORS[0]);

  const handleAddLabel = () => {
    if (!newLabelName.trim()) return;

    const nextHotkey = (labels.length + 1).toString();
    onAddLabel({
      id: Date.now().toString(),
      name: newLabelName.trim(),
      color: newLabelColor,
      hotkey: nextHotkey,
    });

    setNewLabelName("");
    setIsAdding(false);
  };

  return (
    <div className="border-b border-border p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[10px] font-medium tracking-wider text-muted-background">LABELS</div>
        <button
          onClick={() => setIsAdding(true)}
          className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>

      <div className="space-y-0.5">
        {labels.map((label) => (
          <div
            key={label.id}
            className={cn(
              "group flex items-center gap-2 rounded px-2 py-1.5 transition-all",
              label.id === lastUsedLabel ? "bg-muted" : "hover:bg-muted/50",
            )}
          >
            <div className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: label.color }} />
            <div className="flex-1 truncate text-[11px] text-foreground">{label.name}</div>
            <kbd className="rounded bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              {label.hotkey}
            </kbd>
            <button
              onClick={() => onRemoveLabel(label.id)}
              className="opacity-0 transition-all hover:text-destructive group-hover:opacity-100"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>

      {isAdding && (
        <div className="mt-2 space-y-2 rounded border border-border bg-background p-2.5">
          <input
            type="text"
            value={newLabelName}
            onChange={(e) => setNewLabelName(e.target.value)}
            placeholder="Label name"
            className="w-full rounded border border-border bg-card px-2 py-1.5 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddLabel();
              if (e.key === "Escape") setIsAdding(false);
            }}
          />
          <div className="flex gap-1.5">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => setNewLabelColor(color)}
                className={cn(
                  "h-6 w-6 rounded border-2 transition-all",
                  newLabelColor === color ? "scale-110 border-foreground" : "border-transparent",
                )}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAddLabel}
              className="flex-1 rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-lg shadow-primary/20 transition-colors hover:bg-primary/90"
            >
              Add
            </button>
            <button
              onClick={() => setIsAdding(false)}
              className="rounded border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
