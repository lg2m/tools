import { useState, useRef } from "react";

import { CheckCircle2, Loader2, Play, X } from "lucide-react";

import type { Annotation, AudioFile } from "@/features/audio/types";
import type { AggregateProgress, FileProcessingState, ProcessingOptions } from "@/features/audio/batch/processor";
import { processAudioBatch } from "@/features/audio/batch/processor";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { SelectValue } from "@radix-ui/react-select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";
import { Card, CardAction, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

interface BatchProcessorProps {
  files: AudioFile[];
  annotations: Annotation[];
  onClose: () => void;
}

export function BatchProcessor({ files, annotations, onClose }: BatchProcessorProps) {
  const [activeTab, setActiveTab] = useState<"process" | "export">("process");
  const [options, setOptions] = useState<ProcessingOptions>({
    resample: { enabled: false, targetRate: 16000 },
    convert: { enabled: false, format: "wav" },
    mono: { enabled: false },
    normalize: { enabled: false, targetDb: -3 },
    trim: { enabled: false, usePerFileTrim: true, globalStart: 0, globalEnd: 0 },
  });
  const [processing, setProcessing] = useState(false);
  const [aggregateProgress, setAggregateProgress] = useState<AggregateProgress>({
    totalFiles: files.length,
    queuedFiles: files.length,
    runningFiles: 0,
    successfulFiles: 0,
    failedFiles: 0,
    percent: 0,
  });
  const [fileStatuses, setFileStatuses] = useState<Record<string, FileProcessingState>>({});
  const [activeFile, setActiveFile] = useState<FileProcessingState | null>(null);
  const [exportFormat, setExportFormat] = useState<"json" | "csv" | "textgrid">("json");
  const abortControllerRef = useRef<AbortController | null>(null);

  const failedFiles = Object.values(fileStatuses).filter((status) => status.status === "failed");

  const handleProcess = async () => {
    if (processing) return;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setProcessing(true);
    setAggregateProgress({
      totalFiles: files.length,
      queuedFiles: files.length,
      runningFiles: 0,
      successfulFiles: 0,
      failedFiles: 0,
      percent: 0,
    });
    setFileStatuses(
      Object.fromEntries(
        files.map((file) => [file.id, { fileId: file.id, fileName: file.name, status: "queued" as const }]),
      ),
    );
    setActiveFile(null);

    try {
      for await (const update of processAudioBatch(files, options, { signal: controller.signal })) {
        setAggregateProgress(update.aggregate);
        setFileStatuses((prev) => ({ ...prev, [update.file.fileId]: update.file }));
        if (update.file.status === "running") {
          setActiveFile(update.file);
        }
      }
    } finally {
      setProcessing(false);
      abortControllerRef.current = null;
      setActiveFile(null);
    }
  };

  const handleCancelProcessing = () => {
    if (processing) {
      abortControllerRef.current?.abort();
    }
    onClose();
  };

  const handleExportAnnotations = () => {
    const data = annotations.map((ann) => ({
      file: files.find((f) => f.id === ann.fileId)?.name,
      start: ann.startTime,
      end: ann.endTime,
      label: ann.labelId,
    }));

    let content = "";
    let filename = "";

    if (exportFormat === "json") {
      content = JSON.stringify(data, null, 2);
      filename = "annotations.json";
    } else if (exportFormat === "csv") {
      content = "file,start,end,label\n" + data.map((d) => `${d.file},${d.start},${d.end},${d.label}`).join("\n");
      filename = "annotations.csv";
    } else {
      // TextGrid format (Praat)
      content = data.map((d) => `"${d.file}" ${d.start} ${d.end} "${d.label}"`).join("\n");
      filename = "annotations.TextGrid";
    }

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <Card className="w-full max-w-lg md:max-w-xl">
        {/* Header */}
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            Batch Operations
            <span className="font-mono text-xs text-muted-foreground">{files.length} files</span>
          </CardTitle>
          <CardAction>
            <Button variant="ghost" size="icon-sm" onClick={handleCancelProcessing}>
              <X className="h-4 w-4" />
            </Button>
          </CardAction>
          {/* Tabs */}
          <div className="flex border-b border-border pt-3">
            <button
              onClick={() => setActiveTab("process")}
              className={`border-b-2 px-4 py-2.5 text-xs font-medium transition-all ${
                activeTab === "process"
                  ? "border-[#7c3aed] text-white"
                  : "border-transparent text-white/50 hover:text-white/80"
              }`}
            >
              Audio Processing
            </button>
            <button
              onClick={() => setActiveTab("export")}
              className={`border-b-2 px-4 py-2.5 text-xs font-medium transition-all ${
                activeTab === "export"
                  ? "border-[#7c3aed] text-white"
                  : "border-transparent text-white/50 hover:text-white/80"
              }`}
            >
              Export Annotations
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <div>
            {activeTab === "process" ? (
              <FieldGroup>
                {/* Resample */}
                <FieldGroup>
                  <Field orientation="horizontal">
                    <Checkbox
                      id="resample-checkbox"
                      checked={options.resample?.enabled}
                      onCheckedChange={(checked) =>
                        setOptions({
                          ...options,
                          resample: { ...options.resample!, enabled: Boolean(checked) },
                        })
                      }
                    />
                    <FieldLabel htmlFor="resample-checkbox">Resample</FieldLabel>
                  </Field>
                  {options.resample?.enabled && (
                    <Field>
                      <FieldLabel className="text-xs text-muted-foreground">Target Sample Rate (Hz)</FieldLabel>
                      <Select
                        defaultValue={options.resample?.targetRate.toString()}
                        onValueChange={(val) =>
                          setOptions({
                            ...options,
                            resample: { ...options.resample!, targetRate: Number(val) },
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a Sample Rate (Hz)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="8000">8000 Hz</SelectItem>
                          <SelectItem value="16000">16000 Hz (ML Standard)</SelectItem>
                          <SelectItem value="22050">22050 Hz</SelectItem>
                          <SelectItem value="44100">44100 Hz</SelectItem>
                          <SelectItem value="48000">48000 Hz</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                </FieldGroup>

                {/* Convert to Mono */}
                <Field orientation="horizontal">
                  <Checkbox
                    id="mono-checkbox"
                    checked={options.mono?.enabled}
                    onCheckedChange={(checked) =>
                      setOptions({
                        ...options,
                        mono: { enabled: Boolean(checked) },
                      })
                    }
                  />
                  <FieldLabel htmlFor="mono-checkbox">Convert to Mono</FieldLabel>
                </Field>

                {/* Format Conversion */}
                <FieldGroup>
                  <Field orientation="horizontal">
                    <Checkbox
                      id="convert-checkbox"
                      checked={options.convert?.enabled}
                      onCheckedChange={(checked) =>
                        setOptions({
                          ...options,
                          convert: { ...options.convert!, enabled: Boolean(checked) },
                        })
                      }
                    />
                    <FieldLabel htmlFor="convert-checkbox">Convert Format</FieldLabel>
                  </Field>
                  {options.convert?.enabled && (
                    <Field>
                      <FieldLabel className="text-xs text-muted-foreground">Target Format</FieldLabel>
                      <Select
                        value={options.convert?.format}
                        onValueChange={(val: "wav" | "mp3" | "flac" | "ogg") =>
                          setOptions({
                            ...options,
                            convert: { ...options.convert!, format: val },
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a file format" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="wav">WAV</SelectItem>
                          <SelectItem value="mp3">MP3</SelectItem>
                          <SelectItem value="flac">FLAC</SelectItem>
                          <SelectItem value="ogg">OGG</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                </FieldGroup>

                {/* Normalize */}
                <FieldGroup>
                  <Field orientation="horizontal">
                    <Checkbox
                      id="normalize-checkbox"
                      checked={options.normalize?.enabled}
                      onCheckedChange={(checked) =>
                        setOptions({
                          ...options,
                          normalize: { ...options.normalize!, enabled: Boolean(checked) },
                        })
                      }
                    />
                    <FieldLabel htmlFor="normalize-checkbox">Normalize Audio</FieldLabel>
                  </Field>
                  {options.normalize?.enabled && (
                    <Field>
                      <FieldLabel htmlFor="normalize-audio" className="text-xs text-muted-foreground">
                        Target Level (dB)
                      </FieldLabel>
                      <Input
                        id="normalize-audio"
                        type="number"
                        value={options.normalize?.targetDb}
                        onChange={(e) =>
                          setOptions({
                            ...options,
                            normalize: { ...options.normalize!, targetDb: Number(e.target.value) },
                          })
                        }
                        min={-60}
                        max={0}
                        step={0.1}
                      />
                    </Field>
                  )}
                </FieldGroup>

                {/* Trim */}
                <FieldGroup>
                  <Field orientation="horizontal">
                    <Checkbox
                      id="trim-checkbox"
                      checked={options.trim?.enabled}
                      onCheckedChange={(checked) => {
                        setOptions({
                          ...options,
                          trim: { ...options.trim!, enabled: Boolean(checked) },
                        });
                      }}
                    />
                    <FieldLabel htmlFor="trim-checkbox">Trim Audio</FieldLabel>
                  </Field>
                  {options.trim?.enabled && (
                    <FieldSet>
                      <FieldLabel>Trim options</FieldLabel>
                      <FieldDescription className="text-xs">
                        Choose whether to use per-file trim points or apply the same trim to all files
                      </FieldDescription>
                      <FieldGroup>
                        <RadioGroup
                          defaultValue="per-file"
                          onValueChange={(val) => {
                            setOptions({
                              ...options,
                              trim: { ...options.trim!, usePerFileTrim: val === "per-file" },
                            });
                          }}
                        >
                          <Field orientation="horizontal">
                            <RadioGroupItem id="trim-per-file" value="per-file" />
                            <FieldLabel htmlFor="trim-per-file">Use per-file trim settings</FieldLabel>
                          </Field>
                          <Field orientation="horizontal">
                            <RadioGroupItem id="trim-batched" value="batched" />
                            <FieldLabel htmlFor="trim-batched">Apply same trim to all files</FieldLabel>
                          </Field>
                        </RadioGroup>

                        {!options.trim?.usePerFileTrim && (
                          <div className="grid grid-cols-2 gap-3">
                            <Field>
                              <FieldLabel htmlFor="global-start" className="text-xs text-muted-foreground">
                                Start (s)
                              </FieldLabel>
                              <Input
                                id="global-start"
                                type="number"
                                value={options.trim?.globalStart}
                                onChange={(e) =>
                                  setOptions({
                                    ...options,
                                    trim: { ...options.trim!, globalStart: Number(e.target.value) },
                                  })
                                }
                                min={0}
                                step={0.1}
                              />
                            </Field>
                            <Field>
                              <FieldLabel htmlFor="global-end" className="text-xs text-muted-foreground">
                                End (s)
                              </FieldLabel>
                              <Input
                                id="global-end"
                                type="number"
                                value={options.trim?.globalEnd}
                                onChange={(e) =>
                                  setOptions({
                                    ...options,
                                    trim: { ...options.trim!, globalEnd: Number(e.target.value) },
                                  })
                                }
                                min={0}
                                step={0.1}
                              />
                            </Field>
                          </div>
                        )}
                      </FieldGroup>
                    </FieldSet>
                  )}
                </FieldGroup>

                {/* Progress, TODO: add shadcn progress */}
                {(processing || aggregateProgress.successfulFiles > 0 || aggregateProgress.failedFiles > 0) && (
                  <div className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center gap-2 text-sm text-white">
                      {processing ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Processing {files.length} files...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                          Batch processing complete
                        </>
                      )}
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full bg-[#7c3aed] transition-all duration-300"
                        style={{ width: `${aggregateProgress.percent}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-white/60">
                      <span className="font-mono">{aggregateProgress.percent}%</span>
                      <span>
                        Queued {aggregateProgress.queuedFiles} • Running {aggregateProgress.runningFiles} • Done{" "}
                        {aggregateProgress.successfulFiles} • Failed {aggregateProgress.failedFiles}
                      </span>
                    </div>
                    {activeFile && (
                      <div className="rounded border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
                        {activeFile.fileName} · {activeFile.step ?? "Finalizing"}...
                      </div>
                    )}
                    {failedFiles.length > 0 && (
                      <div className="rounded border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                        Failed: {failedFiles.map((file) => file.fileName).join(", ")}
                      </div>
                    )}
                  </div>
                )}
              </FieldGroup>
            ) : (
              <FieldGroup>
                {/* Export Annotations */}
                <FieldSet>
                  <FieldLabel>Export Format</FieldLabel>
                  <RadioGroup
                    defaultValue="json"
                    onValueChange={(val) => setExportFormat(val as "csv" | "json" | "textgrid")}
                  >
                    <Field orientation="horizontal">
                      <RadioGroupItem id="format-json" value="json" />
                      <FieldLabel htmlFor="format-json">
                        JSON{" "}
                        <span className="text-xs text-muted-foreground">(Standard JSON format with timestamps)</span>
                      </FieldLabel>
                    </Field>
                    <Field orientation="horizontal">
                      <RadioGroupItem id="format-csv" value="csv" />
                      <FieldLabel htmlFor="format-csv">
                        CSV{" "}
                        <span className="text-xs text-muted-foreground">(Comma-separated values for spreadsheets)</span>
                      </FieldLabel>
                    </Field>
                    <Field orientation="horizontal">
                      <RadioGroupItem id="format-textgrid" value="textgrid" />
                      <FieldLabel htmlFor="format-textgrid">
                        TextGrid{" "}
                        <span className="text-xs text-muted-foreground">(Praat-compatible annotation format)</span>
                      </FieldLabel>
                    </Field>
                  </RadioGroup>
                </FieldSet>

                {/* Stats */}
                <div className="space-y-2 p-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Files</span>
                    <span className="font-mono">{files.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Annotations</span>
                    <span className="font-mono">{annotations.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Annotated Files</span>
                    <span className="font-mono">{new Set(annotations.map((a) => a.fileId)).size}</span>
                  </div>
                </div>

                <Button onClick={handleExportAnnotations} disabled={!(files.length > 0 && annotations.length > 0)}>
                  <CheckCircle2 className="h-4 w-4" />
                  Export Annotations
                </Button>
              </FieldGroup>
            )}
          </div>
        </CardContent>

        {/* Footer */}
        {activeTab === "process" && (
          <CardFooter className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              {Object.values(options).filter((o) => o.enabled).length} operation(s) selected
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={handleCancelProcessing}>
                {processing ? "Stop" : "Cancel"}
              </Button>
              <Button
                variant="default"
                onClick={handleProcess}
                disabled={processing || !Object.values(options).some((o) => o.enabled)}
              >
                <Play className="h-3.5 w-3.5" />
                Process Files
              </Button>
            </div>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
