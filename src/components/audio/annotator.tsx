import { useMemo, useOptimistic, useTransition } from "react";
import { useShallow } from "zustand/shallow";
import { useAudioPlayback, useHotkeys } from "@/hooks/audio";
import type { Annotation } from "@/lib/audio/types";
import { useAnnotatorStore } from "@/stores/audio";
import { AnnotationOverlay } from "./annotation-overlay";
import { BatchProcessor } from "./batch-processor";
import { FileManager } from "./file-manager";
import { HotkeyOverlay } from "./hotkey-overlay";
import { LabelManager } from "./label-manager";
import { MetadataPanel } from "./metadata-panel";
import { SelectionOverlay } from "./selection-overlay";
import { Sidebar } from "./sidebar";
import { SpectrogramViewer } from "./spectrogram-viewer";
import { Toolbar } from "./toolbar";
import { TransportControls } from "./transport-controls";
import { WaveformViewer } from "./waveform-viewer";

export function AudioAnnotator() {
  // Use audio playback hook
  const { audioRef, togglePlayPause, skipBackward, skipForward, playRange, previousFile, nextFile, seek } =
    useAudioPlayback();

  // Transition state for non-urgent UI updates
  const [isPending, startTransition] = useTransition();

  // Get state and actions from store
  const {
    files,
    currentFileIndex,
    isPlaying,
    currentTime,
    zoom,
    viewMode,
    labels,
    annotations,
    mode,
    pendingSelection,
    selectedAnnotationId,
    showHotkeys,
    showBatchProcessor,
    leftSidebarOpen,
    rightSidebarOpen,
    patchFile,
    setPlaying,
    setCurrentTime,
    setZoom,
    setViewMode,
    setLastUsedLabel,
    addAnnotation,
    removeAnnotation,
    updateAnnotation,
    setSelectedAnnotation,
    setPendingSelection,
    setMode,
    toggleHotkeys,
    toggleBatchProcessor,
    toggleLeftSidebar,
    toggleRightSidebar,
  } = useAnnotatorStore(
    useShallow((s) => ({
      files: s.files,
      currentFileIndex: s.currentFileIndex,
      isPlaying: s.isPlaying,
      currentTime: s.currentTime,
      zoom: s.zoom,
      viewMode: s.viewMode,
      labels: s.labels,
      annotations: s.annotations,
      mode: s.mode,
      pendingSelection: s.pendingSelection,
      selectedAnnotationId: s.selectedAnnotationId,
      showHotkeys: s.showHotkeys,
      showBatchProcessor: s.showBatchProcessor,
      leftSidebarOpen: s.leftSidebarOpen,
      rightSidebarOpen: s.rightSidebarOpen,
      patchFile: s.patchFile,
      setPlaying: s.setPlaying,
      setCurrentTime: s.setCurrentTime,
      setZoom: s.setZoom,
      setViewMode: s.setViewMode,
      setLastUsedLabel: s.setLastUsedLabel,
      addAnnotation: s.addAnnotation,
      removeAnnotation: s.removeAnnotation,
      updateAnnotation: s.updateAnnotation,
      setSelectedAnnotation: s.setSelectedAnnotation,
      setPendingSelection: s.setPendingSelection,
      setMode: s.setMode,
      toggleHotkeys: s.toggleHotkeys,
      toggleBatchProcessor: s.toggleBatchProcessor,
      toggleLeftSidebar: s.toggleLeftSidebar,
      toggleRightSidebar: s.toggleRightSidebar,
    })),
  );

  // Memoize current file
  const currentFile = useMemo(() => files[currentFileIndex], [files, currentFileIndex]);

  // Optimistic annotations for instant UI feedback
  const [optimisticAnnotations, addOptimisticAnnotation] = useOptimistic(
    annotations,
    (state, newAnnotation: Annotation) => [...state, newAnnotation],
  );

  // Memoize filtered annotations for selected annotation
  const currentAnnotations = useMemo(
    () => optimisticAnnotations.filter((a) => a.fileId === currentFile?.id),
    [optimisticAnnotations, currentFile?.id],
  );

  // Use hotkeys hook for global keyboard shortcuts
  useHotkeys({
    togglePlayPause,
    skipBackward,
    skipForward,
    previousFile,
    nextFile,
    playRange,
  });

  const handleAddAnnotationFromSelection = (labelId: string) => {
    if (!pendingSelection || !currentFile) return;

    const annotation: Annotation = {
      id: `${Date.now()}`,
      fileId: currentFile.id,
      labelId,
      startTime: pendingSelection.startTime,
      endTime: pendingSelection.endTime,
    };

    // Add optimistic annotation for instant UI feedback
    addOptimisticAnnotation(annotation);
    // Then update the store
    addAnnotation(annotation);
    setLastUsedLabel(labelId);
    setPendingSelection(null);
    setSelectedAnnotation(annotation.id); // Auto-select the new annotation
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

  // Wrap zoom changes in transition for smooth UI
  const handleZoomChange = (newZoom: number) => {
    startTransition(() => {
      setZoom(newZoom);
    });
  };

  // Wrap view mode changes in transition
  const handleViewModeChange = (newMode: "waveform" | "spectrogram" | "both") => {
    startTransition(() => {
      setViewMode(newMode);
    });
  };

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <Toolbar
        files={files}
        currentFileIndex={currentFileIndex}
        isPending={isPending}
        mode={mode}
        viewMode={viewMode}
        onModeChange={setMode}
        onViewModeChange={handleViewModeChange}
        onToggleBatchProcessor={toggleBatchProcessor}
        onToggleHotkeys={toggleHotkeys}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar isOpen={leftSidebarOpen} side="left" onToggle={toggleLeftSidebar}>
          <FileManager />
        </Sidebar>

        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Visualization area */}
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

            <SelectionOverlay
              mode={mode}
              pendingSelection={pendingSelection}
              labels={labels}
              onAddAnnotation={handleAddAnnotationFromSelection}
              onPlaySelection={handlePlaySelection}
              onCancelSelection={() => setPendingSelection(null)}
            />

            <AnnotationOverlay
              mode={mode}
              selectedAnnotationId={selectedAnnotationId}
              pendingSelection={pendingSelection}
              annotations={currentAnnotations}
              labels={labels}
              onChangeLabel={handleChangeAnnotationLabel}
              onPlayAnnotation={playRange}
              onDeleteAnnotation={handleDeleteAnnotation}
              onDeselectAnnotation={() => setSelectedAnnotation(null)}
            />
          </div>

          {/* Transport controls */}
          <TransportControls
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={currentFile?.duration || 0}
            onPlayPause={togglePlayPause}
            onSeek={seek}
            onPrevious={previousFile}
            onNext={nextFile}
            zoom={zoom}
            onZoomChange={handleZoomChange}
          />
        </div>

        <Sidebar isOpen={rightSidebarOpen} side="right" onToggle={toggleRightSidebar}>
          <LabelManager />
          {currentFile && <MetadataPanel file={currentFile} />}
        </Sidebar>
      </div>

      {/* Hidden audio element */}
      {currentFile && (
        <audio
          ref={audioRef}
          src={currentFile.url}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => {
            const audio = e.currentTarget;
            patchFile(currentFile.id, { duration: audio.duration });
          }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
        >
          <track kind="captions" />
        </audio>
      )}

      {/* Hotkey overlay */}
      {showHotkeys && <HotkeyOverlay onClose={() => toggleHotkeys()} labels={labels} />}

      {/* Batch processor modal */}
      {showBatchProcessor && (
        <BatchProcessor files={files} annotations={currentAnnotations} onClose={() => toggleBatchProcessor()} />
      )}
    </div>
  );
}
