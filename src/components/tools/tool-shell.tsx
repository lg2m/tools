"use client";

import type { ToolMode } from "@/lib/tools/types";

import { ToolModeTabs } from "./tool-mode-tabs";

interface ToolShellProps {
  title: string;
  description: string;
  mode: ToolMode;
  onModeChange: (mode: ToolMode) => void;
  fileCount: number;
  editingFile?: string | null;
  showEditor?: boolean;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
}

export function ToolShell({
  title,
  description,
  mode,
  onModeChange,
  fileCount,
  editingFile,
  showEditor = true,
  headerActions,
  children,
}: ToolShellProps) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex items-center gap-3">
          {headerActions}
          <ToolModeTabs
            mode={mode}
            onModeChange={onModeChange}
            fileCount={fileCount}
            editingFile={editingFile}
            showEditor={showEditor}
          />
        </div>
      </div>
      {children}
    </div>
  );
}
