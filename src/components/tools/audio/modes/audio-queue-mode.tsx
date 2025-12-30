import * as React from "react";

import { AudioWaveform, Tag } from "lucide-react";

import type { AudioFileData, AudioWorkflow } from "@/lib/tools/types";
import { QueueGrid } from "@/components/tools/queue-grid";

interface AudioQueueModeProps {
  files: AudioFileData[];
  selectedIds: Set<string>;
  workflow: AudioWorkflow;
  onSelect: (id: string, selected: boolean) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onRemove: (id: string) => void;
  onEdit: (id: string) => void;
}

export function AudioQueueMode({
  files,
  selectedIds,
  workflow,
  onSelect,
  onSelectAll,
  onDeselectAll,
  onRemove,
  onEdit,
}: AudioQueueModeProps) {
  return (
    <QueueGrid
      files={files}
      selectedIds={selectedIds}
      onSelect={onSelect}
      onSelectAll={onSelectAll}
      onDeselectAll={onDeselectAll}
      onRemove={onRemove}
      onEdit={onEdit}
      renderThumbnail={(_file) => (
        <div className="flex h-full items-center justify-center bg-secondary">
          <AudioWaveform className="h-8 w-8 text-muted-foreground" />
        </div>
      )}
      renderBadges={(file) => (
        <React.Fragment>
          {workflow === "process" && file.trimOverride && (
            <span className="rounded bg-green-500/20 px-1 py-0.5 text-[10px] text-green-500">trimmed</span>
          )}
          {workflow === "label" && file.segments && file.segments.length > 0 && (
            <span className="flex items-center gap-0.5 rounded bg-blue-500/20 px-1 py-0.5 text-[10px] text-blue-500">
              <Tag className="h-2.5 w-2.5" />
              {file.segments.length}
            </span>
          )}
          {workflow === "label" && file.fileLabel && (
            <span className="rounded bg-purple-500/20 px-1 py-0.5 text-[10px] text-purple-500">{file.fileLabel}</span>
          )}
        </React.Fragment>
      )}
    />
  );
}
