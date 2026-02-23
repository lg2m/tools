import { useEffect, useState } from "react";

export function useAudioData<T>(audioUrl: string | null, processor: (audioBuffer: AudioBuffer) => T) {
  const [data, setData] = useState<{ result: T; duration: number } | null>(null);
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

    const url = audioUrl;

    async function load() {
      try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const audioContext = new AudioContext();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        if (cancelled) return;

        const result = processor(audioBuffer);
        setData({ result, duration: audioBuffer.duration });
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
  }, [audioUrl, processor]);

  return { data, loading, error };
}

export function processWaveform(audioBuffer: AudioBuffer): Float32Array {
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

  return waveform;
}

export function processSpectrogram(audioBuffer: AudioBuffer): number[][] {
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

  return spectrogramData;
}
