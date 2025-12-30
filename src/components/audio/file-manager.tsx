import { useRef, useState } from "react";

import type { AudioFile } from "@/lib/audio/types";
import { Upload, X, FileAudio, Scissors } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileManagerProps {
  files: AudioFile[];
  currentFileIndex: number;
  onFileSelect: (index: number) => void;
  onFileUpload: (files: File[]) => void;
  onFileRemove: (fileId: string) => void;
  onFileTrimUpdate: (fileId: string, trimStart?: number, trimEnd?: number) => void;
}

export function FileManager({
  files,
  currentFileIndex,
  onFileSelect,
  onFileUpload,
  onFileRemove,
  onFileTrimUpdate,
}: FileManagerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [expandedTrimId, setExpandedTrimId] = useState<string | null>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files).filter((file) => file.type.startsWith("audio/"));
    if (droppedFiles.length > 0) {
      onFileUpload(droppedFiles);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      onFileUpload(Array.from(e.target.files));
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-3">
        <div className="mb-2 text-[10px] font-medium tracking-wider text-muted-foreground">FILES</div>
        <button
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded border border-border bg-muted py-2 text-xs text-muted-foreground transition-all hover:border-primary hover:bg-primary/10 hover:text-foreground"
        >
          <Upload className="h-3.5 w-3.5" />
          Add Files
        </button>
        <input ref={inputRef} type="file" accept="audio/*" multiple className="hidden" onChange={handleFileInput} />
      </div>

      <div className="flex-1 overflow-y-auto" onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>
        {files.length === 0 ? (
          <div className="flex h-full items-center justify-center p-6 text-center">
            <div>
              <FileAudio className="mx-auto mb-3 h-8 w-8 opacity-10" />
              <p className="text-[11px] text-muted-foreground">Drag and drop audio files</p>
            </div>
          </div>
        ) : (
          <div className="space-y-0.5 p-2">
            {files.map((file, index) => (
              <div key={file.id}>
                <div
                  className={cn(
                    "group relative flex items-center gap-2.5 rounded px-2.5 py-2 text-sm transition-all cursor-pointer",
                    index === currentFileIndex
                      ? "bg-primary/20 text-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                  onClick={() => onFileSelect(index)}
                >
                  <FileAudio className="h-3.5 w-3.5 shrink-0 opacity-60" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11px] font-medium">{file.name}</div>
                    <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
                      <span>{file.duration > 0 ? `${file.duration.toFixed(1)}s` : "Loading..."}</span>
                      {file.trimStart != null && file.trimEnd != null && (
                        <span className="text-destructive">
                          • {file.trimStart.toFixed(1)}s - {file.trimEnd.toFixed(1)}s
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedTrimId(expandedTrimId === file.id ? null : file.id);
                    }}
                    className={cn(
                      "rounded p-1 transition-all hover:bg-muted",
                      expandedTrimId === file.id ? "text-primary" : "text-muted-foreground hover:text-foreground",
                    )}
                    title="Set trim points"
                  >
                    <Scissors className="h-3 w-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onFileRemove(file.id);
                    }}
                    className="opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>

                {expandedTrimId === file.id && (
                  <div className="mx-2 mb-2 space-y-2 rounded border border-border bg-muted p-3">
                    <div className="text-[10px] font-medium text-muted-foreground">TRIM POINTS</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-[9px] text-muted-foreground">Start (s)</label>
                        <input
                          type="number"
                          value={file.trimStart ?? 0}
                          onChange={(e) => {
                            const value = Number(e.target.value);
                            onFileTrimUpdate(file.id, value, file.trimEnd);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full rounded border border-border bg-card px-2 py-1 text-[11px] text-foreground focus:border-primary focus:outline-none"
                          min={0}
                          max={file.duration}
                          step={0.1}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[9px] text-muted-foreground">End (s)</label>
                        <input
                          type="number"
                          value={file.trimEnd ?? file.duration}
                          onChange={(e) => {
                            const value = Number(e.target.value);
                            onFileTrimUpdate(file.id, file.trimStart, value);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full rounded border border-border bg-card px-2 py-1 text-[11px] text-foreground focus:border-primary focus:outline-none"
                          min={0}
                          max={file.duration}
                          step={0.1}
                        />
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onFileTrimUpdate(file.id, undefined, undefined);
                      }}
                      className="w-full text-[10px] text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Clear trim
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
