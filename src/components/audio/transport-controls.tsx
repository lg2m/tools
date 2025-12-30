import { Play, Pause, SkipBack, SkipForward, ZoomIn, ZoomOut } from "lucide-react";

interface TransportControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  zoom: number;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onPrevious: () => void;
  onNext: () => void;
  onZoomChange: (zoom: number) => void;
}

export function TransportControls({
  isPlaying,
  currentTime,
  duration,
  zoom,
  onPlayPause,
  onSeek,
  onPrevious,
  onNext,
  onZoomChange,
}: TransportControlsProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
  };

  return (
    <div className="border-t border-border bg-card px-4 py-3">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <button
            onClick={onPrevious}
            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
            title="Previous file (,)"
          >
            <SkipBack className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onPlayPause}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90"
            title="Play/Pause (Space)"
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-px" />}
          </button>
          <button
            onClick={onNext}
            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
            title="Next file (.)"
          >
            <SkipForward className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex flex-1 items-center gap-3">
          <div className="font-mono text-xs tabular-nums text-foreground">{formatTime(currentTime)}</div>
          <div className="relative flex-1">
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={(e) => onSeek(Number.parseFloat(e.target.value))}
              className="h-1 w-full cursor-pointer appearance-none rounded-full bg-muted [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-primary/30 [&::-webkit-slider-thumb]:transition-transform hover:[&::-webkit-slider-thumb]:scale-110"
            />
          </div>
          <div className="font-mono text-xs tabular-nums text-muted-foreground">{formatTime(duration)}</div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onZoomChange(Math.max(1, zoom - 1))}
            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
            title="Zoom out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <div className="min-w-[2.5rem] text-center font-mono text-[11px] text-muted-foreground">
            {zoom.toFixed(1)}x
          </div>
          <button
            onClick={() => onZoomChange(Math.min(20, zoom + 1))}
            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
            title="Zoom in"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
