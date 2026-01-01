import { createFileRoute } from "@tanstack/react-router";
import { useTransition } from "react";
import { useShallow } from "zustand/shallow";

import { AudioAnnotatorShell } from "@/features/audio/components/audio-annotator-shell";
import { useAudioAnnotatorState } from "@/features/audio/hooks/use-audio-annotator-state";
import { useAudioPlayback } from "@/features/audio/hooks/use-audio-playback";
import { useHotkeys } from "@/features/audio/hooks/use-hotkeys";
import { useAudioDomainStore, useAudioUiStore } from "@/features/audio/store";
import type { Annotation } from "@/features/audio/types";

export const Route = createFileRoute("/audio")({
  component: AudioAnnotatorComponent,
  head: () => ({
    meta: [
      {
        title: "Audio Tools | tools.zmeyer.dev",
      },
    ],
  }),
});

export function AudioAnnotatorComponent() {
  const { audioRef, togglePlayPause, skipBackward, skipForward, playRange, previousFile, nextFile, seek } =
    useAudioPlayback();

  const [isPending, startTransition] = useTransition();

  const { files, currentFileIndex, currentFile, currentAnnotations, addOptimisticAnnotation } =
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
      files: s.files,
      currentFileIndex: s.currentFileIndex,
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

  const handleZoomChange = (newZoom: number) => {
    startTransition(() => {
      setZoom(newZoom);
    });
  };

  const handleViewModeChange = (newMode: "waveform" | "spectrogram" | "both") => {
    startTransition(() => {
      setViewMode(newMode);
    });
  };

  return (
    <AudioAnnotatorShell
      files={files}
      currentFileIndex={currentFileIndex}
      currentFile={currentFile}
      currentAnnotations={currentAnnotations}
      isPending={isPending}
      mode={mode}
      viewMode={viewMode}
      labels={labels}
      pendingSelection={pendingSelection}
      selectedAnnotationId={selectedAnnotationId}
      showHotkeys={showHotkeys}
      showBatchProcessor={showBatchProcessor}
      leftSidebarOpen={leftSidebarOpen}
      rightSidebarOpen={rightSidebarOpen}
      isPlaying={isPlaying}
      currentTime={currentTime}
      zoom={zoom}
      audioRef={audioRef}
      onModeChange={setMode}
      onViewModeChange={handleViewModeChange}
      onToggleBatchProcessor={toggleBatchProcessor}
      onToggleHotkeys={toggleHotkeys}
      onToggleLeftSidebar={toggleLeftSidebar}
      onToggleRightSidebar={toggleRightSidebar}
      onAddAnnotationFromSelection={handleAddAnnotationFromSelection}
      onPlaySelection={handlePlaySelection}
      onCancelSelection={() => setPendingSelection(null)}
      onChangeAnnotationLabel={handleChangeAnnotationLabel}
      onPlayAnnotation={playRange}
      onDeleteAnnotation={handleDeleteAnnotation}
      onDeselectAnnotation={() => setSelectedAnnotation(null)}
      onPlayPause={togglePlayPause}
      onSeek={seek}
      onPreviousFile={previousFile}
      onNextFile={nextFile}
      onZoomChange={handleZoomChange}
      onAudioTimeUpdate={setCurrentTime}
      onAudioLoadedMetadata={(duration) => {
        if (!currentFile) return;
        patchFile(currentFile.id, { duration });
      }}
      onAudioPlay={() => setPlaying(true)}
      onAudioPause={() => setPlaying(false)}
      onAudioEnded={() => setPlaying(false)}
    />
  );
}
