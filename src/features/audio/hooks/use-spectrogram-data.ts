import { useEffect, useState } from "react";

interface SpectrogramData {
  data: number[][];
  duration: number;
}

export function useSpectrogramData(audioUrl: string | null) {
  const [data, setData] = useState<SpectrogramData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!audioUrl) {
      setData(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const url = audioUrl; // Capture in closure for type safety

    async function load() {
      try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const audioContext = new AudioContext();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        if (cancelled) return;

        // Generate spectrogram data
        const channelData = audioBuffer.getChannelData(0);
        const fftSize = 2048;
        const frequencyBins = fftSize / 2;
        const timeSlices = 200;
        const samplesPerSlice = Math.floor(channelData.length / timeSlices);

        const spectrogramData: number[][] = [];

        for (let t = 0; t < timeSlices; t++) {
          const slice: number[] = [];
          const startSample = t * samplesPerSlice;

          for (let f = 0; f < frequencyBins / 8; f++) {
            // Simplified frequency analysis
            let sum = 0;
            const freqSamples = 32;
            for (let i = 0; i < freqSamples; i++) {
              const sample = startSample + f * freqSamples + i;
              if (sample < channelData.length) {
                sum += Math.abs(channelData[sample]);
              }
            }
            slice.push(sum / freqSamples);
          }
          spectrogramData.push(slice);
        }

        setData({ data: spectrogramData, duration: audioBuffer.duration });
      } catch (err) {
        if (!cancelled) setError(err as Error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [audioUrl]);

  return { data, loading, error };
}
