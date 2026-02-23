const TIME_DECIMAL_SCALES = [1, 10, 100, 1000] as const;

export function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function getSecondsPerPixel(duration: number, zoom: number, viewPx: number) {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  return duration / Math.max(zoom, 1e-6) / Math.max(viewPx, 1);
}

export function getTimeDecimals(secPerPx: number) {
  if (secPerPx >= 1) return 0;
  if (secPerPx >= 0.1) return 1;
  if (secPerPx >= 0.01) return 2;
  return 3;
}

export function formatTime(seconds: number, decimals = 2) {
  const time = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const safeDecimals = clampNumber(Math.trunc(decimals), 0, 3);

  if (safeDecimals === 0) {
    const totalSeconds = Math.floor(time);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds - mins * 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  const scale = TIME_DECIMAL_SCALES[safeDecimals];
  const totalScaledSeconds = Math.round(time * scale);
  const scaledMinute = 60 * scale;
  const mins = Math.floor(totalScaledSeconds / scaledMinute);
  const secsScaled = totalScaledSeconds - mins * scaledMinute;
  const secs = (secsScaled / scale).toFixed(safeDecimals).padStart(3 + safeDecimals, "0");

  return `${mins}:${secs}`;
}
