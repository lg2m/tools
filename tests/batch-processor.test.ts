import { expect, test } from "@rstest/core";
import {
  calculateSilenceTrimFrames,
  calculateResampledFrameLength,
  computePeakNormalizationGain,
  dbToAmplitude,
  downmixChannelsToMono,
  getOutputBitDepth,
  getOutputFormat,
  getPeakAmplitude,
  getTrimRangeSeconds,
  quantizeSampleToBitDepth,
  validateHighpassCutoffHz,
  validateTargetSampleRate,
} from "../src/lib/audio/batch-processor";
import type { AudioFile } from "../src/types/audio";

function createAudioFile(overrides: Partial<AudioFile> = {}): AudioFile {
  return {
    id: "file-1",
    name: "sample.wav",
    url: "blob://sample",
    duration: 12,
    format: "audio/wav",
    sampleRate: 44100,
    channels: 2,
    bitDepth: 16,
    ...overrides,
  };
}

test("getTrimRangeSeconds uses per-file trim points", () => {
  const file = createAudioFile({ trimStart: 1.2, trimEnd: 5.8 });

  const range = getTrimRangeSeconds(file, { enabled: true, usePerFileTrim: true, globalStart: 0, globalEnd: 0 }, 10);

  expect(range).toEqual({ start: 1.2, end: 5.8 });
});

test("getTrimRangeSeconds uses clamped global trim points", () => {
  const file = createAudioFile();

  const range = getTrimRangeSeconds(file, { enabled: true, usePerFileTrim: false, globalStart: -2, globalEnd: 20 }, 8);

  expect(range).toEqual({ start: 0, end: 8 });
});

test("getTrimRangeSeconds throws for invalid range", () => {
  const file = createAudioFile({ name: "bad.wav" });

  expect(() =>
    getTrimRangeSeconds(file, { enabled: true, usePerFileTrim: false, globalStart: 4, globalEnd: 4 }, 10),
  ).toThrow("Invalid trim range for bad.wav");
});

test("downmixChannelsToMono averages all channels", () => {
  const left = new Float32Array([0.2, -0.6, 1.0, 0.0]);
  const right = new Float32Array([0.6, 0.2, -1.0, 0.4]);

  const mono = downmixChannelsToMono([left, right]);

  expect(mono[0]).toBeCloseTo(0.4, 6);
  expect(mono[1]).toBeCloseTo(-0.2, 6);
  expect(mono[2]).toBeCloseTo(0, 6);
  expect(mono[3]).toBeCloseTo(0.2, 6);
});

test("downmixChannelsToMono throws for mismatched channel lengths", () => {
  const ch1 = new Float32Array([0.1, 0.2]);
  const ch2 = new Float32Array([0.1]);

  expect(() => downmixChannelsToMono([ch1, ch2])).toThrow("Cannot downmix channels with different lengths");
});

test("getPeakAmplitude returns max absolute sample", () => {
  const left = new Float32Array([-0.2, 0.4, -0.1]);
  const right = new Float32Array([0.1, -0.75, 0.2]);

  const peak = getPeakAmplitude([left, right]);

  expect(peak).toBeCloseTo(0.75, 6);
});

test("computePeakNormalizationGain returns unity gain for silence", () => {
  const gain = computePeakNormalizationGain(-3, 0);

  expect(gain).toBe(1);
});

test("computePeakNormalizationGain converts target dB to linear peak gain", () => {
  const gain = computePeakNormalizationGain(-6, 0.25);
  const expectedTargetAmplitude = 10 ** (-6 / 20);

  expect(gain).toBeCloseTo(expectedTargetAmplitude / 0.25, 6);
});

test("computePeakNormalizationGain throws for invalid values", () => {
  expect(() => computePeakNormalizationGain(Number.NaN, 0.5)).toThrow(
    "Normalization target must be a finite dB value",
  );
  expect(() => computePeakNormalizationGain(-3, Number.NaN)).toThrow(
    "Peak amplitude must be a finite positive number",
  );
  expect(() => computePeakNormalizationGain(-3, -1)).toThrow("Peak amplitude must be a finite positive number");
});

test("validateTargetSampleRate rounds finite positive values", () => {
  expect(validateTargetSampleRate(15999.8)).toBe(16000);
  expect(validateTargetSampleRate(44100)).toBe(44100);
});

test("validateTargetSampleRate throws for invalid values", () => {
  expect(() => validateTargetSampleRate(0)).toThrow("Target sample rate must be a finite positive number");
  expect(() => validateTargetSampleRate(Number.NaN)).toThrow("Target sample rate must be a finite positive number");
});

test("calculateResampledFrameLength keeps clip duration", () => {
  const sourceLength = 44100;
  const sourceRate = 44100;
  const targetRate = 16000;

  expect(calculateResampledFrameLength(sourceLength, sourceRate, targetRate)).toBe(16000);
});

test("calculateResampledFrameLength throws for invalid source metadata", () => {
  expect(() => calculateResampledFrameLength(0, 44100, 16000)).toThrow(
    "Source length must be a finite positive number",
  );
  expect(() => calculateResampledFrameLength(44100, 0, 16000)).toThrow(
    "Source sample rate must be a finite positive number",
  );
});

test("validateHighpassCutoffHz clamps to valid DSP range", () => {
  expect(validateHighpassCutoffHz(80, 44100)).toBeCloseTo(80, 6);
  expect(validateHighpassCutoffHz(50000, 16000)).toBeCloseTo(7999.999, 6);
  expect(validateHighpassCutoffHz(0.2, 48000)).toBeCloseTo(1, 6);
});

test("validateHighpassCutoffHz throws for invalid values", () => {
  expect(() => validateHighpassCutoffHz(0, 44100)).toThrow("High-pass cutoff must be a finite positive number");
  expect(() => validateHighpassCutoffHz(Number.NaN, 44100)).toThrow(
    "High-pass cutoff must be a finite positive number",
  );
  expect(() => validateHighpassCutoffHz(80, 0)).toThrow("Sample rate must be a finite positive number");
});

test("dbToAmplitude converts dBFS values to linear amplitudes", () => {
  expect(dbToAmplitude(0)).toBeCloseTo(1, 6);
  expect(dbToAmplitude(-20)).toBeCloseTo(0.1, 6);
});

test("quantizeSampleToBitDepth quantizes 16-bit samples", () => {
  const sample = 0.123456;

  const quantized = quantizeSampleToBitDepth(sample, 16);

  expect(quantized).toBeCloseTo(Math.round(sample * 32767) / 32767, 6);
});

test("quantizeSampleToBitDepth keeps 32-bit samples unchanged", () => {
  const sample = 0.123456789;

  expect(quantizeSampleToBitDepth(sample, 32)).toBeCloseTo(sample, 9);
});

test("quantizeSampleToBitDepth clamps out-of-range values", () => {
  expect(quantizeSampleToBitDepth(3, 24)).toBe(1);
  expect(quantizeSampleToBitDepth(-3, 24)).toBe(-1);
});

test("quantizeSampleToBitDepth throws for invalid input samples", () => {
  expect(() => quantizeSampleToBitDepth(Number.NaN, 16)).toThrow("Audio sample must be finite");
});

test("getOutputFormat returns convert format when enabled", () => {
  const options = {
    resample: { enabled: false, targetRate: 16000 },
    convert: { enabled: true, format: "mp3" as const },
    mono: { enabled: false },
    highpass: { enabled: false, cutoffHz: 80 },
    silence: { enabled: false, thresholdDb: -35, minDurationMs: 150 },
    normalize: { enabled: false, targetDb: -3 },
    bitDepth: { enabled: false, targetBitDepth: 16 as const },
    trim: { enabled: false, usePerFileTrim: true, globalStart: 0, globalEnd: 0 },
  };

  expect(getOutputFormat(options)).toBe("mp3");
});

test("getOutputFormat defaults to wav when convert is disabled", () => {
  const options = {
    resample: { enabled: false, targetRate: 16000 },
    convert: { enabled: false, format: "mp3" as const },
    mono: { enabled: false },
    highpass: { enabled: false, cutoffHz: 80 },
    silence: { enabled: false, thresholdDb: -35, minDurationMs: 150 },
    normalize: { enabled: false, targetDb: -3 },
    bitDepth: { enabled: false, targetBitDepth: 24 as const },
    trim: { enabled: false, usePerFileTrim: true, globalStart: 0, globalEnd: 0 },
  };

  expect(getOutputFormat(options)).toBe("wav");
});

test("getOutputBitDepth returns configured bit depth when enabled", () => {
  const options = {
    resample: { enabled: false, targetRate: 16000 },
    convert: { enabled: false, format: "wav" as const },
    mono: { enabled: false },
    highpass: { enabled: false, cutoffHz: 80 },
    silence: { enabled: false, thresholdDb: -35, minDurationMs: 150 },
    normalize: { enabled: false, targetDb: -3 },
    bitDepth: { enabled: true, targetBitDepth: 24 as const },
    trim: { enabled: false, usePerFileTrim: true, globalStart: 0, globalEnd: 0 },
  };

  expect(getOutputBitDepth(options)).toBe(24);
});

test("getOutputBitDepth falls back to default when disabled", () => {
  const options = {
    resample: { enabled: false, targetRate: 16000 },
    convert: { enabled: false, format: "wav" as const },
    mono: { enabled: false },
    highpass: { enabled: false, cutoffHz: 80 },
    silence: { enabled: false, thresholdDb: -35, minDurationMs: 150 },
    normalize: { enabled: false, targetDb: -3 },
    bitDepth: { enabled: false, targetBitDepth: 24 as const },
    trim: { enabled: false, usePerFileTrim: true, globalStart: 0, globalEnd: 0 },
  };

  expect(getOutputBitDepth(options)).toBe(16);
});

test("calculateSilenceTrimFrames trims long leading and trailing silence", () => {
  const sampleRate = 1000;
  const channel = new Float32Array([
    0,
    0,
    0,
    0,
    0,
    0.2,
    0.2,
    0.2,
    0.2,
    0.2,
    0,
    0,
    0,
    0,
    0,
    0,
  ]);

  const frames = calculateSilenceTrimFrames([channel], sampleRate, -30, 5);

  expect(frames).toEqual({ startFrame: 5, endFrame: 10 });
});

test("calculateSilenceTrimFrames preserves short edge silence", () => {
  const sampleRate = 1000;
  const channel = new Float32Array([0, 0, 0.2, 0.2, 0]);

  const frames = calculateSilenceTrimFrames([channel], sampleRate, -30, 3.5);

  expect(frames).toEqual({ startFrame: 0, endFrame: 5 });
});

test("calculateSilenceTrimFrames handles all-silent audio by keeping range", () => {
  const sampleRate = 1000;
  const channel = new Float32Array([0, 0, 0, 0]);

  const frames = calculateSilenceTrimFrames([channel], sampleRate, -30, 1);

  expect(frames).toEqual({ startFrame: 0, endFrame: 4 });
});

test("calculateSilenceTrimFrames throws on invalid input", () => {
  expect(() => calculateSilenceTrimFrames([], 44100, -35, 150)).toThrow("Cannot detect silence without channels");
  expect(() => calculateSilenceTrimFrames([new Float32Array([0.1])], 0, -35, 150)).toThrow(
    "Sample rate must be a finite positive number",
  );
  expect(() => calculateSilenceTrimFrames([new Float32Array([0.1])], 44100, -35, -1)).toThrow(
    "Minimum silence duration must be a finite non-negative number",
  );
  expect(() => calculateSilenceTrimFrames([new Float32Array([0.1]), new Float32Array([])], 44100, -35, 150)).toThrow(
    "Cannot detect silence with mismatched channel lengths",
  );
});
