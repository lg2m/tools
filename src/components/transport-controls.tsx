import { ChevronLeft, ChevronRight, Pause, Play, SkipBack, SkipForward, ZoomIn, ZoomOut } from "lucide-react";
import type { ReactNode } from "react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { clampNumber, formatTime, getSecondsPerPixel, getTimeDecimals } from "@/lib/time";

function IconButton({ tooltip, children, ...props }: React.ComponentProps<typeof Button> & { tooltip: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button {...props}>{children}</Button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

/** Navigation controls configuration */
interface NavigationConfig {
  onPrevious: () => void;
  onNext: () => void;
  previousTitle?: string;
  nextTitle?: string;
}

/** Zoom controls configuration */
interface ZoomConfig {
  zoom: number;
  onZoomChange: (zoom: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

export interface TransportControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  /** Optional navigation (prev/next file, frame, etc.) */
  navigation?: NavigationConfig;
  /** Optional zoom controls */
  zoom?: ZoomConfig;
}

export function TransportControls({
  isPlaying,
  currentTime,
  duration,
  onPlayPause,
  onSeek,
  navigation,
  zoom: zoomConfig,
}: TransportControlsProps) {
  const wasPlayingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);
  const [sliderPx, setSliderPx] = useState(600);

  useLayoutEffect(() => {
    const el = sliderRef.current;
    if (!el) return;

    const update = () => setSliderPx(Math.max(240, Math.round(el.getBoundingClientRect().width)));
    update();

    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const zoom = zoomConfig?.zoom ?? 1;
  const secPerPx = useMemo(() => getSecondsPerPixel(duration, zoom, sliderPx), [duration, zoom, sliderPx]);
  const displayDecimals = useMemo(() => {
    const base = getTimeDecimals(secPerPx);
    return isDragging ? clampNumber(base + 1, 0, 3) : base;
  }, [secPerPx, isDragging]);

  const seekStep = useMemo(() => clampNumber(secPerPx, 0.001, 0.05), [secPerPx]);

  const nudge = (dir: -1 | 1) => {
    onSeek(clampNumber(currentTime + dir * seekStep, 0, Math.max(0, duration)));
  };

  const isDisabled = !Number.isFinite(duration) || duration <= 0;

  const playPauseButton = (
    <IconButton variant="default" size="icon" onClick={onPlayPause} tooltip="Play/Pause (Space)">
      {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-px" />}
    </IconButton>
  );

  return (
    <div className="border-t border-border bg-card px-4 py-3">
      <div className="flex items-center gap-4">
        {/* Navigation controls */}
        {navigation ? (
          <div className="flex items-center gap-1.5">
            <IconButton
              variant="ghost"
              size="icon-sm"
              onClick={navigation.onPrevious}
              tooltip={navigation.previousTitle ?? "Previous"}
            >
              <SkipBack className="h-3.5 w-3.5" />
            </IconButton>
            {playPauseButton}
            <IconButton
              variant="ghost"
              size="icon-sm"
              onClick={navigation.onNext}
              tooltip={navigation.nextTitle ?? "Next"}
            >
              <SkipForward className="h-3.5 w-3.5" />
            </IconButton>
          </div>
        ) : (
          playPauseButton
        )}

        {/* Timeline */}
        <div className="flex flex-1 items-center gap-3">
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {formatTime(currentTime, displayDecimals)}
          </span>

          <div className="flex items-center gap-1">
            <IconButton
              variant="ghost"
              size="icon-sm"
              onClick={() => nudge(-1)}
              tooltip={`Nudge left (${(seekStep * 1000).toFixed(1)} ms)`}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </IconButton>
            <IconButton
              variant="ghost"
              size="icon-sm"
              onClick={() => nudge(1)}
              tooltip={`Nudge right (${(seekStep * 1000).toFixed(1)} ms)`}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </IconButton>
          </div>

          <div ref={sliderRef} className="relative flex-1">
            <Slider
              min={0}
              max={duration}
              value={[currentTime]}
              step={seekStep}
              onValueChange={([v]) => onSeek(v)}
              onPointerDown={() => {
                setIsDragging(true);
                wasPlayingRef.current = isPlaying;
                if (isPlaying) onPlayPause();
              }}
              onPointerUp={() => {
                setIsDragging(false);
                if (wasPlayingRef.current) onPlayPause();
              }}
              className="h-4 cursor-pointer"
              disabled={isDisabled}
            />
          </div>

          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {formatTime(duration, getTimeDecimals(secPerPx))}
          </span>
        </div>

        {/* Zoom controls */}
        {zoomConfig && (
          <div className="flex items-center gap-1.5">
            <IconButton
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                const { min = 1, max = 20, step = 1.25 } = zoomConfig;
                zoomConfig.onZoomChange(clampNumber(zoomConfig.zoom / step, min, max));
              }}
              tooltip="Zoom out (-)"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </IconButton>
            <span className="min-w-[2.8rem] text-center font-mono text-[11px] text-muted-foreground">
              {zoomConfig.zoom.toFixed(2)}x
            </span>
            <IconButton
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                const { min = 1, max = 20, step = 1.25 } = zoomConfig;
                zoomConfig.onZoomChange(clampNumber(zoomConfig.zoom * step, min, max));
              }}
              tooltip="Zoom in (+)"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </IconButton>
          </div>
        )}
      </div>
    </div>
  );
}
