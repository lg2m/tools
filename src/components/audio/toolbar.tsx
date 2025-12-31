import { cn } from "@/lib/utils";

interface ToolbarProps {
  files: { id: string }[];
  currentFileIndex: number;
  isPending: boolean;
  mode: "annotate" | "trim";
  viewMode: "waveform" | "spectrogram" | "both";
  onModeChange: (mode: "annotate" | "trim") => void;
  onViewModeChange: (mode: "waveform" | "spectrogram" | "both") => void;
  onToggleBatchProcessor: () => void;
  onToggleHotkeys: () => void;
}

export function Toolbar({
  files,
  currentFileIndex,
  isPending,
  mode,
  viewMode,
  onModeChange,
  onViewModeChange,
  onToggleBatchProcessor,
  onToggleHotkeys,
}: ToolbarProps) {
  return (
    <div className="flex items-center justify-between border-b border-border bg-card px-4 py-2.5 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-primary" />
          <h1 className="text-sm font-semibold tracking-tight text-foreground">Audio Annotator</h1>
        </div>
        <div className="ml-4 font-mono text-[11px] text-muted-foreground">
          {files.length > 0 ? `${currentFileIndex + 1} / ${files.length}` : "No files"}
          {isPending && <span className="ml-2 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onModeChange("annotate")}
          className={cn(
            "rounded px-2.5 py-1 text-[11px] font-medium transition-all",
            mode === "annotate"
              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          Annotate
        </button>
        <button
          type="button"
          onClick={() => onModeChange("trim")}
          disabled={files.length === 0}
          className={cn(
            "rounded px-2.5 py-1 text-[11px] font-medium transition-all disabled:opacity-30",
            mode === "trim"
              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          Trim
        </button>
        <button
          type="button"
          onClick={onToggleBatchProcessor}
          disabled={files.length === 0}
          className="rounded px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
        >
          Batch Operations
        </button>
        <div className="mx-1 h-4 w-px bg-border" />
        <button
          type="button"
          onClick={() => onViewModeChange("waveform")}
          className={cn(
            "rounded px-2.5 py-1 text-[11px] font-medium transition-all",
            viewMode === "waveform"
              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          Waveform
        </button>
        <button
          type="button"
          onClick={() => onViewModeChange("spectrogram")}
          className={cn(
            "rounded px-2.5 py-1 text-[11px] font-medium transition-all",
            viewMode === "spectrogram"
              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          Spectrogram
        </button>
        <button
          type="button"
          onClick={() => onViewModeChange("both")}
          className={cn(
            "rounded px-2.5 py-1 text-[11px] font-medium transition-all",
            viewMode === "both"
              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          Both
        </button>
        <div className="mx-2 h-4 w-px bg-border" />
        <button
          type="button"
          onClick={onToggleHotkeys}
          className="rounded px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <kbd className="font-mono text-[10px] text-muted-foreground">/</kbd>
        </button>
      </div>
    </div>
  );
}
