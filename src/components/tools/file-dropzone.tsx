import { FolderOpen, Upload } from "lucide-react";
import { useCallback, useState } from "react";

import { cn } from "@/lib/utils";

interface FileDropzoneProps {
  onFilesAdded: (files: File[]) => void;
  accept?: string;
  acceptLabel?: string;
  fileTypeFilter?: (file: File) => boolean;
  maxFiles?: number;
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  compact?: boolean;
}

export function FileDropzone({
  onFilesAdded,
  accept = "*/*",
  acceptLabel,
  fileTypeFilter,
  maxFiles,
  title = "Drop files here",
  description,
  icon,
  compact = false,
}: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      let droppedFiles = Array.from(e.dataTransfer.files);
      if (fileTypeFilter) {
        droppedFiles = droppedFiles.filter(fileTypeFilter);
      }
      if (maxFiles) {
        droppedFiles = droppedFiles.slice(0, maxFiles);
      }
      if (droppedFiles.length > 0) {
        onFilesAdded(droppedFiles);
      }
    },
    [onFilesAdded, fileTypeFilter, maxFiles],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      let selectedFiles = Array.from(e.target.files ?? []);
      if (maxFiles) {
        selectedFiles = selectedFiles.slice(0, maxFiles);
      }
      if (selectedFiles.length > 0) {
        onFilesAdded(selectedFiles);
      }
      e.target.value = "";
    },
    [onFilesAdded, maxFiles],
  );

  if (compact) {
    return (
      <label
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative flex cursor-pointer items-center justify-center gap-3 rounded-lg border-2 border-dashed px-4 py-3 transition-colors",
          isDragging ? "border-foreground bg-secondary/50" : "border-border hover:border-muted-foreground/50",
        )}
      >
        <input type="file" accept={accept} multiple onChange={handleFileSelect} className="sr-only" />
        <Upload className={cn("h-5 w-5", isDragging ? "text-foreground" : "text-muted-foreground")} />
        <span className="text-sm text-muted-foreground">{title}</span>
      </label>
    );
  }

  return (
    <label
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "relative flex min-h-[280px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors",
        isDragging
          ? "border-foreground bg-secondary/50 scale-[1.01]"
          : "border-border hover:border-muted-foreground/50",
      )}
    >
      <input type="file" accept={accept} multiple onChange={handleFileSelect} className="sr-only" />
      <div className="pointer-events-none flex flex-col items-center gap-6 p-8 text-center">
        <div
          className={cn(
            "rounded-full border border-border p-6 transition-colors",
            isDragging ? "bg-foreground/10" : "bg-secondary",
          )}
        >
          {icon ?? (
            <Upload
              className={cn("h-8 w-8 transition-colors", isDragging ? "text-foreground" : "text-muted-foreground")}
            />
          )}
        </div>
        <div>
          <p className="mb-2 text-lg font-medium">{title}</p>
          {(description || acceptLabel) && (
            <p className="text-sm text-muted-foreground">{description || acceptLabel}</p>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <FolderOpen className="h-4 w-4" />
          <span>Click to browse</span>
        </div>
      </div>
    </label>
  );
}
