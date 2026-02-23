import type { AudioFile } from "@/types/audio";

export interface ProcessingOptions {
  resample: { enabled: boolean; targetRate: number };
  convert: { enabled: boolean; format: "wav" | "mp3" };
  mono: { enabled: boolean };
  highpass: { enabled: boolean; cutoffHz: number };
  silence: { enabled: boolean; thresholdDb: number; minDurationMs: number };
  normalize: { enabled: boolean; targetDb: number };
  bitDepth: { enabled: boolean; targetBitDepth: 16 | 24 | 32 };
  trim: { enabled: boolean; usePerFileTrim: boolean; globalStart: number; globalEnd: number };
}

export type ProcessingStep =
  | "trim"
  | "silence"
  | "resample"
  | "mono"
  | "highpass"
  | "normalize"
  | "bitDepth"
  | "convert";
export type FileStatus = "queued" | "running" | "success" | "failed";

export interface FileProcessingState {
  fileId: string;
  fileName: string;
  status: FileStatus;
  step?: ProcessingStep;
  message?: string;
}

export interface AggregateProgress {
  totalFiles: number;
  queuedFiles: number;
  runningFiles: number;
  successfulFiles: number;
  failedFiles: number;
  percent: number;
}

export interface BatchProgressUpdate {
  file: FileProcessingState;
  aggregate: AggregateProgress;
  output?: ProcessedAudioOutput;
}

export interface ProcessedAudioOutput {
  fileId: string;
  fileName: string;
  blob: Blob;
  mimeType: string;
  format: "wav" | "mp3";
  bitDepth: 16 | 24 | 32 | null;
  duration: number;
  sampleRate: number;
  channels: number;
}

export interface BatchProcessorConfig {
  signal?: AbortSignal;
  stepDelayMs?: number;
}

const PROCESSING_STEPS: readonly ProcessingStep[] = [
  "trim",
  "silence",
  "resample",
  "mono",
  "highpass",
  "normalize",
  "bitDepth",
  "convert",
];
const DEFAULT_STEP_DELAY_MS = 120;
const DEFAULT_OUTPUT_BIT_DEPTH = 16 as const;
const MP3_ENCODING_QUALITY = 2;
const MP3_ENCODE_CHUNK_SIZE = 1152 * 8;

const PROCESSING_STEP_LABELS: Record<ProcessingStep, string> = {
  trim: "Trim range",
  silence: "Silence trim",
  resample: "Resample",
  mono: "Convert to mono",
  highpass: "High-pass filter",
  normalize: "Normalize loudness",
  bitDepth: "Bit depth conversion",
  convert: "Format conversion",
};

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    try {
      throwIfAborted(signal);

      const timeoutId = globalThis.setTimeout(resolve, ms);
      const onAbort = () => {
        globalThis.clearTimeout(timeoutId);
        reject(new DOMException("Aborted", "AbortError"));
      };

      signal?.addEventListener("abort", onAbort, { once: true });
    } catch (error) {
      reject(error);
    }
  });
}

function getEnabledSteps(options: ProcessingOptions): ProcessingStep[] {
  return PROCESSING_STEPS.filter((step) => options[step].enabled);
}

function buildAggregate(fileStates: ReadonlyMap<string, FileProcessingState>, percent: number): AggregateProgress {
  let queuedFiles = 0;
  let runningFiles = 0;
  let successfulFiles = 0;
  let failedFiles = 0;

  for (const state of fileStates.values()) {
    switch (state.status) {
      case "queued":
        queuedFiles += 1;
        break;
      case "running":
        runningFiles += 1;
        break;
      case "success":
        successfulFiles += 1;
        break;
      case "failed":
        failedFiles += 1;
        break;
    }
  }

  return {
    totalFiles: fileStates.size,
    queuedFiles,
    runningFiles,
    successfulFiles,
    failedFiles,
    percent,
  };
}

function getRequired(map: ReadonlyMap<string, FileProcessingState>, key: string): FileProcessingState {
  const value = map.get(key);
  if (!value) throw new Error(`Invariant violated: missing file state for "${key}"`);
  return value;
}

function snapshot(state: FileProcessingState): FileProcessingState {
  return { ...state };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function validateTargetSampleRate(targetRate: number): number {
  if (!Number.isFinite(targetRate) || targetRate <= 0) {
    throw new Error("Target sample rate must be a finite positive number");
  }

  return Math.round(targetRate);
}

export function calculateResampledFrameLength(sourceLength: number, sourceRate: number, targetRate: number): number {
  if (!Number.isFinite(sourceLength) || sourceLength <= 0) {
    throw new Error("Source length must be a finite positive number");
  }
  if (!Number.isFinite(sourceRate) || sourceRate <= 0) {
    throw new Error("Source sample rate must be a finite positive number");
  }

  const validatedTargetRate = validateTargetSampleRate(targetRate);
  return Math.max(1, Math.ceil((sourceLength / sourceRate) * validatedTargetRate));
}

export function validateHighpassCutoffHz(cutoffHz: number, sampleRate: number): number {
  if (!Number.isFinite(cutoffHz) || cutoffHz <= 0) {
    throw new Error("High-pass cutoff must be a finite positive number");
  }
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new Error("Sample rate must be a finite positive number");
  }

  const nyquist = sampleRate / 2;
  if (nyquist <= 1) {
    throw new Error("Sample rate is too low for high-pass filtering");
  }

  return clamp(cutoffHz, 1, nyquist - 0.001);
}

export function dbToAmplitude(db: number): number {
  if (!Number.isFinite(db)) {
    throw new Error("dB value must be finite");
  }

  return 10 ** (db / 20);
}

export function quantizeSampleToBitDepth(sample: number, targetBitDepth: 16 | 24 | 32): number {
  if (!Number.isFinite(sample)) {
    throw new Error("Audio sample must be finite");
  }

  const clampedSample = clamp(sample, -1, 1);
  if (targetBitDepth === 32) return clampedSample;

  const negativeScale = 2 ** (targetBitDepth - 1);
  const positiveScale = negativeScale - 1;

  if (clampedSample < 0) {
    return Math.round(clampedSample * negativeScale) / negativeScale;
  }

  return Math.round(clampedSample * positiveScale) / positiveScale;
}

export function getOutputFormat(options: ProcessingOptions): "wav" | "mp3" {
  return options.convert.enabled ? options.convert.format : "wav";
}

export function getOutputBitDepth(options: ProcessingOptions): 16 | 24 | 32 {
  return options.bitDepth.enabled ? options.bitDepth.targetBitDepth : DEFAULT_OUTPUT_BIT_DEPTH;
}

function replaceExtension(fileName: string, nextExtension: string): string {
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex <= 0) return `${fileName}.${nextExtension}`;
  return `${fileName.slice(0, dotIndex)}.${nextExtension}`;
}

async function decodeAudio(file: AudioFile, signal?: AbortSignal): Promise<AudioBuffer> {
  throwIfAborted(signal);

  const response = await fetch(file.url, { signal });
  if (!response.ok) {
    throw new Error(`Failed to load audio file: ${file.name}`);
  }

  const encoded = await response.arrayBuffer();
  throwIfAborted(signal);

  const context = new AudioContext();
  try {
    const decoded = await context.decodeAudioData(encoded.slice(0));
    throwIfAborted(signal);
    return decoded;
  } finally {
    await context.close();
  }
}

export function getTrimRangeSeconds(
  file: AudioFile,
  options: ProcessingOptions["trim"],
  duration: number,
): { start: number; end: number } {
  const rawStart = options.usePerFileTrim ? (file.trimStart ?? 0) : options.globalStart;
  const rawEnd = options.usePerFileTrim
    ? (file.trimEnd ?? duration)
    : options.globalEnd > 0
      ? options.globalEnd
      : duration;

  const start = clamp(rawStart, 0, duration);
  const end = clamp(rawEnd, 0, duration);

  if (end <= start) {
    throw new Error(`Invalid trim range for ${file.name}: start must be less than end`);
  }

  return { start, end };
}

export function downmixChannelsToMono(channels: readonly Float32Array[]): Float32Array {
  if (channels.length === 0) {
    throw new Error("Cannot downmix audio without channels");
  }

  const length = channels[0].length;
  for (let channelIndex = 1; channelIndex < channels.length; channelIndex++) {
    if (channels[channelIndex].length !== length) {
      throw new Error("Cannot downmix channels with different lengths");
    }
  }

  const mono = new Float32Array(length);
  for (let sampleIndex = 0; sampleIndex < length; sampleIndex++) {
    let sum = 0;
    for (let channelIndex = 0; channelIndex < channels.length; channelIndex++) {
      sum += channels[channelIndex][sampleIndex];
    }
    mono[sampleIndex] = sum / channels.length;
  }

  return mono;
}

export function computePeakNormalizationGain(targetDb: number, peakAmplitude: number): number {
  if (!Number.isFinite(targetDb)) {
    throw new Error("Normalization target must be a finite dB value");
  }

  if (peakAmplitude < 0 || !Number.isFinite(peakAmplitude)) {
    throw new Error("Peak amplitude must be a finite positive number");
  }

  if (peakAmplitude === 0) return 1;

  const targetAmplitude = 10 ** (targetDb / 20);
  return targetAmplitude / peakAmplitude;
}

export function getPeakAmplitude(channels: readonly Float32Array[]): number {
  if (channels.length === 0) {
    throw new Error("Cannot measure peak amplitude without channels");
  }

  let peak = 0;
  for (const channel of channels) {
    for (let sampleIndex = 0; sampleIndex < channel.length; sampleIndex++) {
      const magnitude = Math.abs(channel[sampleIndex]);
      if (magnitude > peak) peak = magnitude;
    }
  }

  return peak;
}

export function calculateSilenceTrimFrames(
  channels: readonly Float32Array[],
  sampleRate: number,
  thresholdDb: number,
  minDurationMs: number,
): { startFrame: number; endFrame: number } {
  if (channels.length === 0) {
    throw new Error("Cannot detect silence without channels");
  }
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new Error("Sample rate must be a finite positive number");
  }
  if (!Number.isFinite(minDurationMs) || minDurationMs < 0) {
    throw new Error("Minimum silence duration must be a finite non-negative number");
  }

  const frameCount = channels[0].length;
  for (let channelIndex = 1; channelIndex < channels.length; channelIndex++) {
    if (channels[channelIndex].length !== frameCount) {
      throw new Error("Cannot detect silence with mismatched channel lengths");
    }
  }

  const thresholdAmplitude = dbToAmplitude(thresholdDb);
  const minSilenceFrames = Math.max(1, Math.round((sampleRate * minDurationMs) / 1000));

  let firstNonSilentFrame = -1;
  for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
    let isFrameSilent = true;
    for (let channelIndex = 0; channelIndex < channels.length; channelIndex++) {
      if (Math.abs(channels[channelIndex][frameIndex]) > thresholdAmplitude) {
        isFrameSilent = false;
        break;
      }
    }

    if (!isFrameSilent) {
      firstNonSilentFrame = frameIndex;
      break;
    }
  }

  if (firstNonSilentFrame === -1) {
    return { startFrame: 0, endFrame: frameCount };
  }

  let lastNonSilentFrame = firstNonSilentFrame;
  for (let frameIndex = frameCount - 1; frameIndex >= firstNonSilentFrame; frameIndex--) {
    let isFrameSilent = true;
    for (let channelIndex = 0; channelIndex < channels.length; channelIndex++) {
      if (Math.abs(channels[channelIndex][frameIndex]) > thresholdAmplitude) {
        isFrameSilent = false;
        break;
      }
    }

    if (!isFrameSilent) {
      lastNonSilentFrame = frameIndex;
      break;
    }
  }

  const leadingSilenceFrames = firstNonSilentFrame;
  const trailingSilenceFrames = frameCount - (lastNonSilentFrame + 1);
  const startFrame = leadingSilenceFrames >= minSilenceFrames ? firstNonSilentFrame : 0;
  const endFrame = trailingSilenceFrames >= minSilenceFrames ? lastNonSilentFrame + 1 : frameCount;

  return { startFrame, endFrame };
}

function trimAudioBuffer(audioBuffer: AudioBuffer, startSeconds: number, endSeconds: number): AudioBuffer {
  const startFrame = Math.floor(startSeconds * audioBuffer.sampleRate);
  const endFrame = Math.ceil(endSeconds * audioBuffer.sampleRate);
  const frameCount = Math.max(endFrame - startFrame, 1);
  const trimmed = new AudioBuffer({
    numberOfChannels: audioBuffer.numberOfChannels,
    length: frameCount,
    sampleRate: audioBuffer.sampleRate,
  });

  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const source = audioBuffer.getChannelData(channel).subarray(startFrame, endFrame);
    trimmed.copyToChannel(source, channel, 0);
  }

  return trimmed;
}

function applyBitDepthToAudioBuffer(
  audioBuffer: AudioBuffer,
  targetBitDepth: 16 | 24 | 32,
  signal?: AbortSignal,
): AudioBuffer {
  if (targetBitDepth === 32) return audioBuffer;

  const converted = new AudioBuffer({
    numberOfChannels: audioBuffer.numberOfChannels,
    length: audioBuffer.length,
    sampleRate: audioBuffer.sampleRate,
  });

  for (let channelIndex = 0; channelIndex < audioBuffer.numberOfChannels; channelIndex++) {
    const source = audioBuffer.getChannelData(channelIndex);
    const destination = converted.getChannelData(channelIndex);

    for (let sampleIndex = 0; sampleIndex < source.length; sampleIndex++) {
      if (sampleIndex % 16384 === 0) {
        throwIfAborted(signal);
      }

      destination[sampleIndex] = quantizeSampleToBitDepth(source[sampleIndex], targetBitDepth);
    }
  }

  return converted;
}

function convertToMono(audioBuffer: AudioBuffer, signal?: AbortSignal): AudioBuffer {
  if (audioBuffer.numberOfChannels === 1) return audioBuffer;

  const mono = new AudioBuffer({
    numberOfChannels: 1,
    length: audioBuffer.length,
    sampleRate: audioBuffer.sampleRate,
  });
  const channelData = Array.from({ length: audioBuffer.numberOfChannels }, (_, index) =>
    audioBuffer.getChannelData(index),
  );
  for (let sampleIndex = 0; sampleIndex < audioBuffer.length; sampleIndex += 16384) {
    throwIfAborted(signal);
  }

  mono.getChannelData(0).set(downmixChannelsToMono(channelData));

  return mono;
}

function normalizeAudioBuffer(audioBuffer: AudioBuffer, targetDb: number, signal?: AbortSignal): AudioBuffer {
  const channels = Array.from({ length: audioBuffer.numberOfChannels }, (_, index) =>
    audioBuffer.getChannelData(index),
  );
  const peakAmplitude = getPeakAmplitude(channels);
  const gain = computePeakNormalizationGain(targetDb, peakAmplitude);

  if (gain === 1) return audioBuffer;

  const normalized = new AudioBuffer({
    numberOfChannels: audioBuffer.numberOfChannels,
    length: audioBuffer.length,
    sampleRate: audioBuffer.sampleRate,
  });

  for (let channelIndex = 0; channelIndex < audioBuffer.numberOfChannels; channelIndex++) {
    const source = audioBuffer.getChannelData(channelIndex);
    const destination = normalized.getChannelData(channelIndex);

    for (let sampleIndex = 0; sampleIndex < source.length; sampleIndex++) {
      if (sampleIndex % 16384 === 0) {
        throwIfAborted(signal);
      }

      destination[sampleIndex] = source[sampleIndex] * gain;
    }
  }

  return normalized;
}

async function resampleAudioBuffer(
  audioBuffer: AudioBuffer,
  targetRate: number,
  signal?: AbortSignal,
): Promise<AudioBuffer> {
  const validatedTargetRate = validateTargetSampleRate(targetRate);
  if (audioBuffer.sampleRate === validatedTargetRate) return audioBuffer;

  throwIfAborted(signal);

  const frameLength = calculateResampledFrameLength(audioBuffer.length, audioBuffer.sampleRate, validatedTargetRate);
  const offlineContext = new OfflineAudioContext(audioBuffer.numberOfChannels, frameLength, validatedTargetRate);
  const source = offlineContext.createBufferSource();

  source.buffer = audioBuffer;
  source.connect(offlineContext.destination);
  source.start(0);

  const rendered = await offlineContext.startRendering();
  source.disconnect();
  throwIfAborted(signal);

  return rendered;
}

async function highpassAudioBuffer(
  audioBuffer: AudioBuffer,
  cutoffHz: number,
  signal?: AbortSignal,
): Promise<AudioBuffer> {
  throwIfAborted(signal);

  const validatedCutoffHz = validateHighpassCutoffHz(cutoffHz, audioBuffer.sampleRate);
  const offlineContext = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    audioBuffer.sampleRate,
  );
  const source = offlineContext.createBufferSource();
  const highpass = offlineContext.createBiquadFilter();

  highpass.type = "highpass";
  highpass.frequency.value = validatedCutoffHz;
  highpass.Q.value = Math.SQRT1_2;

  source.buffer = audioBuffer;
  source.connect(highpass);
  highpass.connect(offlineContext.destination);
  source.start(0);

  const rendered = await offlineContext.startRendering();
  source.disconnect();
  highpass.disconnect();
  throwIfAborted(signal);

  return rendered;
}

function trimSilenceAudioBuffer(
  audioBuffer: AudioBuffer,
  thresholdDb: number,
  minDurationMs: number,
  signal?: AbortSignal,
): AudioBuffer {
  const channels = Array.from({ length: audioBuffer.numberOfChannels }, (_, index) =>
    audioBuffer.getChannelData(index),
  );
  const { startFrame, endFrame } = calculateSilenceTrimFrames(
    channels,
    audioBuffer.sampleRate,
    thresholdDb,
    minDurationMs,
  );

  if (startFrame === 0 && endFrame === audioBuffer.length) {
    return audioBuffer;
  }

  throwIfAborted(signal);

  const startSeconds = startFrame / audioBuffer.sampleRate;
  const endSeconds = endFrame / audioBuffer.sampleRate;
  return trimAudioBuffer(audioBuffer, startSeconds, endSeconds);
}

function encodeWav(audioBuffer: AudioBuffer, targetBitDepth: 16 | 24 | 32): Blob {
  const bytesPerSample = targetBitDepth / 8;
  const formatCode = targetBitDepth === 32 ? 3 : 1;
  const channelCount = audioBuffer.numberOfChannels;
  const sampleCount = audioBuffer.length;
  const dataSize = sampleCount * channelCount * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  let offset = 0;
  const writeAscii = (value: string) => {
    for (let i = 0; i < value.length; i++) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
    offset += value.length;
  };

  writeAscii("RIFF");
  view.setUint32(offset, 36 + dataSize, true);
  offset += 4;
  writeAscii("WAVE");
  writeAscii("fmt ");
  view.setUint32(offset, 16, true);
  offset += 4;
  view.setUint16(offset, formatCode, true);
  offset += 2;
  view.setUint16(offset, channelCount, true);
  offset += 2;
  view.setUint32(offset, audioBuffer.sampleRate, true);
  offset += 4;
  view.setUint32(offset, audioBuffer.sampleRate * channelCount * bytesPerSample, true);
  offset += 4;
  view.setUint16(offset, channelCount * bytesPerSample, true);
  offset += 2;
  view.setUint16(offset, targetBitDepth, true);
  offset += 2;
  writeAscii("data");
  view.setUint32(offset, dataSize, true);
  offset += 4;

  const channels = Array.from({ length: channelCount }, (_, index) => audioBuffer.getChannelData(index));

  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex++) {
    for (let channel = 0; channel < channelCount; channel++) {
      const sample = clamp(channels[channel][sampleIndex], -1, 1);
      if (targetBitDepth === 16) {
        const int16 = sample < 0 ? Math.round(sample * 32768) : Math.round(sample * 32767);
        view.setInt16(offset, int16, true);
        offset += 2;
      } else if (targetBitDepth === 24) {
        const int24 = sample < 0 ? Math.round(sample * 8388608) : Math.round(sample * 8388607);
        const clampedInt24 = clamp(int24, -8388608, 8388607);
        const unsigned = clampedInt24 < 0 ? clampedInt24 + 16777216 : clampedInt24;
        view.setUint8(offset, unsigned & 0xff);
        view.setUint8(offset + 1, (unsigned >> 8) & 0xff);
        view.setUint8(offset + 2, (unsigned >> 16) & 0xff);
        offset += 3;
      } else {
        view.setFloat32(offset, sample, true);
        offset += 4;
      }
    }
  }

  return new Blob([buffer], { type: "audio/wav" });
}

interface Mp3Encoder {
  configure(options: { sampleRate: number; channels: 1 | 2; vbrQuality: number }): void;
  encode(samples: Float32Array[]): Uint8Array;
  finalize(): Uint8Array;
}

interface Mp3EncoderModule {
  createMp3Encoder: () => Promise<Mp3Encoder>;
}

let mp3EncoderModulePromise: Promise<Mp3EncoderModule> | null = null;

async function createMp3EncoderInstance(): Promise<Mp3Encoder> {
  if (!mp3EncoderModulePromise) {
    mp3EncoderModulePromise = import("wasm-media-encoders") as Promise<Mp3EncoderModule>;
  }

  const module = await mp3EncoderModulePromise;
  return module.createMp3Encoder();
}

function getMp3Channels(audioBuffer: AudioBuffer): [Float32Array] | [Float32Array, Float32Array] {
  if (audioBuffer.numberOfChannels === 1) {
    return [audioBuffer.getChannelData(0)];
  }
  if (audioBuffer.numberOfChannels === 2) {
    return [audioBuffer.getChannelData(0), audioBuffer.getChannelData(1)];
  }

  throw new Error("MP3 conversion currently supports mono or stereo audio only");
}

function copyEncoderChunk(chunk: Uint8Array): Uint8Array | null {
  if (chunk.length === 0) return null;
  return new Uint8Array(chunk);
}

async function encodeMp3(audioBuffer: AudioBuffer, signal?: AbortSignal): Promise<Blob> {
  throwIfAborted(signal);

  const encoder = await createMp3EncoderInstance();
  throwIfAborted(signal);

  const channels = getMp3Channels(audioBuffer);
  const channelCount = channels.length as 1 | 2;
  encoder.configure({
    sampleRate: audioBuffer.sampleRate,
    channels: channelCount,
    vbrQuality: MP3_ENCODING_QUALITY,
  });

  const encodedChunks: Uint8Array[] = [];
  let totalBytes = 0;

  for (let frameOffset = 0; frameOffset < audioBuffer.length; frameOffset += MP3_ENCODE_CHUNK_SIZE) {
    throwIfAborted(signal);
    const frameEnd = Math.min(frameOffset + MP3_ENCODE_CHUNK_SIZE, audioBuffer.length);
    const frameChannels = channels.map((channel) => channel.subarray(frameOffset, frameEnd));
    const encoded = copyEncoderChunk(encoder.encode(frameChannels));
    if (encoded) {
      encodedChunks.push(encoded);
      totalBytes += encoded.length;
    }
  }

  const finalChunk = copyEncoderChunk(encoder.finalize());
  if (finalChunk) {
    encodedChunks.push(finalChunk);
    totalBytes += finalChunk.length;
  }

  const output = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of encodedChunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }

  return new Blob([output], { type: "audio/mpeg" });
}

function buildWavOutput(
  file: AudioFile,
  processedBuffer: AudioBuffer,
  targetBitDepth: 16 | 24 | 32,
): ProcessedAudioOutput {
  const blob = encodeWav(processedBuffer, targetBitDepth);
  return {
    fileId: file.id,
    fileName: replaceExtension(file.name, "wav"),
    blob,
    mimeType: "audio/wav",
    format: "wav",
    bitDepth: targetBitDepth,
    duration: processedBuffer.duration,
    sampleRate: processedBuffer.sampleRate,
    channels: processedBuffer.numberOfChannels,
  };
}

async function buildMp3Output(
  file: AudioFile,
  processedBuffer: AudioBuffer,
  signal?: AbortSignal,
): Promise<ProcessedAudioOutput> {
  const blob = await encodeMp3(processedBuffer, signal);
  return {
    fileId: file.id,
    fileName: replaceExtension(file.name, "mp3"),
    blob,
    mimeType: "audio/mpeg",
    format: "mp3",
    bitDepth: null,
    duration: processedBuffer.duration,
    sampleRate: processedBuffer.sampleRate,
    channels: processedBuffer.numberOfChannels,
  };
}

async function buildOutput(
  file: AudioFile,
  processedBuffer: AudioBuffer,
  options: ProcessingOptions,
  signal?: AbortSignal,
): Promise<ProcessedAudioOutput> {
  const outputFormat = getOutputFormat(options);
  if (outputFormat === "mp3") {
    return buildMp3Output(file, processedBuffer, signal);
  }

  const outputBitDepth = getOutputBitDepth(options);
  return buildWavOutput(file, processedBuffer, outputBitDepth);
}

export function createInitialAggregate(totalFiles: number): AggregateProgress {
  return {
    totalFiles,
    queuedFiles: totalFiles,
    runningFiles: 0,
    successfulFiles: 0,
    failedFiles: 0,
    percent: 0,
  };
}

export function createDefaultProcessingOptions(): ProcessingOptions {
  return {
    resample: { enabled: false, targetRate: 16000 },
    convert: { enabled: false, format: "wav" },
    mono: { enabled: false },
    highpass: { enabled: false, cutoffHz: 80 },
    silence: { enabled: false, thresholdDb: -35, minDurationMs: 150 },
    normalize: { enabled: false, targetDb: -3 },
    bitDepth: { enabled: false, targetBitDepth: 16 },
    trim: { enabled: false, usePerFileTrim: true, globalStart: 0, globalEnd: 0 },
  };
}

export function getProcessingStepLabel(step: ProcessingStep): string {
  return PROCESSING_STEP_LABELS[step];
}

export async function* processAudioBatch(
  files: AudioFile[],
  options: ProcessingOptions,
  config: BatchProcessorConfig = {},
): AsyncGenerator<BatchProgressUpdate> {
  const { signal, stepDelayMs = DEFAULT_STEP_DELAY_MS } = config;
  const enabledSteps = getEnabledSteps(options);
  const stepsPerFile = Math.max(enabledSteps.length, 1);
  const totalUnits = files.length * stepsPerFile;

  let completedUnits = 0;

  const fileStates = new Map<string, FileProcessingState>(
    files.map((file) => [
      file.id,
      {
        fileId: file.id,
        fileName: file.name,
        status: "queued",
      },
    ]),
  );
  const outputs = new Map<string, ProcessedAudioOutput>();

  const percent = () => (totalUnits === 0 ? 100 : Math.round((completedUnits / totalUnits) * 100));
  const emit = (fileId: string): BatchProgressUpdate => {
    const state = getRequired(fileStates, fileId);
    const output = outputs.get(fileId);
    return {
      file: snapshot(state),
      aggregate: buildAggregate(fileStates, percent()),
      output,
    };
  };

  for (const file of files) {
    let completedForCurrentFile = 0;
    let workingBuffer: AudioBuffer | null = null;

    const ensureWorkingBuffer = async (): Promise<AudioBuffer> => {
      if (workingBuffer) return workingBuffer;
      workingBuffer = await decodeAudio(file, signal);
      return workingBuffer;
    };

    try {
      throwIfAborted(signal);

      const state = getRequired(fileStates, file.id);
      state.status = "running";
      state.message = undefined;
      state.step = enabledSteps[0];
      yield emit(file.id);

      if (enabledSteps.length === 0) {
        completedUnits += 1;
        state.status = "success";
        state.step = undefined;
        yield emit(file.id);
        continue;
      }

      for (const step of enabledSteps) {
        throwIfAborted(signal);

        state.step = step;
        yield emit(file.id);

        if (step === "trim") {
          const decoded = await ensureWorkingBuffer();
          const { start, end } = getTrimRangeSeconds(file, options.trim, decoded.duration);
          workingBuffer = trimAudioBuffer(decoded, start, end);
        } else if (step === "silence") {
          const decoded = await ensureWorkingBuffer();
          workingBuffer = trimSilenceAudioBuffer(
            decoded,
            options.silence.thresholdDb,
            options.silence.minDurationMs,
            signal,
          );
        } else if (step === "resample") {
          const decoded = await ensureWorkingBuffer();
          workingBuffer = await resampleAudioBuffer(decoded, options.resample.targetRate, signal);
        } else if (step === "mono") {
          const decoded = await ensureWorkingBuffer();
          workingBuffer = convertToMono(decoded, signal);
        } else if (step === "highpass") {
          const decoded = await ensureWorkingBuffer();
          workingBuffer = await highpassAudioBuffer(decoded, options.highpass.cutoffHz, signal);
        } else if (step === "normalize") {
          const decoded = await ensureWorkingBuffer();
          workingBuffer = normalizeAudioBuffer(decoded, options.normalize.targetDb, signal);
        } else if (step === "bitDepth") {
          const decoded = await ensureWorkingBuffer();
          workingBuffer = applyBitDepthToAudioBuffer(decoded, options.bitDepth.targetBitDepth, signal);
        } else if (step === "convert") {
          const decoded = await ensureWorkingBuffer();
          if (options.convert.format === "mp3") {
            getMp3Channels(decoded);
          }
        } else {
          await sleep(stepDelayMs, signal);
        }

        completedUnits += 1;
        completedForCurrentFile += 1;
        yield emit(file.id);
      }

      if (workingBuffer) {
        outputs.set(file.id, await buildOutput(file, workingBuffer, options, signal));
      }

      state.status = "success";
      state.step = undefined;
      state.message = outputs.has(file.id) ? `Prepared ${outputs.get(file.id)?.fileName}` : undefined;
      yield emit(file.id);
    } catch (error) {
      const state = fileStates.get(file.id);
      if (state) {
        const remainingUnits = Math.max(stepsPerFile - completedForCurrentFile, 0);
        completedUnits += remainingUnits;
        state.status = "failed";
        state.step = undefined;
        state.message = isAbortError(error)
          ? "Processing aborted"
          : error instanceof Error
            ? error.message
            : "Processing failed";
        yield emit(file.id);
      }

      if (isAbortError(error) || signal?.aborted) break;
    }
  }
}
