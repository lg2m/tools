import type { ToolConfig } from '@/types/audio';
import { encodeMp3 } from './encoders/mp3';
import { encodeOgg } from './encoders/ogg';
import { encodeWav } from './encoders/wav';

export type ProcessingResult = {
  blob: Blob;
  filename: string;
  mimeType: string;
};

export type ProcessingProgress = {
  stage: 'decoding' | 'processing' | 'encoding';
  progress: number;
};

export async function decodeAudioFile(file: File): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new AudioContext();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  await audioContext.close();
  return audioBuffer;
}

export function trimAudio(
  buffer: AudioBuffer,
  startTime: number,
  endTime: number | null,
): AudioBuffer {
  const sampleRate = buffer.sampleRate;
  const startSample = Math.floor(startTime * sampleRate);
  const endSample =
    endTime !== null ? Math.floor(endTime * sampleRate) : buffer.length;

  const trimmedLength = Math.max(0, endSample - startSample);

  if (trimmedLength === 0 || startSample >= buffer.length) {
    const audioContext = new OfflineAudioContext(
      buffer.numberOfChannels,
      1,
      sampleRate,
    );
    return audioContext.createBuffer(buffer.numberOfChannels, 1, sampleRate);
  }

  const audioContext = new OfflineAudioContext(
    buffer.numberOfChannels,
    trimmedLength,
    sampleRate,
  );

  const trimmedBuffer = audioContext.createBuffer(
    buffer.numberOfChannels,
    trimmedLength,
    sampleRate,
  );

  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const sourceData = buffer.getChannelData(channel);
    const targetData = trimmedBuffer.getChannelData(channel);

    for (let i = 0; i < trimmedLength; i++) {
      targetData[i] = sourceData[startSample + i] ?? 0;
    }
  }

  return trimmedBuffer;
}

export async function resampleAudio(
  buffer: AudioBuffer,
  targetSampleRate: number,
): Promise<AudioBuffer> {
  if (buffer.sampleRate === targetSampleRate) {
    return buffer;
  }

  const duration = buffer.duration;
  const targetLength = Math.ceil(duration * targetSampleRate);

  const offlineContext = new OfflineAudioContext(
    buffer.numberOfChannels,
    targetLength,
    targetSampleRate,
  );

  const source = offlineContext.createBufferSource();
  source.buffer = buffer;
  source.connect(offlineContext.destination);
  source.start(0);

  return offlineContext.startRendering();
}

export function normalizeAudio(buffer: AudioBuffer): AudioBuffer {
  let peakAmplitude = 0;

  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < data.length; i++) {
      const absValue = Math.abs(data[i]);
      if (absValue > peakAmplitude) {
        peakAmplitude = absValue;
      }
    }
  }

  if (peakAmplitude < 0.001) {
    return buffer;
  }

  const targetPeak = 0.99;
  const gain = targetPeak / peakAmplitude;

  const audioContext = new OfflineAudioContext(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate,
  );

  const normalizedBuffer = audioContext.createBuffer(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate,
  );

  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const sourceData = buffer.getChannelData(channel);
    const targetData = normalizedBuffer.getChannelData(channel);

    for (let i = 0; i < sourceData.length; i++) {
      targetData[i] = sourceData[i] * gain;
    }
  }

  return normalizedBuffer;
}

export function convertToMono(buffer: AudioBuffer): AudioBuffer {
  if (buffer.numberOfChannels === 1) {
    return buffer;
  }

  const audioContext = new OfflineAudioContext(
    1,
    buffer.length,
    buffer.sampleRate,
  );
  const monoBuffer = audioContext.createBuffer(
    1,
    buffer.length,
    buffer.sampleRate,
  );
  const monoData = monoBuffer.getChannelData(0);

  for (let i = 0; i < buffer.length; i++) {
    let sum = 0;
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      sum += buffer.getChannelData(channel)[i];
    }
    monoData[i] = sum / buffer.numberOfChannels;
  }

  return monoBuffer;
}

export async function encodeAudio(
  buffer: AudioBuffer,
  format: string,
): Promise<Blob> {
  switch (format.toLowerCase()) {
    case 'wav':
      return encodeWav(buffer);
    case 'mp3':
      return encodeMp3(buffer);
    case 'ogg':
      return encodeOgg(buffer);
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}

export function getFormatExtension(format: string): string {
  switch (format.toLowerCase()) {
    case 'wav':
      return 'wav';
    case 'mp3':
      return 'mp3';
    case 'ogg':
      return 'ogg';
    default:
      return format;
  }
}

export function getFormatMimeType(format: string): string {
  switch (format.toLowerCase()) {
    case 'wav':
      return 'audio/wav';
    case 'mp3':
      return 'audio/mpeg';
    case 'ogg':
      return 'audio/ogg';
    default:
      return 'application/octet-stream';
  }
}

export async function processAudioFile(
  file: File,
  config: ToolConfig,
  trimOverride?: { start: number; end: number | null },
  onProgress?: (progress: ProcessingProgress) => void,
): Promise<ProcessingResult> {
  onProgress?.({ stage: 'decoding', progress: 0 });
  let buffer = await decodeAudioFile(file);
  onProgress?.({ stage: 'decoding', progress: 100 });

  onProgress?.({ stage: 'processing', progress: 0 });

  if (config.trim.enabled || trimOverride) {
    const trimStart = trimOverride?.start ?? config.trim.startTime;
    const trimEnd = trimOverride?.end ?? config.trim.endTime;
    buffer = trimAudio(buffer, trimStart, trimEnd);
  }
  onProgress?.({ stage: 'processing', progress: 25 });

  if (config.downsample.enabled) {
    buffer = await resampleAudio(buffer, config.downsample.targetSampleRate);
  }
  onProgress?.({ stage: 'processing', progress: 50 });

  if (config.normalize.enabled) {
    buffer = normalizeAudio(buffer);
  }
  onProgress?.({ stage: 'processing', progress: 75 });

  if (config.mono.enabled) {
    buffer = convertToMono(buffer);
  }
  onProgress?.({ stage: 'processing', progress: 100 });

  onProgress?.({ stage: 'encoding', progress: 0 });
  const outputFormat = config.convert.enabled
    ? config.convert.outputFormat
    : 'wav';
  const blob = await encodeAudio(buffer, outputFormat);
  onProgress?.({ stage: 'encoding', progress: 100 });

  const baseName = file.name.replace(/\.[^/.]+$/, '');
  const extension = getFormatExtension(outputFormat);
  const filename = `${baseName}.${extension}`;

  return {
    blob,
    filename,
    mimeType: getFormatMimeType(outputFormat),
  };
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function downloadMultipleBlobs(
  results: ProcessingResult[],
): Promise<void> {
  if (results.length === 1) {
    downloadBlob(results[0].blob, results[0].filename);
    return;
  }

  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  for (const result of results) {
    zip.file(result.filename, result.blob);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(zipBlob, 'audio-processed.zip');
}
