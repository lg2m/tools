/**
 * Audio Annotator Types
 *
 * Core type definitions for the audio annotation feature including
 * file metadata, labels, annotations, and store state/actions.
 */

// ============================================================================
// Core Domain Types
// ============================================================================

export interface AudioFile {
  id: string;
  name: string;
  url: string;
  duration: number;
  format: string;
  sampleRate: number;
  channels: number;
  bitDepth: number;
  trimStart?: number;
  trimEnd?: number;
}

export interface Label {
  id: string;
  name: string;
  color: string;
  hotkey: string;
}

export interface Annotation {
  id: string;
  fileId: string;
  labelId: string;
  startTime: number;
  endTime: number;
}

export interface Selection {
  startTime: number;
  endTime: number;
}

// ============================================================================
// Domain Store Types
// ============================================================================

export interface AudioDomainState {
  // Files
  files: AudioFile[];
  currentFileIndex: number;

  // Playback
  isPlaying: boolean;
  currentTime: number;

  // Annotations
  labels: Label[];
  annotations: Annotation[];
  lastUsedLabelId: string;
  pendingSelection: Selection | null;
  selectedAnnotationId: string | null;
}

export interface AudioDomainActions {
  // Files
  addFiles: (files: AudioFile[]) => void;
  removeFile: (fileId: string) => void;
  patchFile: (fileId: string, patch: Partial<AudioFile>) => void;
  selectFile: (index: number) => void;

  // Playback
  setPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  resetPlayback: () => void;

  // Annotations
  addAnnotation: (annotation: Annotation) => void;
  removeAnnotation: (id: string) => void;
  updateAnnotation: (id: string, updates: Partial<Annotation>) => void;
  setSelectedAnnotation: (id: string | null) => void;
  setPendingSelection: (selection: Selection | null) => void;

  // Labels
  addLabel: (label: Label) => void;
  removeLabel: (id: string) => void;
  updateLabel: (id: string, updates: Partial<Label>) => void;
  setLastUsedLabel: (id: string) => void;
}

export type AudioDomainStore = AudioDomainState & AudioDomainActions;

// ============================================================================
// UI Store Types
// ============================================================================

export interface AudioUiState {
  // View
  zoom: number;
  panOffset: number;
  viewMode: "waveform" | "spectrogram" | "both";

  // UI
  mode: "annotate" | "trim";
  leftSidebarOpen: boolean;
  rightSidebarOpen: boolean;
  showHotkeys: boolean;
  showBatchProcessor: boolean;
}

export interface AudioUiActions {
  // View
  setZoom: (zoom: number) => void;
  setPanOffset: (offset: number) => void;
  setViewMode: (mode: "waveform" | "spectrogram" | "both") => void;

  // UI
  setMode: (mode: "annotate" | "trim") => void;
  toggleLeftSidebar: () => void;
  toggleRightSidebar: () => void;
  toggleHotkeys: (open?: boolean) => void;
  toggleBatchProcessor: () => void;
}

export type AudioUiStore = AudioUiState & AudioUiActions;

// ============================================================================
// Waveform Drawing Types
// ============================================================================

export interface DrawContext {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
}

export interface TimeRange {
  start: number;
  end: number;
}

export interface ViewState {
  zoom: number;
  panOffset: number;
  duration: number;
}
