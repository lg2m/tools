import { Play, Download, StopCircle, Settings2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { AudioFile, ToolConfig } from '@/types/audio';

type ProcessingControlsProps = {
  files: AudioFile[];
  config: ToolConfig;
};

export function ProcessingControls({ files, config }: ProcessingControlsProps) {
  const queuedFiles = files.filter((f) => f.status === 'queued');
  const completedFiles = files.filter((f) => f.status === 'complete');
  const isProcessing = files.some((f) => f.status === 'processing');

  const enabledOperations = [
    config.convert.enabled && `→ ${config.convert.outputFormat.toUpperCase()}`,
    config.downsample.enabled &&
      `${(config.downsample.targetSampleRate / 1000).toFixed(config.downsample.targetSampleRate % 1000 === 0 ? 0 : 2)} kHz`,
    config.trim.enabled && 'trim',
    config.normalize.enabled && 'normalize',
    config.mono.enabled && 'mono',
  ].filter(Boolean);

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h3 className="font-medium">Process</h3>
        <p className="text-xs text-muted-foreground">
          Run operations on queued files
        </p>
      </div>
      <div className="p-4">
        {enabledOperations.length > 0 ? (
          <div className="mb-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Settings2 className="h-3 w-3" />
              <span>Pipeline:</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {enabledOperations.map((op, i) => (
                <span
                  key={i}
                  className="rounded-full border border-border bg-secondary px-2 py-0.5 font-mono text-xs"
                >
                  {op}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <p className="mb-4 text-sm text-muted-foreground">
            Enable at least one operation in settings
          </p>
        )}

        <div className="space-y-2">
          <Button
            className="w-full"
            disabled={
              queuedFiles.length === 0 ||
              enabledOperations.length === 0 ||
              isProcessing
            }
          >
            {isProcessing ? (
              <>
                <StopCircle className="mr-2 h-4 w-4" />
                Processing...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Process {queuedFiles.length.toLocaleString()}{' '}
                {queuedFiles.length === 1 ? 'file' : 'files'}
              </>
            )}
          </Button>
          <Button
            variant="outline"
            className="w-full bg-transparent"
            disabled={completedFiles.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            Download{' '}
            {completedFiles.length > 0 ? `${completedFiles.length} ` : ''}
            Results
          </Button>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          All processing runs locally in your browser
        </p>
      </div>
    </div>
  );
}
