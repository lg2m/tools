import type { RefObject } from "react";

import type { Annotation, AudioFile, Label } from "@/features/audio/types";
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

interface AudioAnnotatorShellProps {
  files: AudioFile[];
  currentFileIndex: number;
  currentFile?: AudioFile;
  currentAnnotations: Annotation[];
  isPending: boolean;
  mode: "annotate" | "trim";
  viewMode: "waveform" | "spectrogram" | "both";
  labels: Label[];
  pendingSelection: { startTime: number; endTime: number } | null;
  selectedAnnotationId: string | null;
  showHotkeys: boolean;
  showBatchProcessor: boolean;
  leftSidebarOpen: boolean;
  rightSidebarOpen: boolean;
  isPlaying: boolean;
  currentTime: number;
  zoom: number;
  audioRef: RefObject<HTMLAudioElement | null>;
  onModeChange: (mode: "annotate" | "trim") => void;
  onViewModeChange: (mode: "waveform" | "spectrogram" | "both") => void;
  onToggleBatchProcessor: () => void;
  onToggleHotkeys: () => void;
  onToggleLeftSidebar: () => void;
  onToggleRightSidebar: () => void;
  onAddAnnotationFromSelection: (labelId: string) => void;
  onPlaySelection: () => void;
  onCancelSelection: () => void;
  onChangeAnnotationLabel: (annotationId: string, labelId: string) => void;
  onPlayAnnotation: (startTime: number, endTime: number) => void;
  onDeleteAnnotation: (annotationId: string) => void;
  onDeselectAnnotation: () => void;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onPreviousFile: () => void;
  onNextFile: () => void;
  onZoomChange: (zoom: number) => void;
  onAudioTimeUpdate: (time: number) => void;
  onAudioLoadedMetadata: (duration: number) => void;
  onAudioPlay: () => void;
  onAudioPause: () => void;
  onAudioEnded: () => void;
}

export function AudioAnnotatorShell({
  files,
  currentFileIndex,
  currentFile,
  currentAnnotations,
  isPending,
  mode,
  viewMode,
  labels,
  pendingSelection,
  selectedAnnotationId,
  showHotkeys,
  showBatchProcessor,
  leftSidebarOpen,
  rightSidebarOpen,
  isPlaying,
  currentTime,
  zoom,
  audioRef,
  onModeChange,
  onViewModeChange,
  onToggleBatchProcessor,
  onToggleHotkeys,
  onToggleLeftSidebar,
  onToggleRightSidebar,
  onAddAnnotationFromSelection,
  onPlaySelection,
  onCancelSelection,
  onChangeAnnotationLabel,
  onPlayAnnotation,
  onDeleteAnnotation,
  onDeselectAnnotation,
  onPlayPause,
  onSeek,
  onPreviousFile,
  onNextFile,
  onZoomChange,
  onAudioTimeUpdate,
  onAudioLoadedMetadata,
  onAudioPlay,
  onAudioPause,
  onAudioEnded,
}: AudioAnnotatorShellProps) {
  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <Toolbar
        files={files}
        currentFileIndex={currentFileIndex}
        isPending={isPending}
        mode={mode}
        viewMode={viewMode}
        onModeChange={onModeChange}
        onViewModeChange={onViewModeChange}
        onToggleBatchProcessor={onToggleBatchProcessor}
        onToggleHotkeys={onToggleHotkeys}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar isOpen={leftSidebarOpen} side="left" onToggle={onToggleLeftSidebar}>
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
              onAddAnnotation={onAddAnnotationFromSelection}
              onPlaySelection={onPlaySelection}
              onCancelSelection={onCancelSelection}
            />

            <AnnotationOverlay
              mode={mode}
              selectedAnnotationId={selectedAnnotationId}
              pendingSelection={pendingSelection}
              annotations={currentAnnotations}
              labels={labels}
              onChangeLabel={onChangeAnnotationLabel}
              onPlayAnnotation={onPlayAnnotation}
              onDeleteAnnotation={onDeleteAnnotation}
              onDeselectAnnotation={onDeselectAnnotation}
            />
          </div>

          {/* Transport controls */}
          <TransportControls
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={currentFile?.duration || 0}
            onPlayPause={onPlayPause}
            onSeek={onSeek}
            onPrevious={onPreviousFile}
            onNext={onNextFile}
            zoom={zoom}
            onZoomChange={onZoomChange}
          />
        </div>

        <Sidebar isOpen={rightSidebarOpen} side="right" onToggle={onToggleRightSidebar}>
          <LabelManager />
          {currentFile && <MetadataPanel file={currentFile} />}
        </Sidebar>
      </div>

      {/* Hidden audio element */}
      {currentFile && (
        <audio
          ref={audioRef}
          src={currentFile.url}
          onTimeUpdate={(event) => onAudioTimeUpdate(event.currentTarget.currentTime)}
          onLoadedMetadata={(event) => onAudioLoadedMetadata(event.currentTarget.duration)}
          onPlay={onAudioPlay}
          onPause={onAudioPause}
          onEnded={onAudioEnded}
        >
          <track kind="captions" />
        </audio>
      )}

      {/* Hotkey overlay */}
      {showHotkeys && <HotkeyOverlay onClose={onToggleHotkeys} labels={labels} />}

      {/* Batch processor modal */}
      {showBatchProcessor && (
        <BatchProcessor files={files} annotations={currentAnnotations} onClose={onToggleBatchProcessor} />
      )}
    </div>
  );
}
