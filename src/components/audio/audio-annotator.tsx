import { useState, useRef, useEffect, useCallback } from "react";

import { ChevronLeft, ChevronRight, Play as PlayIcon, Trash2, X } from "lucide-react";

import type { AudioFile, Label, Annotation } from "@/lib/audio/types";

import { WaveformViewer, type Selection } from "./waveform-viewer";
import { SpectrogramViewer } from "./spectrogram-viewer";
import { FileManager } from "./file-manager";
import { TransportControls } from "./transport-controls";
import { LabelManager } from "./label-manager";
import { MetadataPanel } from "./metadata-panel";
import { HotkeyOverlay } from "./hotkey-overlay";
import { BatchProcessor } from "./batch-processor";
import { cn } from "@/lib/utils";

function formatTimeShort(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toFixed(2).padStart(5, "0")}`;
}

export function AudioAnnotator() {
  const [files, setFiles] = useState<AudioFile[]>([]);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState(0);
  const [labels, setLabels] = useState<Label[]>([
    { id: "1", name: "Speech", color: "#3b82f6", hotkey: "1" },
    { id: "2", name: "Noise", color: "#f59e0b", hotkey: "2" },
    { id: "3", name: "Silence", color: "#6366f1", hotkey: "3" },
  ]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [lastUsedLabel, setLastUsedLabel] = useState<string>(labels[0].id);
  const [showHotkeys, setShowHotkeys] = useState(false);
  const [showBatchProcessor, setShowBatchProcessor] = useState(false);
  const [viewMode, setViewMode] = useState<"waveform" | "spectrogram" | "both">("both");
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  const [mode, setMode] = useState<"annotate" | "trim">("annotate");
  const [pendingSelection, setPendingSelection] = useState<Selection | null>(null);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);
  const currentFile = files[currentFileIndex];

  // Hotkey handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent default for all our hotkeys
      if (
        [
          "Space",
          "KeyK",
          "KeyJ",
          "KeyL",
          "Comma",
          "Period",
          "Slash",
          "KeyB",
          "Escape",
          "Enter",
          "Delete",
          "Backspace",
        ].includes(e.code) ||
        (e.code.startsWith("Digit") && !e.shiftKey && !e.ctrlKey && !e.metaKey)
      ) {
        e.preventDefault();
      }

      switch (e.code) {
        case "Space":
        case "KeyK":
          togglePlayPause();
          break;
        case "KeyJ":
          skipBackward();
          break;
        case "KeyL":
          skipForward();
          break;
        case "Comma":
          previousFile();
          break;
        case "Period":
          nextFile();
          break;
        case "Slash":
          setShowHotkeys((prev) => !prev);
          break;
        case "KeyB":
          if (e.ctrlKey || e.metaKey) {
            setShowBatchProcessor(true);
          }
          break;
        case "Escape":
          if (pendingSelection) {
            setPendingSelection(null);
          } else if (selectedAnnotationId) {
            setSelectedAnnotationId(null);
          }
          break;
        case "Delete":
        case "Backspace":
          if (selectedAnnotationId) {
            setAnnotations((prev) => prev.filter((a) => a.id !== selectedAnnotationId));
            setSelectedAnnotationId(null);
          }
          break;
        case "Enter":
          if (pendingSelection && audioRef.current) {
            // Play selection on Enter
            audioRef.current.currentTime = pendingSelection.startTime;
            setCurrentTime(pendingSelection.startTime);
            audioRef.current.play();
            setIsPlaying(true);

            const endTime = pendingSelection.endTime;
            const checkEnd = () => {
              if (!audioRef.current) return;
              if (audioRef.current.currentTime >= endTime - 0.05) {
                audioRef.current.pause();
                audioRef.current.currentTime = endTime;
                setCurrentTime(endTime);
                setIsPlaying(false);
                return;
              }
              if (!audioRef.current.paused) {
                requestAnimationFrame(checkEnd);
              }
            };
            requestAnimationFrame(checkEnd);
          } else if (selectedAnnotationId && audioRef.current) {
            // Play selected annotation on Enter
            const annotation = annotations.find((a) => a.id === selectedAnnotationId);
            if (annotation) {
              audioRef.current.currentTime = annotation.startTime;
              setCurrentTime(annotation.startTime);
              audioRef.current.play();
              setIsPlaying(true);

              const endTime = annotation.endTime;
              const checkEnd = () => {
                if (!audioRef.current) return;
                if (audioRef.current.currentTime >= endTime - 0.05) {
                  audioRef.current.pause();
                  audioRef.current.currentTime = endTime;
                  setCurrentTime(endTime);
                  setIsPlaying(false);
                  return;
                }
                if (!audioRef.current.paused) {
                  requestAnimationFrame(checkEnd);
                }
              };
              requestAnimationFrame(checkEnd);
            }
          }
          break;
        default:
          // Number keys for labels
          if (e.code.startsWith("Digit")) {
            const num = e.code.replace("Digit", "");
            const label = labels.find((l) => l.hotkey === num);
            if (label) {
              // If there's a pending selection, create annotation with this label
              if (pendingSelection && currentFile) {
                const annotation: Annotation = {
                  id: `${Date.now()}`,
                  fileId: currentFile.id,
                  labelId: label.id,
                  startTime: pendingSelection.startTime,
                  endTime: pendingSelection.endTime,
                };
                setAnnotations((prev) => [...prev, annotation]);
                setLastUsedLabel(label.id);
                setPendingSelection(null);
              } else {
                setLastUsedLabel(label.id);
              }
            }
          }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [labels, pendingSelection, currentFile, selectedAnnotationId, annotations]);

  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const skipBackward = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 5);
    }
  };

  const skipForward = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.min(audioRef.current.duration || 0, audioRef.current.currentTime + 5);
    }
  };

  const previousFile = () => {
    if (currentFileIndex > 0) {
      setCurrentFileIndex(currentFileIndex - 1);
      setCurrentTime(0);
      setIsPlaying(false);
    }
  };

  const nextFile = () => {
    if (currentFileIndex < files.length - 1) {
      setCurrentFileIndex(currentFileIndex + 1);
      setCurrentTime(0);
      setIsPlaying(false);
    }
  };

  const handleFileUpload = (newFiles: File[]) => {
    const audioFiles: AudioFile[] = newFiles.map((file, index) => ({
      id: `${Date.now()}-${index}`,
      name: file.name,
      url: URL.createObjectURL(file),
      duration: 0,
      format: file.type,
      sampleRate: 44100,
      channels: 2,
      bitDepth: 16,
      trimStart: undefined,
      trimEnd: undefined,
    }));
    setFiles([...files, ...audioFiles]);
  };

  const handleRemoveFile = (fileId: string) => {
    const newFiles = files.filter((f) => f.id !== fileId);
    setFiles(newFiles);
    if (currentFileIndex >= newFiles.length) {
      setCurrentFileIndex(Math.max(0, newFiles.length - 1));
    }
  };

  const handleFileTrimUpdate = (fileId: string, trimStart?: number, trimEnd?: number) => {
    setFiles(files.map((f) => (f.id === fileId ? { ...f, trimStart, trimEnd } : f)));
  };

  const handleAddAnnotation = (annotation: Annotation) => {
    setAnnotations([...annotations, annotation]);
    setLastUsedLabel(annotation.labelId);
  };

  const handleRemoveAnnotation = (annotationId: string) => {
    setAnnotations(annotations.filter((a) => a.id !== annotationId));
  };

  const handleSetTrimRegion = (startTime: number, endTime: number) => {
    if (currentFile) {
      handleFileTrimUpdate(currentFile.id, startTime, endTime);
    }
  };

  const handleSelectionChange = useCallback((selection: Selection | null) => {
    setPendingSelection(selection);
  }, []);

  const handleUpdateAnnotation = useCallback(
    (annotationId: string, updates: { startTime?: number; endTime?: number }) => {
      setAnnotations((prev) =>
        prev.map((a) =>
          a.id === annotationId
            ? {
                ...a,
                ...(updates.startTime !== undefined && { startTime: updates.startTime }),
                ...(updates.endTime !== undefined && { endTime: updates.endTime }),
              }
            : a,
        ),
      );
    },
    [],
  );

  const handleChangeAnnotationLabel = useCallback((annotationId: string, labelId: string) => {
    setAnnotations((prev) => prev.map((a) => (a.id === annotationId ? { ...a, labelId } : a)));
    setLastUsedLabel(labelId);
  }, []);

  const handleAddAnnotationFromSelection = useCallback(
    (labelId: string) => {
      if (!pendingSelection || !currentFile) return;

      const annotation: Annotation = {
        id: `${Date.now()}`,
        fileId: currentFile.id,
        labelId,
        startTime: pendingSelection.startTime,
        endTime: pendingSelection.endTime,
      };

      setAnnotations((prev) => [...prev, annotation]);
      setLastUsedLabel(labelId);
      setPendingSelection(null);
      setSelectedAnnotationId(annotation.id); // Auto-select the new annotation
    },
    [pendingSelection, currentFile],
  );

  const handlePlaySelection = useCallback(() => {
    if (!pendingSelection || !audioRef.current) return;

    audioRef.current.currentTime = pendingSelection.startTime;
    setCurrentTime(pendingSelection.startTime);
    audioRef.current.play();
    setIsPlaying(true);

    const endTime = pendingSelection.endTime;
    const checkEnd = () => {
      if (!audioRef.current) return;
      if (audioRef.current.currentTime >= endTime - 0.05) {
        audioRef.current.pause();
        audioRef.current.currentTime = endTime;
        setCurrentTime(endTime);
        setIsPlaying(false);
        return;
      }
      if (!audioRef.current.paused) {
        requestAnimationFrame(checkEnd);
      }
    };
    requestAnimationFrame(checkEnd);
  }, [pendingSelection]);

  const handleClearSelection = useCallback(() => {
    setPendingSelection(null);
  }, []);

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      {/* Top toolbar */}
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-2.5 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-primary" />
            <h1 className="text-sm font-semibold tracking-tight text-foreground">Audio Annotator</h1>
          </div>
          <div className="ml-4 font-mono text-[11px] text-muted-foreground">
            {files.length > 0 ? `${currentFileIndex + 1} / ${files.length}` : "No files"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMode("annotate")}
            className={cn(
              "rounded px-2.5 py-1 text-[11px] font-medium transition-all",
              mode === "annotate"
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            Annotate
          </button>
          <button
            onClick={() => setMode("trim")}
            disabled={files.length === 0}
            className={cn(
              "rounded px-2.5 py-1 text-[11px] font-medium transition-all disabled:opacity-30",
              mode === "trim"
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            Trim
          </button>
          <button
            onClick={() => setShowBatchProcessor(true)}
            disabled={files.length === 0}
            className="rounded px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
          >
            Batch Operations
          </button>
          <div className="mx-1 h-4 w-px bg-border" />
          <button
            onClick={() => setViewMode("waveform")}
            className={cn(
              "rounded px-2.5 py-1 text-[11px] font-medium transition-all",
              viewMode === "waveform"
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            Waveform
          </button>
          <button
            onClick={() => setViewMode("spectrogram")}
            className={cn(
              "rounded px-2.5 py-1 text-[11px] font-medium transition-all",
              viewMode === "spectrogram"
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            Spectrogram
          </button>
          <button
            onClick={() => setViewMode("both")}
            className={cn(
              "rounded px-2.5 py-1 text-[11px] font-medium transition-all",
              viewMode === "both"
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            Both
          </button>
          <div className="mx-2 h-4 w-px bg-border" />
          <button
            onClick={() => setShowHotkeys(!showHotkeys)}
            className="rounded px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {/* TODO: shadcn has Kbd */}
            <kbd className="font-mono text-[10px] text-muted-foreground">/</kbd>
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div
          className={cn(
            "relative flex-shrink-0 border-r border-border bg-card transition-all duration-300",
            leftSidebarOpen ? "w-64" : "w-0",
          )}
        >
          <div className={cn(leftSidebarOpen ? "h-full overflow-hidden" : "hidden")}>
            <FileManager
              files={files}
              currentFileIndex={currentFileIndex}
              onFileSelect={setCurrentFileIndex}
              onFileUpload={handleFileUpload}
              onFileRemove={handleRemoveFile}
              onFileTrimUpdate={handleFileTrimUpdate}
            />
          </div>
          <button
            onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
            className="absolute -right-3 top-4 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-lg hover:bg-muted hover:text-foreground"
          >
            {leftSidebarOpen ? <ChevronLeft className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        </div>

        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Visualization area */}
          <div className="relative flex-1 overflow-auto bg-background p-4">
            {currentFile ? (
              <div className="flex h-full min-h-0 flex-col gap-3">
                {(viewMode === "waveform" || viewMode === "both") && (
                  <div className={viewMode === "both" ? "min-h-0 flex-1" : "h-full"}>
                    <WaveformViewer
                      audioUrl={currentFile.url}
                      currentTime={currentTime}
                      zoom={zoom}
                      panOffset={panOffset}
                      annotations={annotations.filter((a) => a.fileId === currentFile.id)}
                      labels={labels}
                      lastUsedLabel={lastUsedLabel}
                      onZoomChange={setZoom}
                      onPanChange={setPanOffset}
                      onAddAnnotation={handleAddAnnotation}
                      onRemoveAnnotation={handleRemoveAnnotation}
                      onUpdateAnnotation={handleUpdateAnnotation}
                      fileId={currentFile.id}
                      mode={mode}
                      trimStart={currentFile.trimStart}
                      trimEnd={currentFile.trimEnd}
                      onSetTrimRegion={handleSetTrimRegion}
                      onSelectionChange={handleSelectionChange}
                      pendingSelection={pendingSelection}
                      selectedAnnotationId={selectedAnnotationId}
                      onAnnotationSelect={setSelectedAnnotationId}
                    />
                  </div>
                )}
                {(viewMode === "spectrogram" || viewMode === "both") && (
                  <div className={viewMode === "both" ? "min-h-0 flex-1" : "h-full"}>
                    <SpectrogramViewer
                      audioUrl={currentFile.url}
                      currentTime={currentTime}
                      zoom={zoom}
                      panOffset={panOffset}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <div className="mb-3 text-3xl opacity-20">♪</div>
                  <p className="text-xs text-muted-foreground">No audio file(s) added</p>
                </div>
              </div>
            )}

            {/* Selection Actions Overlay */}
            {mode === "annotate" &&
              pendingSelection &&
              Math.abs(pendingSelection.endTime - pendingSelection.startTime) > 0.05 && (
                <div className="absolute left-1/2 top-6 z-20 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5 shadow-xl backdrop-blur">
                  <span className="font-mono text-xs text-muted-foreground">
                    {formatTimeShort(pendingSelection.startTime)} → {formatTimeShort(pendingSelection.endTime)}
                  </span>
                  <div className="h-4 w-px bg-border" />
                  <div className="flex items-center gap-1.5">
                    {labels.slice(0, 5).map((label) => (
                      <button
                        key={label.id}
                        type="button"
                        onClick={() => handleAddAnnotationFromSelection(label.id)}
                        className="flex items-center gap-1.5 rounded px-2 py-1 text-[11px] font-medium transition-colors hover:bg-border"
                        title={`Create ${label.name} annotation (${label.hotkey})`}
                      >
                        <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: label.color }} />
                        <span className="text-foreground">{label.name}</span>
                      </button>
                    ))}
                  </div>
                  <div className="h-4 w-px bg-border" />
                  <button
                    type="button"
                    onClick={handlePlaySelection}
                    className="flex items-center gap-1.5 rounded px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-border hover:text-foreground"
                    title="Play selection (Enter)"
                  >
                    <PlayIcon className="h-3 w-3" />
                    Play
                  </button>
                  <button
                    type="button"
                    onClick={handleClearSelection}
                    className="flex items-center justify-center rounded p-1 text-muted-foreground transition-colors hover:bg-border hover:text-foreground"
                    title="Cancel selection (Esc)"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

            {/* Selected Annotation Actions Overlay */}
            {mode === "annotate" &&
              selectedAnnotationId &&
              !pendingSelection &&
              (() => {
                const annotation = annotations.find((a) => a.id === selectedAnnotationId);
                const label = annotation ? labels.find((l) => l.id === annotation.labelId) : null;
                if (!annotation || !label) return null;
                return (
                  <div className="absolute left-1/2 top-6 z-20 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5 shadow-xl backdrop-blur">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: label.color }} />
                      <span className="text-xs font-medium text-foreground">{label.name}</span>
                    </div>
                    <span className="font-mono text-xs text-muted-foreground">
                      {formatTimeShort(annotation.startTime)} → {formatTimeShort(annotation.endTime)}
                    </span>
                    <div className="h-4 w-px bg-border" />
                    <div className="flex items-center gap-1">
                      {labels.slice(0, 5).map((l) => (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => handleChangeAnnotationLabel(selectedAnnotationId, l.id)}
                          className={cn(
                            "flex h-6 w-6 items-center justify-center rounded transition-colors",
                            l.id === label.id
                              ? "ring-2 ring-muted-foreground"
                              : "opacity-60 hover:opacity-100 hover:ring-1 hover:ring-muted-foreground/40",
                          )}
                          style={{ backgroundColor: l.color }}
                          title={`Change to ${l.name} (${l.hotkey})`}
                        >
                          {l.id === label.id && (
                            <span className="text-[10px] font-bold text-primary-foreground">✓</span>
                          )}
                        </button>
                      ))}
                    </div>
                    <div className="h-4 w-px bg-border" />
                    <button
                      type="button"
                      onClick={() => {
                        if (audioRef.current) {
                          audioRef.current.currentTime = annotation.startTime;
                          setCurrentTime(annotation.startTime);
                          audioRef.current.play();
                          setIsPlaying(true);

                          const endTime = annotation.endTime;
                          const checkEnd = () => {
                            if (!audioRef.current) return;
                            if (audioRef.current.currentTime >= endTime - 0.05) {
                              audioRef.current.pause();
                              audioRef.current.currentTime = endTime;
                              setCurrentTime(endTime);
                              setIsPlaying(false);
                              return;
                            }
                            if (!audioRef.current.paused) {
                              requestAnimationFrame(checkEnd);
                            }
                          };
                          requestAnimationFrame(checkEnd);
                        }
                      }}
                      className="flex items-center gap-1.5 rounded px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-border hover:text-foreground"
                      title="Play annotation (Enter)"
                    >
                      <PlayIcon className="h-3 w-3" />
                      Play
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAnnotations((prev) => prev.filter((a) => a.id !== selectedAnnotationId));
                        setSelectedAnnotationId(null);
                      }}
                      className="flex items-center gap-1.5 rounded px-2 py-1 text-[11px] font-medium text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
                      title="Delete annotation (Delete)"
                    >
                      <Trash2 className="h-3 w-3" />
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedAnnotationId(null)}
                      className="flex items-center justify-center rounded p-1 text-muted-foreground transition-colors hover:bg-border hover:text-foreground"
                      title="Deselect (Esc)"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })()}
          </div>

          {/* Transport controls */}
          <TransportControls
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={currentFile?.duration || 0}
            onPlayPause={togglePlayPause}
            onSeek={(time) => {
              if (audioRef.current) {
                audioRef.current.currentTime = time;
                setCurrentTime(time);
              }
            }}
            onPrevious={previousFile}
            onNext={nextFile}
            zoom={zoom}
            onZoomChange={setZoom}
          />
        </div>

        <div
          className={cn(
            "relative flex-shrink-0 border-l border-border bg-card transition-all duration-300",
            rightSidebarOpen ? "w-72" : "w-0",
          )}
        >
          <div className={rightSidebarOpen ? "flex h-full flex-col overflow-hidden" : "hidden"}>
            <LabelManager
              labels={labels}
              onAddLabel={(label) => setLabels([...labels, label])}
              onRemoveLabel={(labelId) => setLabels(labels.filter((l) => l.id !== labelId))}
              onUpdateLabel={(labelId, updates) => {
                setLabels(labels.map((l) => (l.id === labelId ? { ...l, ...updates } : l)));
              }}
              lastUsedLabel={lastUsedLabel}
            />
            {currentFile && <MetadataPanel file={currentFile} />}
          </div>
          <button
            onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
            className="absolute -left-3 top-4 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-lg hover:bg-muted hover:text-foreground"
          >
            {rightSidebarOpen ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
          </button>
        </div>
      </div>

      {/* Hidden audio element */}
      {currentFile && (
        <audio
          ref={audioRef}
          src={currentFile.url}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => {
            const audio = e.currentTarget;
            setFiles(files.map((f) => (f.id === currentFile.id ? { ...f, duration: audio.duration } : f)));
          }}
          onEnded={() => setIsPlaying(false)}
        />
      )}

      {/* Hotkey overlay */}
      {showHotkeys && <HotkeyOverlay onClose={() => setShowHotkeys(false)} labels={labels} />}

      {/* Batch processor modal */}
      {showBatchProcessor && (
        <BatchProcessor files={files} annotations={annotations} onClose={() => setShowBatchProcessor(false)} />
      )}
    </div>
  );
}
