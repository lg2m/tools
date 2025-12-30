"use client";

import { useState, useCallback, useRef } from "react";
import { Scissors, Tags, Upload, X, Plus, AudioWaveform, FileUp, ChevronDown, ChevronRight } from "lucide-react";

import type { AudioWorkflow, AudioFileData, TrimRegion, AudioSegment } from "@/lib/tools/types";
import { generateId, formatFileSize } from "@/lib/tools/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileDropzone } from "@/components/tools/file-dropzone";
import { AudioEditorMode } from "./modes/audio-editor-mode";

// Label config for the "label" workflow
export type LabelConfig = {
  labels: string[];
  exportFormat: "json" | "csv" | "audacity";
};

// Perceptually distinct color palette for labels (matching editor)
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

function getLabelColor(index: number): string {
  return LABEL_COLORS[index % LABEL_COLORS.length];
}

const DEFAULT_LABELS = ["speech", "silence", "noise", "music"];

export function AudioTool() {
  // Workflow selection
  const [workflow, setWorkflow] = useState<AudioWorkflow>("process");

  // File state
  const [files, setFiles] = useState<AudioFileData[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Label config (editable)
  const [labels, setLabels] = useState<string[]>(DEFAULT_LABELS);
  const [newLabelInput, setNewLabelInput] = useState("");
  const [showLabelsPanel, setShowLabelsPanel] = useState(true);
  const labelFileInputRef = useRef<HTMLInputElement>(null);

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);

  const labelConfig: LabelConfig = {
    labels,
    exportFormat: "json",
  };

  // === File Management ===
  const handleFilesAdded = useCallback(
    (newFiles: File[]) => {
      const audioFiles: AudioFileData[] = newFiles.map((file) => ({
        id: generateId(),
        name: file.name,
        size: file.size,
        type: file.type,
        status: "queued",
        progress: 0,
        file: file,
        url: URL.createObjectURL(file),
        mediaType: "audio",
      }));
      setFiles((prev) => {
        const updated = [...prev, ...audioFiles];
        // Auto-select first file for editing if none selected
        if (editingIndex === null && updated.length > 0) {
          setEditingIndex(0);
        }
        return updated;
      });
    },
    [editingIndex],
  );

  const handleRemoveFile = useCallback(
    (id: string) => {
      setFiles((prev) => {
        const file = prev.find((f) => f.id === id);
        if (file) URL.revokeObjectURL(file.url);
        const updated = prev.filter((f) => f.id !== id);

        // Adjust editing index
        if (editingIndex !== null) {
          const removedIndex = prev.findIndex((f) => f.id === id);
          if (removedIndex === editingIndex) {
            // Current file removed - select next or prev
            if (updated.length === 0) {
              setEditingIndex(null);
            } else if (editingIndex >= updated.length) {
              setEditingIndex(updated.length - 1);
            }
          } else if (removedIndex < editingIndex) {
            setEditingIndex(editingIndex - 1);
          }
        }

        return updated;
      });
    },
    [editingIndex],
  );

  const handleClearAll = useCallback(() => {
    for (const f of files) {
      URL.revokeObjectURL(f.url);
    }
    setFiles([]);
    setEditingIndex(null);
  }, [files]);

  // === Editor ===
  const handleSelectFile = useCallback((index: number) => {
    setEditingIndex(index);
  }, []);

  const handleSaveEdit = useCallback(
    (updates: { trimOverride?: TrimRegion; segments?: AudioSegment[]; fileLabel?: string }) => {
      if (editingIndex === null) return;
      setFiles((prev) =>
        prev.map((f, i) =>
          i === editingIndex
            ? {
                ...f,
                ...updates,
                hasOverrides: !!(updates.trimOverride || updates.segments?.length || updates.fileLabel),
              }
            : f,
        ),
      );
    },
    [editingIndex],
  );

  const handleNavigateEdit = useCallback(
    (direction: "prev" | "next") => {
      if (editingIndex === null) return;
      const newIndex =
        direction === "prev" ? Math.max(0, editingIndex - 1) : Math.min(files.length - 1, editingIndex + 1);
      setEditingIndex(newIndex);
    },
    [editingIndex, files.length],
  );

  // === Label Management ===
  const handleAddLabel = useCallback(() => {
    const trimmed = newLabelInput.trim().toLowerCase();
    if (trimmed && !labels.includes(trimmed)) {
      setLabels((prev) => [...prev, trimmed]);
      setNewLabelInput("");
    }
  }, [newLabelInput, labels]);

  const handleRemoveLabel = useCallback((label: string) => {
    setLabels((prev) => prev.filter((l) => l !== label));
  }, []);

  const handleImportLabels = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      let importedLabels: string[] = [];

      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          importedLabels = parsed.map((l) => String(l).trim().toLowerCase()).filter(Boolean);
        }
      } catch {
        if (text.includes("\n")) {
          importedLabels = text
            .split("\n")
            .map((l) => l.trim().toLowerCase())
            .filter(Boolean);
        } else {
          importedLabels = text
            .split(",")
            .map((l) => l.trim().toLowerCase())
            .filter(Boolean);
        }
      }

      if (importedLabels.length > 0) {
        setLabels((prev) => {
          const combined = [...prev];
          for (const label of importedLabels) {
            if (!combined.includes(label)) {
              combined.push(label);
            }
          }
          return combined;
        });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }, []);

  // === Processing ===
  const handleProcess = useCallback(async () => {
    setIsProcessing(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsProcessing(false);
  }, []);

  const editingFile = editingIndex !== null ? files[editingIndex] : null;
  const hasFiles = files.length > 0;
  const editedCount = files.filter((f) => f.hasOverrides).length;

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="flex w-52 shrink-0 flex-col border-r border-border bg-card/50 overflow-hidden">
        {/* Workflow tabs */}
        <div className="shrink-0 border-b border-border p-2">
          <Tabs value={workflow} onValueChange={(v) => setWorkflow(v as AudioWorkflow)} className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-8">
              <TabsTrigger value="process" className="gap-1 text-xs h-7">
                <Scissors className="h-3 w-3" />
                Process
              </TabsTrigger>
              <TabsTrigger value="label" className="gap-1 text-xs h-7">
                <Tags className="h-3 w-3" />
                Label
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Dropzone */}
        <div className="shrink-0 border-b border-border p-2">
          <FileDropzone accept="audio/*" onFilesAdded={handleFilesAdded} maxFiles={100} title="Add files" compact />
        </div>

        {/* File list - this is the scrollable area */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {hasFiles ? (
            <ScrollArea className="h-full">
              <div className="space-y-0.5 p-1.5">
                {files.map((file, index) => (
                  <button
                    key={file.id}
                    type="button"
                    onClick={() => handleSelectFile(index)}
                    className={`group flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition-colors ${
                      index === editingIndex ? "bg-secondary" : "hover:bg-secondary/50"
                    }`}
                  >
                    <AudioWaveform className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs">{file.name}</p>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-muted-foreground">{formatFileSize(file.size)}</span>
                        {file.hasOverrides && (
                          <span className="rounded bg-green-500/20 px-1 text-[9px] text-green-500">
                            {workflow === "process" ? "trim" : file.segments?.length || 0}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveFile(file.id);
                      }}
                      className="rounded p-0.5 opacity-0 hover:bg-destructive/20 group-hover:opacity-100"
                    >
                      <X className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </button>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="flex h-full flex-col items-center justify-center p-4 text-center">
              <AudioWaveform className="mb-2 h-5 w-5 text-muted-foreground/40" />
              <p className="text-[11px] text-muted-foreground">Drop audio files</p>
            </div>
          )}
        </div>

        {/* File count */}
        {hasFiles && (
          <div className="shrink-0 border-t border-border px-2 py-1.5">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>
                {files.length} files{editedCount > 0 && ` · ${editedCount} edited`}
              </span>
              <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px]" onClick={handleClearAll}>
                Clear
              </Button>
            </div>
          </div>
        )}

        {/* Labels panel */}
        {workflow === "label" && (
          <div className="shrink-0 border-t border-border">
            <button
              type="button"
              onClick={() => setShowLabelsPanel(!showLabelsPanel)}
              className="flex w-full items-center justify-between px-2 py-1.5 text-xs hover:bg-secondary/50"
            >
              <span className="font-medium">Labels ({labels.length})</span>
              {showLabelsPanel ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </button>

            {showLabelsPanel && (
              <div className="border-t border-border p-2 max-h-48 overflow-hidden">
                <ScrollArea className="h-full max-h-32">
                  <div className="space-y-0.5 pr-2">
                    {labels.map((label, i) => (
                      <div
                        key={label}
                        className="flex items-center justify-between rounded px-1.5 py-1 text-xs hover:bg-secondary/50"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: getLabelColor(i) }} />
                          <span className="font-mono text-[9px] text-muted-foreground">{i + 1}</span>
                          <span className="truncate text-[11px]">{label}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveLabel(label)}
                          className="rounded p-0.5 opacity-30 hover:opacity-100"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleAddLabel();
                  }}
                  className="mt-2 flex gap-1"
                >
                  <Input
                    value={newLabelInput}
                    onChange={(e) => setNewLabelInput(e.target.value)}
                    placeholder="Add..."
                    className="h-6 flex-1 text-xs"
                  />
                  <Button type="submit" variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                    <Plus className="h-3 w-3" />
                  </Button>
                </form>

                <input
                  ref={labelFileInputRef}
                  type="file"
                  accept=".txt,.json,.csv"
                  onChange={handleImportLabels}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-1.5 h-5 w-full gap-1 text-[10px]"
                  onClick={() => labelFileInputRef.current?.click()}
                >
                  <FileUp className="h-2.5 w-2.5" />
                  Import
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Process button */}
        {hasFiles && (
          <div className="shrink-0 border-t border-border p-2">
            <Button size="sm" className="w-full h-7 text-xs" onClick={handleProcess} disabled={isProcessing}>
              {isProcessing
                ? "..."
                : workflow === "process"
                  ? `Process (${editedCount || files.length})`
                  : `Export (${editedCount})`}
            </Button>
          </div>
        )}
      </div>

      {/* Editor */}
      <div className="flex-1 min-w-0 overflow-hidden">
        {editingFile ? (
          <AudioEditorMode
            file={editingFile}
            fileIndex={editingIndex ?? 0}
            totalFiles={files.length}
            workflow={workflow}
            labelConfig={labelConfig}
            onSave={handleSaveEdit}
            onNavigate={handleNavigateEdit}
            onClose={() => setEditingIndex(null)}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Drop audio files to start</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
