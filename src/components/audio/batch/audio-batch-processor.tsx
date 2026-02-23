import { CheckCircle2, Play } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { type AnnotationExportFormat, AnnotationExportTab } from "@/components/audio/batch/annotation-export-tab";
import { AudioProcessingTab } from "@/components/audio/batch/audio-processing-tab";
import { BatchProcessorDialog } from "@/components/batch/batch-processor-dialog";
import { Button } from "@/components/ui/button";
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
  onOutput: (output: ProcessedAudioOutput) => void;
  onComplete: () => void;
}

async function runBatchProcess(
  files: AudioFile[],
  options: ProcessingOptions,
  signal: AbortSignal,
  callbacks: ProcessCallbacks,
): Promise<void> {
  const { onProgress, onFileUpdate, onActiveFile, onOutput, onComplete } = callbacks;
  const deliveredOutputs = new Set<string>();

  try {
    for await (const update of processAudioBatch(files, options, { signal })) {
      onProgress(update.aggregate);
      onFileUpdate(update.file);
      onActiveFile(update.file.status === "running" ? update.file : null);

      if (update.output && !deliveredOutputs.has(update.output.fileId)) {
        deliveredOutputs.add(update.output.fileId);
        onOutput(update.output);
      }
    }
  } finally {
    onComplete();
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
  link.click();

  URL.revokeObjectURL(url);
}

export function AudioBatchProcessor({ open, files, annotations, onOpenChange }: AudioBatchProcessorProps) {
  const [activeTab, setActiveTab] = useState<BatchTab>("process");
  const [options, setOptions] = useState<ProcessingOptions>(() => createDefaultProcessingOptions());
  const [processing, setProcessing] = useState(false);
  const [aggregateProgress, setAggregateProgress] = useState<AggregateProgress>(() =>
    createInitialAggregate(files.length),
  );
  const [fileStatuses, setFileStatuses] = useState<Record<string, FileProcessingState>>({});
  const [activeFile, setActiveFile] = useState<FileProcessingState | null>(null);
  const [exportFormat, setExportFormat] = useState<AnnotationExportFormat>("json");
  const abortControllerRef = useRef<AbortController | null>(null);

  const selectedOperationCount = useMemo(
    () => Object.values(options).filter((option) => option.enabled).length,
    [options],
  );

  const failedFileNames = useMemo(
    () =>
      Object.values(fileStatuses)
        .filter((status) => status.status === "failed")
        .map((status) => status.fileName),
    [fileStatuses],
  );

  const annotatedFileCount = useMemo(
    () => new Set(annotations.map((annotation) => annotation.fileId)).size,
    [annotations],
  );

  const closeProcessor = (nextOpen: boolean) => {
    if (!nextOpen) {
      abortControllerRef.current?.abort();
    }
    onOpenChange(nextOpen);
  };

  const cleanupProcessing = () => {
    setProcessing(false);
    abortControllerRef.current = null;
    setActiveFile(null);
  };

  const handleProcess = () => {
    if (processing) return;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setProcessing(true);
    setAggregateProgress(createInitialAggregate(files.length));
    setFileStatuses(
      Object.fromEntries(
        files.map((file) => [file.id, { fileId: file.id, fileName: file.name, status: "queued" as const }]),
      ),
    );
    setActiveFile(null);

    void runBatchProcess(files, options, controller.signal, {
      onProgress: setAggregateProgress,
      onFileUpdate: (file) => setFileStatuses((current) => ({ ...current, [file.fileId]: file })),
      onActiveFile: setActiveFile,
      onOutput: (output) => downloadBlob(output.blob, output.fileName),
      onComplete: cleanupProcessing,
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
      downloadContent(JSON.stringify(data, null, 2), "annotations.json", "application/json");
      return;
    }

    if (exportFormat === "csv") {
      const content = `file,start,end,label\n${data.map((item) => `${item.file},${item.start},${item.end},${item.label}`).join("\n")}`;
      downloadContent(content, "annotations.csv", "text/csv");
      return;
    }

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
