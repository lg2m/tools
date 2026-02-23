import { useEffect, useLayoutEffect, useRef } from "react";

interface CanvasContext {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  dpr: number;
}

export function useCanvas(draw: (context: CanvasContext) => void) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Use useLayoutEffect for drawing to prevent visual flicker
  // This ensures canvas is drawn before browser paint
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    draw({ ctx, width: rect.width, height: rect.height, dpr });
  }, [draw]);

  // ResizeObserver can use regular useEffect since it already
  // fires at the right time in the browser's rendering pipeline
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleResize = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);

      draw({ ctx, width: rect.width, height: rect.height, dpr });
    };

    const observer = new ResizeObserver(handleResize);
    observer.observe(canvas);

    return () => observer.disconnect();
  }, [draw]);

  return canvasRef;
}
