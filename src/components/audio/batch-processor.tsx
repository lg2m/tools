import { AlertCircle, CheckCircle2, Loader2, Play, X } from "lucide-react";
import { useState } from "react";

import type { Annotation, AudioFile } from "@/lib/audio/types";

interface ProcessingOptions {
  resample?: {
    enabled: boolean;
    targetRate: number;
  };
  convert?: {
    enabled: boolean;
    format: "wav" | "mp3" | "flac" | "ogg";
  };
  mono?: {
    enabled: boolean;
  };
  normalize?: {
    enabled: boolean;
    targetDb: number;
  };
  trim?: {
    enabled: boolean;
    usePerFileTrim: boolean;
    globalStart: number;
    globalEnd: number;
  };
}

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
  const [progress, setProgress] = useState(0);
  const [exportFormat, setExportFormat] = useState<"json" | "csv" | "textgrid">("json");

  const filesWithTrim = files.filter((f) => f.trimStart !== undefined || f.trimEnd !== undefined).length;

  const handleProcess = () => {
    setProcessing(true);
    setProgress(0);

    // Simulate processing
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setProcessing(false);
          return 100;
        }
        return prev + 2;
      });
    }, 50);
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
      <div className="relative flex h-[600px] w-[700px] flex-col rounded-lg border border-white/10 bg-[rgb(18,18,26)] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 p-4">
          <div className="flex items-center gap-3">
            <div className="h-1.5 w-1.5 rounded-full bg-[#7c3aed]" />
            <h2 className="text-sm font-semibold text-white">Batch Operations</h2>
            <span className="font-mono text-[11px] text-white/40">{files.length} files</span>
          </div>
          <button onClick={onClose} className="rounded p-1 text-white/50 hover:bg-white/5 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/5 px-4">
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "process" ? (
            <div className="space-y-6">
              {/* Resample */}
              <div className="space-y-3">
                <label className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={options.resample?.enabled}
                    onChange={(e) =>
                      setOptions({
                        ...options,
                        resample: { ...options.resample!, enabled: e.target.checked },
                      })
                    }
                    className="h-4 w-4 rounded border-white/10 bg-white/5 text-[#7c3aed] focus:ring-[#7c3aed] focus:ring-offset-0"
                  />
                  <span className="text-sm font-medium text-white">Resample</span>
                </label>
                {options.resample?.enabled && (
                  <div className="ml-6 space-y-2">
                    <label className="block text-xs text-white/60">Target Sample Rate (Hz)</label>
                    <select
                      value={options.resample?.targetRate}
                      onChange={(e) =>
                        setOptions({
                          ...options,
                          resample: { ...options.resample!, targetRate: Number(e.target.value) },
                        })
                      }
                      className="w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#7c3aed] focus:outline-none focus:ring-1 focus:ring-[#7c3aed]"
                    >
                      <option value={8000}>8000 Hz</option>
                      <option value={16000}>16000 Hz (ML Standard)</option>
                      <option value={22050}>22050 Hz</option>
                      <option value={44100}>44100 Hz</option>
                      <option value={48000}>48000 Hz</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Convert to Mono */}
              <div className="space-y-3">
                <label className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={options.mono?.enabled}
                    onChange={(e) =>
                      setOptions({
                        ...options,
                        mono: { enabled: e.target.checked },
                      })
                    }
                    className="h-4 w-4 rounded border-white/10 bg-white/5 text-[#7c3aed] focus:ring-[#7c3aed] focus:ring-offset-0"
                  />
                  <span className="text-sm font-medium text-white">Convert to Mono</span>
                </label>
              </div>

              {/* Format Conversion */}
              <div className="space-y-3">
                <label className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={options.convert?.enabled}
                    onChange={(e) =>
                      setOptions({
                        ...options,
                        convert: { ...options.convert!, enabled: e.target.checked },
                      })
                    }
                    className="h-4 w-4 rounded border-white/10 bg-white/5 text-[#7c3aed] focus:ring-[#7c3aed] focus:ring-offset-0"
                  />
                  <span className="text-sm font-medium text-white">Convert Format</span>
                </label>
                {options.convert?.enabled && (
                  <div className="ml-6 space-y-2">
                    <label className="block text-xs text-white/60">Target Format</label>
                    <select
                      value={options.convert?.format}
                      onChange={(e) =>
                        setOptions({
                          ...options,
                          convert: { ...options.convert!, format: e.target.value as any },
                        })
                      }
                      className="w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#7c3aed] focus:outline-none focus:ring-1 focus:ring-[#7c3aed]"
                    >
                      <option value="wav">WAV</option>
                      <option value="mp3">MP3</option>
                      <option value="flac">FLAC</option>
                      <option value="ogg">OGG</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Normalize */}
              <div className="space-y-3">
                <label className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={options.normalize?.enabled}
                    onChange={(e) =>
                      setOptions({
                        ...options,
                        normalize: { ...options.normalize!, enabled: e.target.checked },
                      })
                    }
                    className="h-4 w-4 rounded border-white/10 bg-white/5 text-[#7c3aed] focus:ring-[#7c3aed] focus:ring-offset-0"
                  />
                  <span className="text-sm font-medium text-white">Normalize Audio</span>
                </label>
                {options.normalize?.enabled && (
                  <div className="ml-6 space-y-2">
                    <label className="block text-xs text-white/60">Target Level (dB)</label>
                    <input
                      type="number"
                      value={options.normalize?.targetDb}
                      onChange={(e) =>
                        setOptions({
                          ...options,
                          normalize: { ...options.normalize!, targetDb: Number(e.target.value) },
                        })
                      }
                      className="w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#7c3aed] focus:outline-none focus:ring-1 focus:ring-[#7c3aed]"
                      min={-60}
                      max={0}
                      step={0.1}
                    />
                  </div>
                )}
              </div>

              {/* Trim */}
              <div className="space-y-3">
                <label className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={options.trim?.enabled}
                    onChange={(e) =>
                      setOptions({
                        ...options,
                        trim: { ...options.trim!, enabled: e.target.checked },
                      })
                    }
                    className="h-4 w-4 rounded border-white/10 bg-white/5 text-[#7c3aed] focus:ring-[#7c3aed] focus:ring-offset-0"
                  />
                  <span className="text-sm font-medium text-white">Trim Audio</span>
                </label>
                {options.trim?.enabled && (
                  <div className="ml-6 space-y-3">
                    {filesWithTrim > 0 && (
                      <div className="rounded border border-[#7c3aed]/30 bg-[#7c3aed]/10 p-3">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#7c3aed]" />
                          <div className="space-y-1">
                            <div className="text-xs font-medium text-white">
                              {filesWithTrim} file{filesWithTrim !== 1 ? "s" : ""} have individual trim settings
                            </div>
                            <div className="text-[11px] text-white/60">
                              Choose whether to use per-file trim points or apply the same trim to all files
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="trimMode"
                          checked={options.trim?.usePerFileTrim}
                          onChange={() =>
                            setOptions({
                              ...options,
                              trim: { ...options.trim!, usePerFileTrim: true },
                            })
                          }
                          className="h-3.5 w-3.5 border-white/10 bg-white/5 text-[#7c3aed] focus:ring-[#7c3aed] focus:ring-offset-0"
                        />
                        <span className="text-xs text-white">Use per-file trim settings</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="trimMode"
                          checked={!options.trim?.usePerFileTrim}
                          onChange={() =>
                            setOptions({
                              ...options,
                              trim: { ...options.trim!, usePerFileTrim: false },
                            })
                          }
                          className="h-3.5 w-3.5 border-white/10 bg-white/5 text-[#7c3aed] focus:ring-[#7c3aed] focus:ring-offset-0"
                        />
                        <span className="text-xs text-white">Apply same trim to all files</span>
                      </label>
                    </div>

                    {!options.trim?.usePerFileTrim && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <label className="block text-xs text-white/60">Start (s)</label>
                          <input
                            type="number"
                            value={options.trim?.globalStart}
                            onChange={(e) =>
                              setOptions({
                                ...options,
                                trim: { ...options.trim!, globalStart: Number(e.target.value) },
                              })
                            }
                            className="w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#7c3aed] focus:outline-none focus:ring-1 focus:ring-[#7c3aed]"
                            min={0}
                            step={0.1}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="block text-xs text-white/60">End (s)</label>
                          <input
                            type="number"
                            value={options.trim?.globalEnd}
                            onChange={(e) =>
                              setOptions({
                                ...options,
                                trim: { ...options.trim!, globalEnd: Number(e.target.value) },
                              })
                            }
                            className="w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#7c3aed] focus:outline-none focus:ring-1 focus:ring-[#7c3aed]"
                            min={0}
                            step={0.1}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Progress */}
              {processing && (
                <div className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center gap-2 text-sm text-white">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing {files.length} files...
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full bg-[#7c3aed] transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="text-right font-mono text-xs text-white/60">{progress}%</div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Export Annotations */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-white">Export Format</h3>
                <div className="space-y-2">
                  <label className="flex items-center gap-2.5">
                    <input
                      type="radio"
                      name="format"
                      checked={exportFormat === "json"}
                      onChange={() => setExportFormat("json")}
                      className="h-4 w-4 border-white/10 bg-white/5 text-[#7c3aed] focus:ring-[#7c3aed] focus:ring-offset-0"
                    />
                    <div>
                      <div className="text-sm text-white">JSON</div>
                      <div className="text-xs text-white/50">Standard JSON format with timestamps</div>
                    </div>
                  </label>
                  <label className="flex items-center gap-2.5">
                    <input
                      type="radio"
                      name="format"
                      checked={exportFormat === "csv"}
                      onChange={() => setExportFormat("csv")}
                      className="h-4 w-4 border-white/10 bg-white/5 text-[#7c3aed] focus:ring-[#7c3aed] focus:ring-offset-0"
                    />
                    <div>
                      <div className="text-sm text-white">CSV</div>
                      <div className="text-xs text-white/50">Comma-separated values for spreadsheets</div>
                    </div>
                  </label>
                  <label className="flex items-center gap-2.5">
                    <input
                      type="radio"
                      name="format"
                      checked={exportFormat === "textgrid"}
                      onChange={() => setExportFormat("textgrid")}
                      className="h-4 w-4 border-white/10 bg-white/5 text-[#7c3aed] focus:ring-[#7c3aed] focus:ring-offset-0"
                    />
                    <div>
                      <div className="text-sm text-white">TextGrid</div>
                      <div className="text-xs text-white/50">Praat-compatible annotation format</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Stats */}
              <div className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">Total Files</span>
                  <span className="font-mono text-white">{files.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">Total Annotations</span>
                  <span className="font-mono text-white">{annotations.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">Annotated Files</span>
                  <span className="font-mono text-white">{new Set(annotations.map((a) => a.fileId)).size}</span>
                </div>
              </div>

              <button
                onClick={handleExportAnnotations}
                className="flex w-full items-center justify-center gap-2 rounded bg-[#7c3aed] px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-[#7c3aed]/20 hover:bg-[#6d28d9]"
              >
                <CheckCircle2 className="h-4 w-4" />
                Export Annotations
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {activeTab === "process" && (
          <div className="flex items-center justify-between border-t border-white/5 p-4">
            <div className="text-xs text-white/50">
              {Object.values(options).filter((o) => o.enabled).length} operation(s) selected
            </div>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="rounded px-4 py-2 text-sm font-medium text-white/60 hover:bg-white/5 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleProcess}
                disabled={processing || !Object.values(options).some((o) => o.enabled)}
                className="flex items-center gap-2 rounded bg-[#7c3aed] px-4 py-2 text-sm font-medium text-white shadow-lg shadow-[#7c3aed]/20 hover:bg-[#6d28d9] disabled:opacity-50"
              >
                <Play className="h-3.5 w-3.5" />
                Process Files
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
