import { CheckCircle2, Loader2 } from "lucide-react";

interface BatchProgressCardProps {
  isProcessing: boolean;
  totalItems: number;
  percent: number;
  queuedItems: number;
  runningItems: number;
  successfulItems: number;
  failedItems: number;
  activeItemLabel?: string;
  failedItemLabels?: string[];
  runningStepLabel?: string;
}

export function BatchProgressCard({
  isProcessing,
  totalItems,
  percent,
  queuedItems,
  runningItems,
  successfulItems,
  failedItems,
  activeItemLabel,
  failedItemLabels = [],
  runningStepLabel,
}: BatchProgressCardProps) {
  const hasResults = successfulItems > 0 || failedItems > 0;
  if (!isProcessing && !hasResults) return null;

  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
      <div className="flex items-center gap-2 text-sm">
        {isProcessing ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Processing {totalItems} item(s)...
          </>
        ) : (
          <>
            <CheckCircle2 className="size-4 text-emerald-500" />
            Batch processing complete
          </>
        )}
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary transition-all duration-300" style={{ width: `${percent}%` }} />
      </div>

      <div className="text-muted-foreground flex items-center justify-between text-xs">
        <span className="font-mono">{percent}%</span>
        <span>
          Queued {queuedItems} - Running {runningItems} - Done {successfulItems} - Failed {failedItems}
        </span>
      </div>

      {activeItemLabel ? (
        <div className="text-muted-foreground rounded-md border bg-background px-3 py-2 text-xs">
          {activeItemLabel} - {runningStepLabel ?? "Finalizing"}...
        </div>
      ) : null}

      {failedItemLabels.length > 0 ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          Failed: {failedItemLabels.join(", ")}
        </div>
      ) : null}
    </div>
  );
}
