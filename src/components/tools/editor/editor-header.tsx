import { ChevronLeft, ChevronRight, Save, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { HotkeysDisplay, type Hotkey } from "@/components/tools/editor/hotkeys-display";
import { ZoomControls } from "@/components/tools/editor/zoom-controls";

interface EditorHeaderProps {
  fileName: string;
  fileInfo: string;
  currentIndex: number;
  totalFiles: number;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onFitToView: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onSave: () => void;
  onReset?: () => void;
  onClose: () => void;
  hotkeys: Hotkey[];
  hasChanges?: boolean;
  extraControls?: React.ReactNode;
}

export function EditorHeader({
  fileName,
  fileInfo,
  currentIndex,
  totalFiles,
  zoom,
  onZoomChange,
  onFitToView,
  onPrevious,
  onNext,
  onSave,
  onReset,
  hotkeys,
  hasChanges,
}: EditorHeaderProps) {
  return (
    <div className="flex shrink-0 items-center justify-between border-b border-border bg-card/50 px-3 py-2">
      {/* Left: File info + navigation */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onPrevious} disabled={currentIndex === 0}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[3rem] text-center text-xs text-muted-foreground">
            {currentIndex + 1} / {totalFiles}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onNext}
            disabled={currentIndex === totalFiles - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{fileName}</p>
          <p className="text-[10px] text-muted-foreground">{fileInfo}</p>
        </div>
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-2">
        <ZoomControls zoom={zoom} onZoomChange={onZoomChange} onFitToView={onFitToView} />
        <HotkeysDisplay hotkeys={hotkeys} />
        <div className="h-4 w-px bg-border" />
        {onReset && (
          <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs text-muted-foreground" onClick={onReset}>
            <RotateCcw className="h-3 w-3" />
            Reset
          </Button>
        )}
        <Button
          onClick={onSave}
          size="sm"
          className={`h-7 gap-1 px-3 text-xs ${hasChanges ? "ring-2 ring-primary/50" : ""}`}
        >
          <Save className="h-3 w-3" />
          Save
        </Button>
      </div>
    </div>
  );
}
