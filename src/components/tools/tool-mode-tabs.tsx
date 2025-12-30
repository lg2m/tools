import { Layers, Grid3X3, PenTool } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ToolMode } from "@/lib/tools/types";

interface ToolModeTabsProps {
  mode: ToolMode;
  onModeChange: (mode: ToolMode) => void;
  fileCount: number;
  editingFile?: string | null;
  showEditor?: boolean;
}

const modes: { value: ToolMode; label: string; icon: typeof Layers; description: string }[] = [
  {
    value: "bulk",
    label: "Bulk",
    icon: Layers,
    description: "Fast batch processing",
  },
  {
    value: "queue",
    label: "Queue",
    icon: Grid3X3,
    description: "File management",
  },
  {
    value: "editor",
    label: "Editor",
    icon: PenTool,
    description: "Individual editing",
  },
];

export function ToolModeTabs({ mode, onModeChange, fileCount, editingFile, showEditor = true }: ToolModeTabsProps) {
  const filteredModes = showEditor ? modes : modes.filter((m) => m.value !== "editor");

  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
      {filteredModes.map((m) => {
        const Icon = m.icon;
        const isActive = mode === m.value;
        const isEditorWithFile = m.value === "editor" && editingFile;
        const isDisabled = m.value === "editor" && fileCount === 0;

        return (
          <button
            key={m.value}
            onClick={() => !isDisabled && onModeChange(m.value)}
            disabled={isDisabled}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
              isActive ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
              isDisabled && "cursor-not-allowed opacity-50",
              isEditorWithFile && !isActive && "text-green-500",
            )}
            title={m.description}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{m.label}</span>
            {m.value === "queue" && fileCount > 0 && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 font-mono text-[10px]",
                  isActive ? "bg-foreground/10" : "bg-muted",
                )}
              >
                {fileCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
