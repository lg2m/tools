import { expect, test } from "@rstest/core";
import {
  computePeakNormalizationGain,
  downmixChannelsToMono,
  getPeakAmplitude,
  getTrimRangeSeconds,
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
