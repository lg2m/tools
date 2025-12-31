import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { Annotation, AudioFile, Label } from "@/lib/audio/types";
import type { AnnotatorStore, Selection } from "./types";

const initialState = {
  // Files
  files: [],
  currentFileIndex: 0,

  // Playback
  isPlaying: false,
  currentTime: 0,

  // View
  zoom: 1,
  panOffset: 0,
  viewMode: "waveform" as const,

  // Annotations
  labels: [
    { id: "1", name: "Speech", color: "#3b82f6", hotkey: "1" },
    { id: "2", name: "Noise", color: "#f59e0b", hotkey: "2" },
    { id: "3", name: "Silence", color: "#6366f1", hotkey: "3" },
  ],
  annotations: [],
  lastUsedLabelId: "1",
  pendingSelection: null,
  selectedAnnotationId: null,

  // UI
  mode: "annotate" as const,
  leftSidebarOpen: true,
  rightSidebarOpen: true,
  showHotkeys: false,
  showBatchProcessor: false,
};

export const useAnnotatorStore = create<AnnotatorStore>()(
  immer((set) => ({
    ...initialState,

    // Files
    addFiles: (files: AudioFile[]) =>
      set((state) => {
        state.files.push(...files);
      }),

    removeFile: (fileId: string) =>
      set((state) => {
        const index = state.files.findIndex((f: AudioFile) => f.id === fileId);
        if (index !== -1) {
          state.files.splice(index, 1);
          // Adjust current index if needed
          if (state.currentFileIndex >= state.files.length) {
            state.currentFileIndex = Math.max(0, state.files.length - 1);
          }
        }
      }),

    patchFile: (fileId: string, patch: Partial<AudioFile>) =>
      set((state) => {
        const file = state.files.find((f: AudioFile) => f.id === fileId);
        if (file) {
          Object.assign(file, patch);
        }
      }),

    selectFile: (index: number) =>
      set((state) => {
        state.currentFileIndex = index;
        state.currentTime = 0;
        state.isPlaying = false;
        state.pendingSelection = null;
        state.selectedAnnotationId = null;
      }),

    // Playback
    setPlaying: (playing: boolean) =>
      set((state) => {
        state.isPlaying = playing;
      }),

    setCurrentTime: (time: number) =>
      set((state) => {
        state.currentTime = time;
      }),

    resetPlayback: () =>
      set((state) => {
        state.isPlaying = false;
        state.currentTime = 0;
      }),

    // View
    setZoom: (zoom: number) =>
      set((state) => {
        state.zoom = zoom;
      }),

    setPanOffset: (offset: number) =>
      set((state) => {
        state.panOffset = offset;
      }),

    setViewMode: (mode: "waveform" | "spectrogram" | "both") =>
      set((state) => {
        state.viewMode = mode;
      }),

    // Annotations
    addAnnotation: (annotation: Annotation) =>
      set((state) => {
        state.annotations.push(annotation);
      }),

    removeAnnotation: (id: string) =>
      set((state) => {
        const index = state.annotations.findIndex((a: Annotation) => a.id === id);
        if (index !== -1) {
          state.annotations.splice(index, 1);
        }
      }),

    updateAnnotation: (id: string, updates: Partial<Annotation>) =>
      set((state) => {
        const annotation = state.annotations.find((a: Annotation) => a.id === id);
        if (annotation) {
          Object.assign(annotation, updates);
        }
      }),

    setSelectedAnnotation: (id: string | null) =>
      set((state) => {
        state.selectedAnnotationId = id;
      }),

    setPendingSelection: (selection: Selection | null) =>
      set((state) => {
        state.pendingSelection = selection;
      }),

    // Labels
    addLabel: (label: Label) =>
      set((state) => {
        state.labels.push(label);
      }),

    removeLabel: (id: string) =>
      set((state) => {
        const index = state.labels.findIndex((l: Label) => l.id === id);
        if (index !== -1) {
          state.labels.splice(index, 1);
        }
      }),

    updateLabel: (id: string, updates: Partial<Label>) =>
      set((state) => {
        const label = state.labels.find((l: Label) => l.id === id);
        if (label) {
          Object.assign(label, updates);
        }
      }),

    setLastUsedLabel: (id: string) =>
      set((state) => {
        state.lastUsedLabelId = id;
      }),

    // UI
    setMode: (mode: "annotate" | "trim") =>
      set((state) => {
        state.mode = mode;
      }),

    toggleLeftSidebar: () =>
      set((state) => {
        state.leftSidebarOpen = !state.leftSidebarOpen;
      }),

    toggleRightSidebar: () =>
      set((state) => {
        state.rightSidebarOpen = !state.rightSidebarOpen;
      }),

    toggleHotkeys: () =>
      set((state) => {
        state.showHotkeys = !state.showHotkeys;
      }),

    toggleBatchProcessor: () =>
      set((state) => {
        state.showBatchProcessor = !state.showBatchProcessor;
      }),
  })),
);
