import type { Annotation, AudioFile, Label } from "@/lib/audio/types";

export interface Selection {
  startTime: number;
  endTime: number;
}

export interface AnnotatorState {
  // Files
  files: AudioFile[];
  currentFileIndex: number;

  // Playback
  isPlaying: boolean;
  currentTime: number;

  // View
  zoom: number;
  panOffset: number;
  viewMode: "waveform" | "spectrogram" | "both";

  // Annotations
  labels: Label[];
  annotations: Annotation[];
  lastUsedLabelId: string;
  pendingSelection: Selection | null;
  selectedAnnotationId: string | null;

  // UI
  mode: "annotate" | "trim";
  leftSidebarOpen: boolean;
  rightSidebarOpen: boolean;
  showHotkeys: boolean;
  showBatchProcessor: boolean;
}

export interface AnnotatorActions {
  // Files
  addFiles: (files: AudioFile[]) => void;
  removeFile: (fileId: string) => void;
  patchFile: (fileId: string, patch: Partial<AudioFile>) => void;
  selectFile: (index: number) => void;

  // Playback
  setPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  resetPlayback: () => void;

  // View
  setZoom: (zoom: number) => void;
  setPanOffset: (offset: number) => void;
  setViewMode: (mode: "waveform" | "spectrogram" | "both") => void;

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

  // UI
  setMode: (mode: "annotate" | "trim") => void;
  toggleLeftSidebar: () => void;
  toggleRightSidebar: () => void;
  toggleHotkeys: () => void;
  toggleBatchProcessor: () => void;
}

export type AnnotatorStore = AnnotatorState & AnnotatorActions;
