import type { AudioFile } from "@/features/audio/types";

export interface ProcessingOptions {
  resample?: { enabled: boolean; targetRate: number };
  convert?: { enabled: boolean; format: "wav" | "mp3" | "flac" | "ogg" };
  mono?: { enabled: boolean };
  normalize?: { enabled: boolean; targetDb: number };
  trim?: { enabled: boolean; usePerFileTrim: boolean; globalStart: number; globalEnd: number };
}

export type ProcessingStep = "resample" | "convert" | "mono" | "normalize" | "trim";
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

const PROCESSING_STEPS: readonly ProcessingStep[] = ["resample", "convert", "mono", "normalize", "trim"];
const DEFAULT_STEP_DELAY_MS = 120;

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
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
    } catch (e) {
      reject(e);
    }
  });
}

function getEnabledSteps(options: ProcessingOptions): ProcessingStep[] {
  const enabled = (step: ProcessingStep): boolean => {
    switch (step) {
      case "resample":
        return !!options.resample?.enabled;
      case "convert":
        return !!options.convert?.enabled;
      case "mono":
        return !!options.mono?.enabled;
      case "normalize":
        return !!options.normalize?.enabled;
      case "trim":
        return !!options.trim?.enabled;
      default: {
        // Exhaustive check
        const _never: never = step;
        return _never;
      }
    }
  };

  return PROCESSING_STEPS.filter(enabled);
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
  // Ensure consumers don’t see mutations after yield
  return { ...state };
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
      state.step = enabledSteps[0]; // may be undefined if no steps enabled
      yield emit(file.id);

      // No enabled steps: treat as a single “unit” completed.
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
    } catch (err) {
      const state = fileStates.get(file.id);
      if (state) {
        state.status = "failed";
        state.step = undefined;
        state.message = isAbortError(err)
          ? "Processing aborted"
          : err instanceof Error
            ? err.message
            : "Processing failed";
        yield emit(file.id);
      }

      if (isAbortError(err) || signal?.aborted) break;
    }
  }
}
