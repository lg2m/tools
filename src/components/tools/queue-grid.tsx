import { ChevronDown, FileIcon, X, Pencil, CheckCircle, Loader2, AlertCircle } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { cn } from "@/lib/utils";
import type { BaseFile, FileStatus } from "@/lib/tools/types";
import { formatFileSize } from "@/lib/tools/utils";

interface QueueGridProps<T extends BaseFile> {
  files: T[];
  selectedIds: Set<string>;
  onSelect: (id: string, selected: boolean) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onRemove: (id: string) => void;
  onEdit: (id: string) => void;
  onClearAll?: () => void;
  onClearCompleted?: () => void;
  renderThumbnail: (file: T) => React.ReactNode;
  renderBadges?: (file: T) => React.ReactNode;
}

function StatusIcon({ status }: { status: FileStatus }) {
  switch (status) {
    case "processing":
      return <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />;
    case "complete":
      return <CheckCircle className="h-3 w-3 text-green-500" />;
    case "error":
      return <AlertCircle className="h-3 w-3 text-destructive" />;
    default:
      return null;
  }
}

export function QueueGrid<T extends BaseFile>({
  files,
  selectedIds,
  onSelect,
  onSelectAll,
  onDeselectAll,
  onRemove,
  onEdit,
  onClearAll,
  onClearCompleted,
  renderThumbnail,
  renderBadges,
}: QueueGridProps<T>) {
  const queuedCount = files.filter((f) => f.status === "queued").length;
  const completeCount = files.filter((f) => f.status === "complete").length;
  const withOverrides = files.filter((f) => f.hasOverrides).length;

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
        <FileIcon className="mb-4 h-10 w-10 text-muted-foreground" />
        <p className="mb-1 font-medium">No files in queue</p>
        <p className="text-sm text-muted-foreground">Switch to Bulk mode to add files</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-mono font-medium">{files.length.toLocaleString()} files</span>
          {selectedIds.size > 0 && (
            <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-foreground">
              {selectedIds.size} selected
            </span>
          )}
          {queuedCount > 0 && <span className="rounded-full bg-secondary px-2 py-0.5">{queuedCount} queued</span>}
          {completeCount > 0 && (
            <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-green-500">{completeCount} done</span>
          )}
          {withOverrides > 0 && (
            <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-blue-500">{withOverrides} edited</span>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 text-xs">
              Actions
              <ChevronDown className="ml-1 h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onSelectAll}>Select all</DropdownMenuItem>
            <DropdownMenuItem onClick={onDeselectAll}>Deselect all</DropdownMenuItem>
            <DropdownMenuSeparator />
            {completeCount > 0 && onClearCompleted && (
              <DropdownMenuItem onClick={onClearCompleted}>Clear completed</DropdownMenuItem>
            )}
            {onClearAll && (
              <DropdownMenuItem onClick={onClearAll} className="text-destructive focus:text-destructive">
                Clear all
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Grid */}
      <ScrollArea className="h-[500px]">
        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {files.map((file) => (
            <div
              key={file.id}
              className={cn(
                "group relative flex flex-col rounded-lg border border-border bg-secondary/30 transition-all hover:border-muted-foreground/50",
                selectedIds.has(file.id) && "border-foreground/50 ring-1 ring-foreground/20",
                file.status === "complete" && "bg-green-500/5",
              )}
            >
              {/* Thumbnail */}
              <div className="relative aspect-square overflow-hidden rounded-t-lg">{renderThumbnail(file)}</div>

              {/* Selection checkbox */}
              <div className="absolute left-2 top-2 z-10">
                <Checkbox
                  checked={selectedIds.has(file.id)}
                  onCheckedChange={(checked) => onSelect(file.id, checked === true)}
                  className="h-5 w-5 border-2 bg-background/80 backdrop-blur"
                />
              </div>

              {/* Status indicator */}
              <div className="absolute right-2 top-2 z-10">
                <StatusIcon status={file.status} />
              </div>

              {/* Actions (show on hover) */}
              <div className="absolute right-2 top-2 z-10 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                {file.status === "queued" && (
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => onEdit(file.id)}
                    title="Edit"
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => onRemove(file.id)}
                  title="Remove"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>

              {/* Info */}
              <div className="flex flex-1 flex-col gap-1 p-2">
                <p className="truncate text-xs font-medium" title={file.name}>
                  {file.name}
                </p>
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-[10px] text-muted-foreground">{formatFileSize(file.size)}</span>
                  {renderBadges?.(file)}
                </div>
              </div>

              {/* Progress */}
              {file.status === "processing" && (
                <div className="absolute inset-x-0 bottom-0 h-1 overflow-hidden rounded-b-lg bg-secondary">
                  <div className="h-full bg-foreground transition-all" style={{ width: `${file.progress}%` }} />
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
