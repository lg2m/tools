import { FileAudio, Scissors, Upload, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useShallow } from "zustand/shallow";

import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useAudioDomainStore } from "@/store/audio";
import type { AudioFile } from "@/types/audio";

function createAudioFile(file: File, index: number): AudioFile {
  return {
    id: `${Date.now()}-${index}`,
    name: file.name,
    url: URL.createObjectURL(file),
    duration: 0,
    format: file.type,
    sampleRate: 44100,
    channels: 2,
    bitDepth: 16,
    trimStart: undefined,
    trimEnd: undefined,
  };
}

function formatDuration(duration: number): string {
  return duration > 0 ? `${duration.toFixed(1)}s` : "Loading...";
}

interface TrimEditorProps {
  file: AudioFile;
  onTrimUpdate: (fileId: string, trimStart?: number, trimEnd?: number) => void;
}

function TrimEditor({ file, onTrimUpdate }: TrimEditorProps) {
  const handleChange = useCallback(
    (field: "start" | "end", value: number) => {
      onTrimUpdate(file.id, field === "start" ? value : file.trimStart, field === "end" ? value : file.trimEnd);
    },
    [file.id, file.trimStart, file.trimEnd, onTrimUpdate],
  );

  return (
    <div className="mx-2 mb-2 space-y-2 rounded border border-border bg-muted p-3">
      <div className="text-[10px] font-medium text-muted-foreground">TRIM POINTS</div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor={`trim-start-${file.id}`} className="mb-1 text-[9px] text-muted-foreground">
            Start (s)
          </Label>
          <Input
            id={`trim-start-${file.id}`}
            type="number"
            value={file.trimStart ?? 0}
            onChange={(e) => handleChange("start", Number(e.target.value))}
            onClick={(e) => e.stopPropagation()}
            className="h-7 text-[11px]"
            min={0}
            max={file.duration}
            step={0.1}
          />
        </div>
        <div>
          <Label htmlFor={`trim-end-${file.id}`} className="mb-1 text-[9px] text-muted-foreground">
            End (s)
          </Label>
          <Input
            id={`trim-end-${file.id}`}
            type="number"
            value={file.trimEnd ?? file.duration}
            onChange={(e) => handleChange("end", Number(e.target.value))}
            onClick={(e) => e.stopPropagation()}
            className="h-7 text-[11px]"
            min={0}
            max={file.duration}
            step={0.1}
          />
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-full text-[10px]"
        onClick={(e) => {
          e.stopPropagation();
          onTrimUpdate(file.id, undefined, undefined);
        }}
      >
        Clear trim
      </Button>
    </div>
  );
}

interface FileItemProps {
  file: AudioFile;
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onToggleTrim: () => void;
  onTrimUpdate: (fileId: string, trimStart?: number, trimEnd?: number) => void;
}

function FileItem({ file, isSelected, isExpanded, onSelect, onRemove, onToggleTrim, onTrimUpdate }: FileItemProps) {
  const hasTrim = file.trimStart != null && file.trimEnd != null;

  return (
    <div>
      <div
        className={cn(
          "group relative flex w-full items-center gap-2.5 rounded px-2.5 py-2 text-sm transition-all",
          isSelected
            ? "bg-primary/20 text-foreground shadow-sm"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <button
          type="button"
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-left"
          onClick={onSelect}
        >
          <FileAudio className="size-3.5 shrink-0 opacity-60" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[11px] font-medium">{file.name}</div>
            <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
              <span>{formatDuration(file.duration)}</span>
              {hasTrim && (
                <span className="text-destructive">
                  {file.trimStart?.toFixed(1)}s - {file.trimEnd?.toFixed(1)}s
                </span>
              )}
            </div>
          </div>
        </button>
        <div className="ml-1 flex shrink-0 items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn("size-6 shrink-0", isExpanded ? "text-primary" : "text-muted-foreground")}
            onClick={onToggleTrim}
            title="Set trim points"
          >
            <Scissors className="size-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-6 shrink-0 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100"
            onClick={onRemove}
          >
            <X className="size-3 text-destructive" />
          </Button>
        </div>
      </div>
      {isExpanded && <TrimEditor file={file} onTrimUpdate={onTrimUpdate} />}
    </div>
  );
}

export function FileManager() {
  const { files, currentFileIndex, selectFile, addFiles, removeFile, patchFile } = useAudioDomainStore(
    useShallow((s) => ({
      files: s.files,
      currentFileIndex: s.currentFileIndex,
      selectFile: s.selectFile,
      addFiles: s.addFiles,
      removeFile: s.removeFile,
      patchFile: s.patchFile,
    })),
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const [expandedTrimId, setExpandedTrimId] = useState<string | null>(null);

  const handleFileUpload = useCallback(
    (newFiles: File[]) => {
      addFiles(newFiles.map(createAudioFile));
    },
    [addFiles],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const audioFiles = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("audio/"));
      if (audioFiles.length > 0) handleFileUpload(audioFiles);
    },
    [handleFileUpload],
  );

  const handleTrimUpdate = useCallback(
    (fileId: string, trimStart?: number, trimEnd?: number) => {
      patchFile(fileId, { trimStart, trimEnd });
    },
    [patchFile],
  );

  const toggleTrim = useCallback((fileId: string) => {
    setExpandedTrimId((prev) => (prev === fileId ? null : fileId));
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-3">
        <div className="mb-2 text-[10px] font-medium tracking-wider text-muted-foreground">FILES</div>
        <Button variant="outline" size="sm" className="w-full" onClick={() => inputRef.current?.click()}>
          <Upload className="size-3.5" />
          Add Files
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="audio/*"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFileUpload(Array.from(e.target.files))}
        />
      </div>

      <ScrollArea className="flex-1" onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>
        {files.length === 0 ? (
          <Empty className="h-full border-0">
            <EmptyHeader>
              <EmptyMedia>
                <FileAudio className="size-8 opacity-10" />
              </EmptyMedia>
              <EmptyDescription>Drag and drop audio files</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="space-y-0.5 p-2">
            {files.map((file, index) => (
              <FileItem
                key={file.id}
                file={file}
                isSelected={index === currentFileIndex}
                isExpanded={expandedTrimId === file.id}
                onSelect={() => selectFile(index)}
                onRemove={() => removeFile(file.id)}
                onToggleTrim={() => toggleTrim(file.id)}
                onTrimUpdate={handleTrimUpdate}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
