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

  const percent = () => (totalUnits === 0 ? 100 : Math.round((completedUnits / totalUnits) * 100));
  const emit = (fileId: string): BatchProgressUpdate => {
    const state = getRequired(fileStates, fileId);
    return {
      file: snapshot(state),
      aggregate: buildAggregate(fileStates, percent()),
    };
  };

  for (const file of files) {
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

        await sleep(stepDelayMs, signal);

        completedUnits += 1;
        yield emit(file.id);
      }

      state.status = "success";
      state.step = undefined;
      yield emit(file.id);
    } catch (error) {
      const state = fileStates.get(file.id);
      if (state) {
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
