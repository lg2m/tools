import { createFileRoute } from "@tanstack/react-router";

import { AudioEditor } from "@/components/audio/audio-editor";

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
  return <AudioEditor />;
}
