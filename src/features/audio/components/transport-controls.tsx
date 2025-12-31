import { useLayoutEffect, useMemo, useRef, useState } from "react";

import { ChevronLeft, ChevronRight, Pause, Play, SkipBack, SkipForward, ZoomIn, ZoomOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

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

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function getSecondsPerPixel(duration: number, zoom: number, viewPx: number) {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  const visible = duration / Math.max(zoom, 1e-6);
  return visible / Math.max(viewPx, 1);
}

function getTimeDecimalsFromSecPerPx(secPerPx: number) {
  if (secPerPx >= 1) return 0; // >= 1s per px
  if (secPerPx >= 0.1) return 1; // 100ms per px
  if (secPerPx >= 0.01) return 2; // 10ms per px
  return 3; // 1ms per px or tighter
}

function formatTime(seconds: number, decimals: number) {
  // clamp to [0, +inf), avoid negative due to rounding/dragging.
  const t = Math.max(0, Number.isFinite(seconds) ? seconds : 0);

  const mins = Math.floor(t / 60);
  const secs = t % 60;

  if (decimals === 0) {
    return `${mins}:${Math.floor(secs).toString().padStart(2, "0")}`;
  }

  const secStr = secs
    .toFixed(decimals) // "SS.mmm"
    .padStart(2 + 1 + decimals, "0");

  return `${mins}:${secStr}`;
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
  const wasPlayingRef = useRef(false);
  const isDraggingRef = useRef(false);

  const sliderWrapRef = useRef<HTMLDivElement | null>(null);
  const [sliderPx, setSliderPx] = useState(600);

  useLayoutEffect(() => {
    const el = sliderWrapRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    setSliderPx(Math.max(240, Math.round(rect.width)));

    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSliderPx(Math.max(240, Math.round(r.width)));
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const secPerPx = useMemo(() => getSecondsPerPixel(duration, zoom, sliderPx), [duration, zoom, sliderPx]);

  const displayDecimals = useMemo(() => {
    // when dragging/scrubbing, show one extra digit if possible.
    const base = getTimeDecimalsFromSecPerPx(secPerPx);
    return isDraggingRef.current ? clamp(base + 1, 0, 3) : base;
  }, [secPerPx, currentTime]); // currentTime to refresh while dragging

  const baseSeekStep = useMemo(() => {
    // slider step ~ 1px of time, clamped.
    const step = secPerPx; // 1px
    return clamp(step, 0.001, 0.05); // 1ms .. 50ms
  }, [secPerPx]);

  const seekStep = useMemo(() => {
    // TODO: implement hotkeys
    // Shift = finer, Alt = coarser, Ctrl/Meta = medium-fine
    let s = baseSeekStep;
    // if (mods.shift) s /= 10;
    // if (mods.ctrl || mods.meta) s /= 5;
    // if (mods.alt) s *= 10;
    return clamp(s, 0.0005, 0.25); // 0.5ms .. 250ms
  }, [baseSeekStep]);

  const nudge = (dir: -1 | 1, multiplier = 1) => {
    const t = clamp(currentTime + dir * seekStep * multiplier, 0, Math.max(0, duration));
    onSeek(t);
  };

  const timeNow = formatTime(currentTime, displayDecimals);
  const timeEnd = formatTime(duration, getTimeDecimalsFromSecPerPx(secPerPx));

  return (
    <div className="border-t border-border bg-card px-4 py-3">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="icon-sm" onClick={onPrevious} title="Previous file (,)">
            <SkipBack className="h-3.5 w-3.5" />
          </Button>

          <Button variant="default" size="icon" onClick={onPlayPause} title="Play/Pause (Space)">
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-px" />}
          </Button>

          <Button variant="ghost" size="icon-sm" onClick={onNext} title="Next file (.)">
            <SkipForward className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex flex-1 items-center gap-3">
          <div className="font-mono text-xs tabular-nums text-muted-foreground">{timeNow}</div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => nudge(-1)}
              title={`Nudge left (${(seekStep * 1000).toFixed(1)} ms) — ArrowLeft`}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => nudge(1)}
              title={`Nudge right (${(seekStep * 1000).toFixed(1)} ms) — ArrowRight`}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div ref={sliderWrapRef} className="relative flex-1">
            <Slider
              min={0}
              max={duration}
              value={[currentTime]}
              step={seekStep}
              onValueChange={(vals) => {
                // Scrubbing updates continuously.
                onSeek(vals[0]);
              }}
              onPointerDown={() => {
                isDraggingRef.current = true;
                wasPlayingRef.current = isPlaying;
                if (isPlaying) onPlayPause(); // stop while scrubbing
              }}
              onPointerUp={() => {
                isDraggingRef.current = false;
                if (wasPlayingRef.current) onPlayPause();
              }}
              className="h-4 cursor-pointer"
              disabled={!Number.isFinite(duration) || Number.isNaN(duration) || duration <= 0}
            />
          </div>
          <div className="font-mono text-xs tabular-nums text-muted-foreground">{timeEnd}</div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onZoomChange(clamp(zoom / 1.25, 1, 20))}
            title="Zoom out (-)"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <div className="min-w-[2.8rem] text-center font-mono text-[11px] text-muted-foreground">
            {zoom.toFixed(2)}x
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onZoomChange(Math.min(clamp(zoom * 1.25, 1, 20)))}
            title="Zoom in (+)"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
