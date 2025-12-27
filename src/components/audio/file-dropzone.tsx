import { useCallback, useState } from 'react';

import { Upload, FolderOpen } from 'lucide-react';

import { cn } from '@/lib/utils';

type FileDropzoneProps = {
  onFilesAdded: (files: File[]) => void;
};

export function FileDropzone({ onFilesAdded }: FileDropzoneProps) {
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
      const droppedFiles = Array.from(e.dataTransfer.files).filter((file) =>
        file.type.startsWith('audio/'),
      );
      if (droppedFiles.length > 0) {
        onFilesAdded(droppedFiles);
      }
    },
    [onFilesAdded],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(e.target.files || []);
      if (selectedFiles.length > 0) {
        onFilesAdded(selectedFiles);
      }
      e.target.value = '';
    },
    [onFilesAdded],
  );

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'relative flex min-h-[200px] flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors',
        isDragging
          ? 'border-foreground bg-secondary/50'
          : 'border-border hover:border-muted-foreground/50',
      )}
    >
      <input
        type="file"
        accept="audio/*"
        multiple
        onChange={handleFileSelect}
        className="absolute inset-0 cursor-pointer opacity-0"
        // @ts-expect-error - webkitdirectory is a non-standard attribute
        webkitdirectory=""
        directory=""
      />
      <div className="pointer-events-none flex flex-col items-center gap-4 p-8 text-center">
        <div className="rounded-full border border-border bg-secondary p-4">
          <Upload className="h-6 w-6 text-muted-foreground" />
        </div>
        <div>
          <p className="mb-1 font-medium">Drop audio files or folders here</p>
          <p className="text-sm text-muted-foreground">
            Supports MP3, WAV, OGG, FLAC, M4A, and more
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <FolderOpen className="h-4 w-4" />
          <span>Click to browse folders</span>
        </div>
      </div>
    </div>
  );
}
