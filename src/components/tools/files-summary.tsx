import { Play, Download, X, FileIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

import { formatFileSize } from "@/lib/tools/utils";
import type { BaseFile } from "@/lib/tools/types";

interface FilesSummaryProps<T extends BaseFile> {
  files: T[];
  isProcessing: boolean;
  onProcess: () => void;
  onDownload: () => void;
  onClearAll: () => void;
  pipelineDescription: string[];
}

export function FilesSummary<T extends BaseFile>({
  files,
  isProcessing,
  onProcess,
  onDownload,
  onClearAll,
  pipelineDescription,
}: FilesSummaryProps<T>) {
  const queuedCount = files.filter((f) => f.status === "queued").length;
  const completeCount = files.filter((f) => f.status === "complete").length;
  const processingCount = files.filter((f) => f.status === "processing").length;
  const totalSize = files.reduce((acc, f) => acc + f.size, 0);

  const progress = files.length > 0 ? ((completeCount + processingCount * 0.5) / files.length) * 100 : 0;

  if (files.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
            <FileIcon className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="font-mono text-lg font-medium">{files.length.toLocaleString()} files</p>
            <p className="text-xs text-muted-foreground">{formatFileSize(totalSize)} total</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClearAll} className="h-8 w-8 text-muted-foreground">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {isProcessing && (
        <div className="border-b border-border px-4 py-3">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Processing...</span>
            <span className="font-mono text-foreground">{Math.round(progress)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div className="h-full bg-foreground transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {pipelineDescription.length > 0 && (
        <div className="border-b border-border px-4 py-3">
          <p className="mb-2 text-xs text-muted-foreground">Pipeline</p>
          <div className="flex flex-wrap gap-1.5">
            {pipelineDescription.map((op, i) => (
              <span key={i} className="rounded-full border border-border bg-secondary px-2 py-0.5 font-mono text-xs">
                {op}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 p-4">
        <Button
          className="flex-1"
          onClick={onProcess}
          disabled={queuedCount === 0 || isProcessing || pipelineDescription.length === 0}
        >
          <Play className="mr-2 h-4 w-4" />
          {isProcessing ? "Processing..." : `Process ${queuedCount > 0 ? queuedCount.toLocaleString() : "All"}`}
        </Button>
        <Button variant="outline" className="flex-1 bg-transparent" onClick={onDownload} disabled={completeCount === 0}>
          <Download className="mr-2 h-4 w-4" />
          Download {completeCount > 0 ? completeCount.toLocaleString() : ""}
        </Button>
      </div>
    </div>
  );
}
