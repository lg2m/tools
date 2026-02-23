import JSZip from "jszip";
import { CheckCircle2, Play } from "lucide-react";
import { useMemo, useReducer, useRef, useState } from "react";
import { type AnnotationExportFormat, AnnotationExportTab } from "@/components/audio/batch/annotation-export-tab";
import { AudioProcessingTab } from "@/components/audio/batch/audio-processing-tab";
import { BatchProcessorDialog } from "@/components/batch/batch-processor-dialog";
import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/analytics";
import {
  type AggregateProgress,
  createDefaultProcessingOptions,
  createInitialAggregate,
  type FileProcessingState,
  type ProcessedAudioOutput,
  type ProcessingOptions,
  processAudioBatch,
} from "@/lib/audio/batch-processor";
import type { Annotation, AudioFile } from "@/types/audio";

type BatchTab = "process" | "export";

interface AudioBatchProcessorProps {
  open: boolean;
  files: AudioFile[];
  annotations: Annotation[];
  onOpenChange: (open: boolean) => void;
}

interface ProcessCallbacks {
  onProgress: (aggregate: AggregateProgress) => void;
  onFileUpdate: (file: FileProcessingState) => void;
  onActiveFile: (file: FileProcessingState | null) => void;
  onComplete: (outputs: ProcessedAudioOutput[]) => void | Promise<void>;
}

interface ProcessingUiState {
  processing: boolean;
  aggregateProgress: AggregateProgress;
  fileStatuses: Record<string, FileProcessingState>;
  activeFile: FileProcessingState | null;
}

type ProcessingUiAction =
  | {
      type: "start";
      totalFiles: number;
      fileStatuses: Record<string, FileProcessingState>;
    }
  | { type: "set-progress"; aggregate: AggregateProgress }
  | { type: "set-file"; file: FileProcessingState }
  | { type: "set-active-file"; file: FileProcessingState | null }
  | { type: "cleanup" };

function createQueuedFileStatuses(files: AudioFile[]): Record<string, FileProcessingState> {
  return Object.fromEntries(
    files.map((file) => [file.id, { fileId: file.id, fileName: file.name, status: "queued" as const }]),
  );
}

function createProcessingUiState(totalFiles: number): ProcessingUiState {
  return {
    processing: false,
    aggregateProgress: createInitialAggregate(totalFiles),
    fileStatuses: {},
    activeFile: null,
  };
}

function processingUiReducer(state: ProcessingUiState, action: ProcessingUiAction): ProcessingUiState {
  switch (action.type) {
    case "start":
      return {
        processing: true,
        aggregateProgress: createInitialAggregate(action.totalFiles),
        fileStatuses: action.fileStatuses,
        activeFile: null,
      };
    case "set-progress":
      return { ...state, aggregateProgress: action.aggregate };
    case "set-file":
      return {
        ...state,
        fileStatuses: { ...state.fileStatuses, [action.file.fileId]: action.file },
      };
    case "set-active-file":
      return { ...state, activeFile: action.file };
    case "cleanup":
      return { ...state, processing: false, activeFile: null };
  }
}

async function runBatchProcess(
  files: AudioFile[],
  options: ProcessingOptions,
  signal: AbortSignal,
  callbacks: ProcessCallbacks,
): Promise<void> {
  const { onProgress, onFileUpdate, onActiveFile, onComplete } = callbacks;
  const deliveredOutputs = new Map<string, ProcessedAudioOutput>();

  try {
    for await (const update of processAudioBatch(files, options, { signal })) {
      onProgress(update.aggregate);
      onFileUpdate(update.file);
      onActiveFile(update.file.status === "running" ? update.file : null);

      if (update.output) {
        deliveredOutputs.set(update.output.fileId, update.output);
      }
    }
  } finally {
    await onComplete([...deliveredOutputs.values()]);
  }
}

function downloadContent(content: string, filename: string, mimeType = "text/plain"): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.append(link);
  link.click();
  link.remove();

  globalThis.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

async function downloadProcessedArchive(outputs: ProcessedAudioOutput[]): Promise<void> {
  const zip = new JSZip();

  for (const output of outputs) {
    zip.file(output.fileName, output.blob);
  }

  const archive = await zip.generateAsync({ type: "blob" });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  downloadBlob(archive, `processed-audio-${timestamp}.zip`);
}

export function AudioBatchProcessor({ open, files, annotations, onOpenChange }: AudioBatchProcessorProps) {
  const [activeTab, setActiveTab] = useState<BatchTab>("process");
  const [options, setOptions] = useState<ProcessingOptions>(() => createDefaultProcessingOptions());
  const [exportFormat, setExportFormat] = useState<AnnotationExportFormat>("json");
  const [processingState, dispatchProcessing] = useReducer(processingUiReducer, files.length, createProcessingUiState);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { processing, aggregateProgress, fileStatuses, activeFile } = processingState;

  const selectedOperationCount = Object.values(options).filter((option) => option.enabled).length;

  const failedFileNames = useMemo(
    () =>
      Object.values(fileStatuses)
        .filter((status) => status.status === "failed")
        .map((status) => status.fileName),
    [fileStatuses],
  );

  const annotatedFileCount = new Set(annotations.map((annotation) => annotation.fileId)).size;

  const closeProcessor = (nextOpen: boolean) => {
    if (!nextOpen) {
      abortControllerRef.current?.abort();
    }
    onOpenChange(nextOpen);
  };

  const cleanupProcessing = () => {
    dispatchProcessing({ type: "cleanup" });
    abortControllerRef.current = null;
  };

  const handleProcess = () => {
    if (processing) return;

    trackEvent("batch_process_started", {
      file_count: files.length,
      selected_operations: selectedOperationCount,
    });

    const controller = new AbortController();
    abortControllerRef.current = controller;

    dispatchProcessing({
      type: "start",
      totalFiles: files.length,
      fileStatuses: createQueuedFileStatuses(files),
    });

    void runBatchProcess(files, options, controller.signal, {
      onProgress: (aggregate) => dispatchProcessing({ type: "set-progress", aggregate }),
      onFileUpdate: (file) => dispatchProcessing({ type: "set-file", file }),
      onActiveFile: (file) => dispatchProcessing({ type: "set-active-file", file }),
      onComplete: async (outputs) => {
        try {
          trackEvent("batch_process_completed", {
            output_count: outputs.length,
          });

          if (outputs.length === 1) {
            const [output] = outputs;
            downloadBlob(output.blob, output.fileName);
          } else if (outputs.length > 1) {
            await downloadProcessedArchive(outputs);
          }

          cleanupProcessing();
        } catch (error) {
          cleanupProcessing();
          throw error;
        }
      },
    });
  };

  const handleExportAnnotations = () => {
    const data = annotations.map((annotation) => ({
      file: files.find((file) => file.id === annotation.fileId)?.name ?? "",
      start: annotation.startTime,
      end: annotation.endTime,
      label: annotation.labelId,
    }));

    if (exportFormat === "json") {
      trackEvent("annotations_exported", {
        format: exportFormat,
        annotation_count: annotations.length,
      });
      downloadContent(JSON.stringify(data, null, 2), "annotations.json", "application/json");
      return;
    }

    if (exportFormat === "csv") {
      trackEvent("annotations_exported", {
        format: exportFormat,
        annotation_count: annotations.length,
      });
      const content = `file,start,end,label\n${data.map((item) => `${item.file},${item.start},${item.end},${item.label}`).join("\n")}`;
      downloadContent(content, "annotations.csv", "text/csv");
      return;
    }

    trackEvent("annotations_exported", {
      format: exportFormat,
      annotation_count: annotations.length,
    });
    const textGrid = data.map((item) => `"${item.file}" ${item.start} ${item.end} "${item.label}"`).join("\n");
    downloadContent(textGrid, "annotations.TextGrid");
  };

  return (
    <BatchProcessorDialog
      open={open}
      onOpenChange={closeProcessor}
      title="Dataset Prep & Export"
      itemCount={files.length}
      tabs={[
        {
          id: "process",
          label: "Dataset Preparation",
          content: (
            <AudioProcessingTab
              filesCount={files.length}
              options={options}
              processing={processing}
              aggregateProgress={aggregateProgress}
              failedFileNames={failedFileNames}
              activeFile={activeFile}
              onOptionsChange={(updater) => setOptions((current) => updater(current))}
            />
          ),
          footer: (
            <div className="flex items-center justify-between gap-2">
              <p className="text-muted-foreground text-xs">{selectedOperationCount} transform(s) selected</p>
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => closeProcessor(false)}>
                  {processing ? "Stop" : "Cancel"}
                </Button>
                <Button onClick={handleProcess} disabled={processing || selectedOperationCount === 0}>
                  <Play className="size-4" />
                  Prepare dataset
                </Button>
              </div>
            </div>
          ),
        },
        {
          id: "export",
          label: "Export Annotations",
          content: (
            <AnnotationExportTab
              files={files}
              annotations={annotations}
              exportFormat={exportFormat}
              onExportFormatChange={setExportFormat}
            />
          ),
          footer: (
            <div className="flex items-center justify-between gap-2">
              <p className="text-muted-foreground text-xs">
                {annotations.length} annotation(s) across {annotatedFileCount} file(s)
              </p>
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => closeProcessor(false)}>
                  Cancel
                </Button>
                <Button onClick={handleExportAnnotations} disabled={files.length === 0 || annotations.length === 0}>
                  <CheckCircle2 className="size-4" />
                  Export annotations
                </Button>
              </div>
            </div>
          ),
        },
      ]}
      activeTab={activeTab}
      onActiveTabChange={setActiveTab}
    />
  );
}
