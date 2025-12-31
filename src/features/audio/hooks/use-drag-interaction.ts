import { useRef, useState } from "react";

type DragMode = "none" | "create" | "move" | "resize-start" | "resize-end" | "pan";

interface DragResult<T> {
  mode: DragMode;
  startX: number | null;
  endX: number | null;
  initialValue: T | null;
}

export function useDragInteraction<T = unknown>() {
  const [mode, setMode] = useState<DragMode>("none");
  const startXRef = useRef<number | null>(null);
  const [currentX, setCurrentX] = useState<number | null>(null);
  const initialValueRef = useRef<T | null>(null);

  const startDrag = (newMode: DragMode, x: number, initialValue?: T) => {
    setMode(newMode);
    startXRef.current = x;
    setCurrentX(x);
    initialValueRef.current = initialValue ?? null;
  };

  const updateDrag = (x: number) => {
    setCurrentX(x);
  };

  const endDrag = (): DragResult<T> => {
    const result: DragResult<T> = {
      mode,
      startX: startXRef.current,
      endX: currentX,
      initialValue: initialValueRef.current,
    };

    setMode("none");
    startXRef.current = null;
    setCurrentX(null);
    initialValueRef.current = null;

    return result;
  };

  return {
    mode,
    startX: startXRef.current,
    currentX,
    initialValue: initialValueRef.current,
    isDragging: mode !== "none",
    startDrag,
    updateDrag,
    endDrag,
  };
}
