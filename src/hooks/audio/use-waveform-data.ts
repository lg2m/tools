import { useEffect, useState } from "react";

interface WaveformData {
  samples: Float32Array;
  duration: number;
}

export function useWaveformData(audioUrl: string | null) {
  const [data, setData] = useState<WaveformData | null>(null);
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

        const channelData = audioBuffer.getChannelData(0);
        const samples = 2000;
        const blockSize = Math.floor(channelData.length / samples);
        const waveform = new Float32Array(samples);

        for (let i = 0; i < samples; i++) {
          let sum = 0;
          for (let j = 0; j < blockSize; j++) {
            sum += Math.abs(channelData[i * blockSize + j]);
          }
          waveform[i] = sum / blockSize;
        }

        setData({ samples: waveform, duration: audioBuffer.duration });
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
