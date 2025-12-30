import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

interface ZoomControlsProps {
  zoom: number;
  minZoom?: number;
  maxZoom?: number;
  onZoomChange: (zoom: number) => void;
  onFitToView?: () => void;
  className?: string;
  showSlider?: boolean;
}

export function ZoomControls({
  zoom,
  minZoom = 0.1,
  maxZoom = 10,
  onZoomChange,
  onFitToView,
  className,
  showSlider = false,
}: ZoomControlsProps) {
  const handleZoomIn = () => {
    onZoomChange(Math.min(maxZoom, zoom * 1.25));
  };

  const handleZoomOut = () => {
    onZoomChange(Math.max(minZoom, zoom / 1.25));
  };

  // Convert zoom to slider value (logarithmic scale for natural feel)
  const zoomToSlider = (z: number) => {
    const minLog = Math.log(minZoom);
    const maxLog = Math.log(maxZoom);
    return ((Math.log(z) - minLog) / (maxLog - minLog)) * 100;
  };

  const sliderToZoom = (v: number) => {
    const minLog = Math.log(minZoom);
    const maxLog = Math.log(maxZoom);
    return Math.exp(minLog + (v / 100) * (maxLog - minLog));
  };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomOut} title="Zoom out">
        <ZoomOut className="h-4 w-4" />
      </Button>

      {showSlider ? (
        <div className="w-20">
          <Slider
            value={[zoomToSlider(zoom)]}
            onValueChange={([v]) => onZoomChange(sliderToZoom(v))}
            min={0}
            max={100}
            step={1}
            className="h-7"
          />
        </div>
      ) : (
        <span className="w-12 text-center font-mono text-xs text-muted-foreground">{Math.round(zoom * 100)}%</span>
      )}

      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomIn} title="Zoom in">
        <ZoomIn className="h-4 w-4" />
      </Button>

      {onFitToView && (
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onFitToView} title="Fit to view">
          <Maximize2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
