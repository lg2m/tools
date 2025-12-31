import { Plus, X } from "lucide-react";
import { useState } from "react";
import { useShallow } from "zustand/shallow";
import { cn } from "@/lib/utils";
import { useAnnotatorStore } from "@/features/audio/store";

const PRESET_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#6366f1", "#ec4899", "#8b5cf6", "#14b8a6", "#f43f5e"];

export function LabelManager() {
  const { labels, lastUsedLabelId, addLabel, removeLabel } = useAnnotatorStore(
    useShallow((s) => ({
      labels: s.labels,
      lastUsedLabelId: s.lastUsedLabelId,
      addLabel: s.addLabel,
      removeLabel: s.removeLabel,
    })),
  );

  const [isAdding, setIsAdding] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState(PRESET_COLORS[0]);

  const handleAddLabel = () => {
    if (!newLabelName.trim()) return;

    const nextHotkey = (labels.length + 1).toString();
    addLabel({
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
          type="button"
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
              "group flex items-center gap-2 rounded px-2 py-1.5 text-[11px] transition-all",
              label.id === lastUsedLabelId ? "bg-muted" : "hover:bg-muted/50",
            )}
          >
            <div className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: label.color }} />
            <div className="min-w-0 flex-1 truncate text-foreground">{label.name}</div>
            <kbd className="font-mono text-[10px] text-muted-foreground">{label.hotkey}</kbd>
            <button
              type="button"
              onClick={() => removeLabel(label.id)}
              className="opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}

        {isAdding && (
          <div className="space-y-2 rounded border border-border bg-muted p-2">
            <input
              type="text"
              value={newLabelName}
              onChange={(e) => setNewLabelName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddLabel();
                if (e.key === "Escape") {
                  setIsAdding(false);
                  setNewLabelName("");
                }
              }}
              placeholder="Label name"
              className="w-full rounded border border-border bg-card px-2 py-1 text-[11px] text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
            <div className="flex gap-1">
              {PRESET_COLORS.map((color) => (
                <button
                  type="button"
                  key={color}
                  onClick={() => setNewLabelColor(color)}
                  className={cn(
                    "h-5 w-5 rounded transition-all hover:scale-110",
                    color === newLabelColor && "ring-2 ring-foreground ring-offset-1 ring-offset-muted",
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={handleAddLabel}
                className="flex-1 rounded bg-primary px-2 py-1 text-[10px] font-medium text-primary-foreground transition-all hover:bg-primary/90"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAdding(false);
                  setNewLabelName("");
                }}
                className="flex-1 rounded bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground transition-all hover:bg-border hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
