import { Plus, X } from "lucide-react";
import { useCallback, useState } from "react";
import { useShallow } from "zustand/shallow";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAudioDomainStore } from "@/store/audio";

const PRESET_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#6366f1", "#ec4899", "#8b5cf6", "#14b8a6", "#f43f5e"] as const;

export function LabelManager() {
  const { labels, lastUsedLabelId, addLabel, removeLabel } = useAudioDomainStore(
    useShallow((s) => ({
      labels: s.labels,
      lastUsedLabelId: s.lastUsedLabelId,
      addLabel: s.addLabel,
      removeLabel: s.removeLabel,
    })),
  );

  const [isAdding, setIsAdding] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState<string>(PRESET_COLORS[0]);

  const resetForm = useCallback(() => {
    setNewLabelName("");
    setIsAdding(false);
  }, []);

  const handleAddLabel = useCallback(() => {
    const name = newLabelName.trim();
    if (!name) return;

    addLabel({
      id: Date.now().toString(),
      name,
      color: newLabelColor,
      hotkey: (labels.length + 1).toString(),
    });
    resetForm();
  }, [newLabelName, newLabelColor, labels.length, addLabel, resetForm]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") handleAddLabel();
      if (e.key === "Escape") resetForm();
    },
    [handleAddLabel, resetForm],
  );

  return (
    <div className="border-b border-border p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-medium tracking-wider text-muted-foreground">LABELS</span>
        <Button variant="ghost" size="icon-sm" className="size-5" onClick={() => setIsAdding(true)}>
          <Plus className="size-3" />
        </Button>
      </div>

      <div className="space-y-0.5">
        {labels.map((label) => (
          <div
            key={label.id}
            className={cn(
              "group flex items-center gap-2 rounded px-2 py-1.5 text-[11px] transition-colors",
              label.id === lastUsedLabelId ? "bg-muted" : "hover:bg-muted/50",
            )}
          >
            <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: label.color }} />
            <span className="min-w-0 flex-1 truncate">{label.name}</span>
            <kbd className="font-mono text-[10px] text-muted-foreground">{label.hotkey}</kbd>
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-4 shrink-0 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100"
              onClick={() => removeLabel(label.id)}
            >
              <X className="size-3 text-destructive" />
            </Button>
          </div>
        ))}

        {isAdding && (
          <div className="space-y-2 rounded border border-border bg-muted p-2">
            <Input
              value={newLabelName}
              onChange={(e) => setNewLabelName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Label name"
              className="h-7 text-[11px]"
              autoFocus
            />
            <div className="flex gap-1">
              {PRESET_COLORS.map((color) => (
                <button
                  type="button"
                  key={color}
                  onClick={() => setNewLabelColor(color)}
                  className={cn(
                    "size-5 rounded transition-transform hover:scale-110",
                    color === newLabelColor && "ring-2 ring-foreground ring-offset-1 ring-offset-muted",
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <div className="flex gap-1">
              <Button size="sm" className="h-6 flex-1 text-[10px]" onClick={handleAddLabel}>
                Add
              </Button>
              <Button variant="secondary" size="sm" className="h-6 flex-1 text-[10px]" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
