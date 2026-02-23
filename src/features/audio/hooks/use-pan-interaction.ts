import { useCallback, useRef } from "react";
import type { ViewState } from "@/features/audio/types/waveform-drawing";

interface UsePanInteractionProps {
  view: ViewState;
  setPanOffset: (offset: number) => void;
}

interface UsePanInteractionReturn {
  panStartRef: React.MutableRefObject<{ x: number; offset: number }>;
  handlePanStart: (clientX: number) => void;
  handlePanMove: (clientX: number, width: number) => void;
}

export function usePanInteraction({ view, setPanOffset }: UsePanInteractionProps): UsePanInteractionReturn {
  const panStartRef = useRef({ x: 0, offset: 0 });

  const handlePanStart = useCallback(
    (clientX: number) => {
      panStartRef.current = { x: clientX, offset: view.panOffset };
    },
    [view.panOffset],
  );

  const handlePanMove = useCallback(
    (clientX: number, width: number) => {
      const dx = clientX - panStartRef.current.x;
      const panDelta = (dx / width) * (view.duration / view.zoom);
      const newOffset = Math.max(
        0,
        Math.min(view.duration - view.duration / view.zoom, panStartRef.current.offset - panDelta),
      );
      setPanOffset(newOffset);
    },
    [view.duration, view.zoom, setPanOffset],
  );

  return {
    panStartRef,
    handlePanStart,
    handlePanMove,
  };
}
