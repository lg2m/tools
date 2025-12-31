import { useMemo, useOptimistic } from "react";
import { useShallow } from "zustand/shallow";

import type { Annotation } from "@/features/audio/types";
import { useAudioDomainStore } from "@/features/audio/store";

export function useAudioAnnotatorState() {
  const { files, currentFileIndex, annotations } = useAudioDomainStore(
    useShallow((s) => ({
      files: s.files,
      currentFileIndex: s.currentFileIndex,
      annotations: s.annotations,
    })),
  );

  const currentFile = useMemo(() => files[currentFileIndex], [files, currentFileIndex]);

  const [optimisticAnnotations, addOptimisticAnnotation] = useOptimistic(
    annotations,
    (state, newAnnotation: Annotation) => [...state, newAnnotation],
  );

  const currentAnnotations = useMemo(
    () => optimisticAnnotations.filter((annotation) => annotation.fileId === currentFile?.id),
    [optimisticAnnotations, currentFile?.id],
  );

  return {
    files,
    currentFileIndex,
    annotations,
    currentFile,
    currentAnnotations,
    optimisticAnnotations,
    addOptimisticAnnotation,
  };
}
