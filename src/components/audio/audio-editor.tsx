import { useMemo, useTransition } from "react";
import { useShallow } from "zustand/shallow";

import { AudioBatchProcessor } from "@/components/audio/batch/audio-batch-processor";
import { FileManager } from "@/components/audio/file-manager";
import { LabelManager } from "@/components/audio/label-manager";
import { SelectionOverlay } from "@/components/audio/selection-overlay";
import { SpectrogramViewer } from "@/components/audio/spectrogram-viewer";
import { WaveformViewer } from "@/components/audio/waveform-viewer";
import { EditorSidebar } from "@/components/editor-sidebar";
import { EditorToolbar } from "@/components/editor-toolbar";
import { HotkeyOverlay } from "@/components/hotkey-overlay";
import { MetadataPanel } from "@/components/metadata-panel";
import { TransportControls } from "@/components/transport-controls";
import { AUDIO_HOTKEY_TIP, AUDIO_HOTKEYS } from "@/config/hotkeys";
import { useAudioAnnotatorState } from "@/hooks/use-audio-annotator-state";
import { useAudioPlayback } from "@/hooks/use-audio-playback";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { useAudioDomainStore, useAudioUiStore } from "@/store/audio";
import type { Annotation } from "@/types/audio";

export function AudioEditor() {
  const { audioRef, togglePlayPause, skipBackward, skipForward, playRange, previousFile, nextFile, seek } =
    useAudioPlayback();
  const [isPending, startTransition] = useTransition();

  const { files, currentFileIndex, currentFile, currentAnnotations, optimisticAnnotations, addOptimisticAnnotation } =
    useAudioAnnotatorState();

  const {
    isPlaying,
    currentTime,
    labels,
    pendingSelection,
    selectedAnnotationId,
    patchFile,
    setPlaying,
    setCurrentTime,
    setLastUsedLabel,
    addAnnotation,
    removeAnnotation,
    updateAnnotation,
    setSelectedAnnotation,
    setPendingSelection,
  } = useAudioDomainStore(
    useShallow((s) => ({
      isPlaying: s.isPlaying,
      currentTime: s.currentTime,
      labels: s.labels,
      pendingSelection: s.pendingSelection,
      selectedAnnotationId: s.selectedAnnotationId,
      patchFile: s.patchFile,
      setPlaying: s.setPlaying,
      setCurrentTime: s.setCurrentTime,
      setLastUsedLabel: s.setLastUsedLabel,
      addAnnotation: s.addAnnotation,
      removeAnnotation: s.removeAnnotation,
      updateAnnotation: s.updateAnnotation,
      setSelectedAnnotation: s.setSelectedAnnotation,
      setPendingSelection: s.setPendingSelection,
    })),
  );

  const {
    zoom,
    viewMode,
    mode,
    showHotkeys,
    showBatchProcessor,
    leftSidebarOpen,
    rightSidebarOpen,
    setZoom,
    setViewMode,
    setMode,
    toggleHotkeys,
    toggleBatchProcessor,
    toggleLeftSidebar,
    toggleRightSidebar,
  } = useAudioUiStore(
    useShallow((s) => ({
      zoom: s.zoom,
      viewMode: s.viewMode,
      mode: s.mode,
      showHotkeys: s.showHotkeys,
      showBatchProcessor: s.showBatchProcessor,
      leftSidebarOpen: s.leftSidebarOpen,
      rightSidebarOpen: s.rightSidebarOpen,
      setZoom: s.setZoom,
      setViewMode: s.setViewMode,
      setMode: s.setMode,
      toggleHotkeys: s.toggleHotkeys,
      toggleBatchProcessor: s.toggleBatchProcessor,
      toggleLeftSidebar: s.toggleLeftSidebar,
      toggleRightSidebar: s.toggleRightSidebar,
    })),
  );

  useHotkeys({
    togglePlayPause,
    skipBackward,
    skipForward,
    previousFile,
    nextFile,
    playRange,
  });

  const hasFiles = files.length > 0;
  const status = hasFiles ? `${currentFileIndex + 1} / ${files.length}` : "No files";

  const handleAddAnnotationFromSelection = (labelId: string) => {
    if (!pendingSelection || !currentFile) return;

    const annotation: Annotation = {
      id: `${Date.now()}`,
      fileId: currentFile.id,
      labelId,
      startTime: pendingSelection.startTime,
      endTime: pendingSelection.endTime,
    };

    addOptimisticAnnotation(annotation);
    addAnnotation(annotation);
    setLastUsedLabel(labelId);
    setPendingSelection(null);
    setSelectedAnnotation(annotation.id);
  };

  const handleChangeAnnotationLabel = (annotationId: string, labelId: string) => {
    updateAnnotation(annotationId, { labelId });
    setLastUsedLabel(labelId);
  };

  const handlePlaySelection = () => {
    if (!pendingSelection) return;
    playRange(pendingSelection.startTime, pendingSelection.endTime);
  };

  const handleDeleteAnnotation = (annotationId: string) => {
    removeAnnotation(annotationId);
    setSelectedAnnotation(null);
  };

  const handleZoomChange = (newZoom: number) => {
    startTransition(() => {
      setZoom(newZoom);
    });
  };

  const toolbarItems = useMemo(
    () => [
      {
        type: "toggle" as const,
        id: "mode",
        value: mode,
        options: [
          { value: "annotate", label: "Annotate" },
          { value: "trim", label: "Trim", disabled: !hasFiles },
        ],
        onChange: (value: string) => setMode(value as "annotate" | "trim"),
      },
      {
        type: "action" as const,
        id: "batch",
        label: "Process & Export",
        onClick: toggleBatchProcessor,
        disabled: !hasFiles,
      },
      { type: "separator" as const, id: "sep1" },
      {
        type: "toggle" as const,
        id: "viewMode",
        value: viewMode,
        options: [
          { value: "waveform", label: "Waveform" },
          { value: "spectrogram", label: "Spectrogram" },
          { value: "both", label: "Both" },
        ],
        onChange: (value: string) => {
          startTransition(() => {
            setViewMode(value as "waveform" | "spectrogram" | "both");
          });
        },
      },
      { type: "separator" as const, id: "sep2" },
      {
        type: "action" as const,
        id: "hotkeys",
        label: "Hotkeys",
        kbd: "/",
        onClick: () => toggleHotkeys(),
      },
    ],
    [mode, viewMode, hasFiles, setMode, setViewMode, toggleBatchProcessor, toggleHotkeys],
  );

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <EditorToolbar title="Audio Annotator" status={status} isPending={isPending} items={toolbarItems} />

      <div className="relative flex flex-1 overflow-hidden">
        <EditorSidebar open={leftSidebarOpen} side="left" onToggle={toggleLeftSidebar}>
          <FileManager />
        </EditorSidebar>

        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="relative flex-1 overflow-auto bg-background p-4">
            {currentFile ? (
              <div className="flex h-full min-h-0 flex-col gap-3">
                {(viewMode === "waveform" || viewMode === "both") && (
                  <div className={viewMode === "both" ? "min-h-0 flex-1" : "h-full"}>
                    <WaveformViewer />
                  </div>
                )}
                {(viewMode === "spectrogram" || viewMode === "both") && (
                  <div className={viewMode === "both" ? "min-h-0 flex-1" : "h-full"}>
                    <SpectrogramViewer />
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

            {mode === "annotate" &&
              pendingSelection &&
              Math.abs(pendingSelection.endTime - pendingSelection.startTime) > 0.05 && (
                <SelectionOverlay
                  variant="selection"
                  selection={pendingSelection}
                  labels={labels}
                  onAddAnnotation={handleAddAnnotationFromSelection}
                  onPlay={handlePlaySelection}
                  onClose={() => setPendingSelection(null)}
                />
              )}

            {mode === "annotate" &&
              selectedAnnotationId &&
              !pendingSelection &&
              (() => {
                const annotation = currentAnnotations.find((a) => a.id === selectedAnnotationId);
                const label = annotation ? labels.find((l) => l.id === annotation.labelId) : null;
                if (!annotation || !label) return null;
                return (
                  <SelectionOverlay
                    variant="annotation"
                    annotation={annotation}
                    currentLabel={label}
                    labels={labels}
                    onChangeLabel={(labelId) => handleChangeAnnotationLabel(selectedAnnotationId, labelId)}
                    onPlay={() => playRange(annotation.startTime, annotation.endTime)}
                    onDelete={() => handleDeleteAnnotation(selectedAnnotationId)}
                    onClose={() => setSelectedAnnotation(null)}
                  />
                );
              })()}
          </div>

          <TransportControls
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={currentFile?.duration || 0}
            onPlayPause={togglePlayPause}
            onSeek={seek}
            navigation={{
              onPrevious: previousFile,
              onNext: nextFile,
              previousTitle: "Previous file (,)",
              nextTitle: "Next file (.)",
            }}
            zoom={{ zoom, onZoomChange: handleZoomChange }}
          />
        </div>

        <EditorSidebar open={rightSidebarOpen} side="right" onToggle={toggleRightSidebar}>
          <LabelManager />
          {currentFile && (
            <MetadataPanel
              fields={[
                { label: "Filename", value: currentFile.name },
                {
                  label: "Duration",
                  value: currentFile.duration > 0 ? `${currentFile.duration.toFixed(2)}s` : "Loading...",
                },
                { label: "Format", value: currentFile.format || "Unknown" },
                { label: "Sample Rate", value: `${currentFile.sampleRate} Hz` },
                { label: "Channels", value: currentFile.channels === 2 ? "Stereo" : "Mono" },
                { label: "Bit Depth", value: `${currentFile.bitDepth} bit` },
              ]}
            />
          )}
        </EditorSidebar>
      </div>

      {currentFile && (
        <audio
          ref={audioRef}
          src={currentFile.url}
          onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
          onLoadedMetadata={(event) => {
            patchFile(currentFile.id, { duration: event.currentTarget.duration });
          }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
        >
          <track kind="captions" />
        </audio>
      )}

      <HotkeyOverlay
        open={showHotkeys}
        onOpenChange={toggleHotkeys}
        groups={[
          ...AUDIO_HOTKEYS,
          {
            title: "Label Shortcuts",
            shortcuts: labels.map((label) => ({
              keys: [label.hotkey],
              action: label.name,
            })),
          },
        ]}
        tip={AUDIO_HOTKEY_TIP}
      />

      {showBatchProcessor && (
        <AudioBatchProcessor
          open={showBatchProcessor}
          files={files}
          annotations={optimisticAnnotations}
          onOpenChange={(open) => {
            if (!open) toggleBatchProcessor();
          }}
        />
      )}
    </div>
  );
}
