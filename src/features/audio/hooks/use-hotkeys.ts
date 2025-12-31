import { useEffect } from "react";

import type { Annotation } from "@/features/audio/types";
import { useAudioDomainStore, useAudioUiStore } from "@/features/audio/store";

/**
 * Handles global keyboard shortcuts for the audio annotator.
 *
 * Hotkeys:
 * - Space/K: Toggle play/pause
 * - J: Skip backward 5s
 * - L: Skip forward 5s
 * - ,: Previous file
 * - .: Next file
 * - /: Toggle hotkey overlay
 * - Ctrl/Cmd+B: Toggle batch processor
 * - Escape: Cancel selection or deselect annotation
 * - Delete/Backspace: Delete selected annotation
 * - Enter: Play selection or annotation
 * - 1-9: Assign label to selection or set last used label
 */
export function useHotkeys(audioHandlers: {
  togglePlayPause: () => void;
  skipBackward: () => void;
  skipForward: () => void;
  previousFile: () => void;
  nextFile: () => void;
  playRange: (start: number, end: number) => void;
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const domainState = useAudioDomainStore.getState();
      const uiState = useAudioUiStore.getState();
      const {
        files,
        currentFileIndex,
        labels,
        annotations,
        pendingSelection,
        selectedAnnotationId,
        setPendingSelection,
        setSelectedAnnotation,
        removeAnnotation,
        addAnnotation,
        setLastUsedLabel,
      } = domainState;
      const { toggleHotkeys, toggleBatchProcessor, mode } = uiState;

      const currentFile = files[currentFileIndex];

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
          audioHandlers.togglePlayPause();
          break;

        case "KeyJ":
          audioHandlers.skipBackward();
          break;

        case "KeyL":
          audioHandlers.skipForward();
          break;

        case "Comma":
          audioHandlers.previousFile();
          break;

        case "Period":
          audioHandlers.nextFile();
          break;

        case "Slash":
          toggleHotkeys();
          break;

        case "KeyB":
          if (e.ctrlKey || e.metaKey) toggleBatchProcessor();
          break;

        case "Escape":
          if (pendingSelection) setPendingSelection(null);
          else if (selectedAnnotationId) setSelectedAnnotation(null);
          break;

        case "Delete":
        case "Backspace":
          if (selectedAnnotationId) {
            removeAnnotation(selectedAnnotationId);
            setSelectedAnnotation(null);
          }
          break;

        case "Enter": {
          if (mode === "trim" && currentFile.trimStart && currentFile.trimEnd) {
            audioHandlers.playRange(currentFile.trimStart, currentFile.trimEnd);
          } else if (pendingSelection) {
            audioHandlers.playRange(pendingSelection.startTime, pendingSelection.endTime);
          } else if (selectedAnnotationId) {
            const annotation = annotations.find((a) => a.id === selectedAnnotationId);
            if (annotation) {
              audioHandlers.playRange(annotation.startTime, annotation.endTime);
            }
          }
          break;
        }

        default:
          // Number keys for labels
          if (e.code.startsWith("Digit")) {
            const num = e.code.replace("Digit", "");
            const label = labels.find((l) => l.hotkey === num);
            if (!label) return;

            // If there's a pending selection, create annotation with this label
            if (pendingSelection && currentFile) {
              const annotation: Annotation = {
                id: `${Date.now()}`,
                fileId: currentFile.id,
                labelId: label.id,
                startTime: pendingSelection.startTime,
                endTime: pendingSelection.endTime,
              };

              addAnnotation(annotation);
              setLastUsedLabel(label.id);
              setPendingSelection(null);
            } else {
              setLastUsedLabel(label.id);
            }
          }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [audioHandlers]);
}
