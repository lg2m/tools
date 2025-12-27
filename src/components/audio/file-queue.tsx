import {
  AlertCircle,
  CheckCircle,
  Download,
  FileAudio,
  Loader2,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { downloadBlob } from '@/lib/audio/processor';
import { cn } from '@/lib/utils';
import type { AudioFile } from '@/types/audio';

type FileQueueProps = {
  files: AudioFile[];
  onRemoveFile: (id: string) => void;
  onClearAll: () => void;
  onClearCompleted: () => void;
  onEditFile?: (id: string) => void;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileStatusIcon({ status }: { status: AudioFile['status'] }) {
  switch (status) {
    case 'processing':
      return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
    case 'complete':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'error':
      return <AlertCircle className="h-4 w-4 text-destructive" />;
    default:
      return <FileAudio className="h-4 w-4 text-muted-foreground" />;
  }
}

export function FileQueue({
  files,
  onRemoveFile,
  onClearAll,
  onClearCompleted,
  onEditFile,
}: FileQueueProps) {
  const queuedCount = files.filter((f) => f.status === 'queued').length;
  const processingCount = files.filter((f) => f.status === 'processing').length;
  const completeCount = files.filter((f) => f.status === 'complete').length;

  if (files.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <FileAudio className="mx-auto mb-4 h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No files in queue</p>
        <p className="text-xs text-muted-foreground">
          Drop files above to get started
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-4">
          <h3 className="font-medium">Queue</h3>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono">
              {files.length.toLocaleString()} files
            </span>
            {queuedCount > 0 && (
              <span className="rounded-full bg-secondary px-2 py-0.5">
                {queuedCount} queued
              </span>
            )}
            {processingCount > 0 && (
              <span className="rounded-full bg-secondary px-2 py-0.5">
                {processingCount} processing
              </span>
            )}
            {completeCount > 0 && (
              <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-green-500">
                {completeCount} done
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {completeCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearCompleted}
              className="h-7 text-xs"
            >
              Clear done
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="h-7 text-xs text-destructive hover:text-destructive"
          >
            <Trash2 className="mr-1 h-3 w-3" />
            Clear all
          </Button>
        </div>
      </div>
      <ScrollArea className="h-[300px]">
        <div className="divide-y divide-border">
          {files.map((file) => (
            <div
              key={file.id}
              className={cn(
                'flex items-center gap-3 px-4 py-2 transition-colors',
                file.status === 'complete' && 'bg-green-500/5',
                file.status === 'error' && 'bg-destructive/5',
              )}
            >
              <FileStatusIcon status={file.status} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-sm">{file.name}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{formatFileSize(file.size)}</span>
                  {file.trimOverride && (
                    <span className="rounded bg-green-500/20 px-1.5 py-0.5 text-green-500">
                      trimmed
                    </span>
                  )}
                  {file.error && (
                    <span
                      className="rounded bg-destructive/20 px-1.5 py-0.5 text-destructive"
                      title={file.error}
                    >
                      error
                    </span>
                  )}
                  {file.result && (
                    <span className="font-mono text-green-500">
                      {formatFileSize(file.result.blob.size)}
                    </span>
                  )}
                </div>
              </div>
              {file.status === 'processing' && (
                <div className="w-20">
                  <div className="h-1 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full bg-foreground transition-all"
                      style={{ width: `${file.progress}%` }}
                    />
                  </div>
                </div>
              )}
              {file.status === 'complete' && file.result && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    downloadBlob(file.result!.blob, file.result!.filename)
                  }
                  className="h-6 w-6 shrink-0 text-green-500 hover:text-green-600"
                  title="Download processed file"
                >
                  <Download className="h-3 w-3" />
                  <span className="sr-only">Download</span>
                </Button>
              )}
              {file.status === 'queued' && onEditFile && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onEditFile(file.id)}
                  className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
                  title="Edit trim points"
                >
                  <Pencil className="h-3 w-3" />
                  <span className="sr-only">Edit trim</span>
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onRemoveFile(file.id)}
                className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
                <span className="sr-only">Remove file</span>
              </Button>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
