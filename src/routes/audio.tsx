import { createFileRoute } from "@tanstack/react-router";

import { AudioEditor } from "@/components/audio/audio-editor";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/audio")({
  component: AudioAnnotatorComponent,
  head: () => ({
    meta: [
      ...seo({
        title: "Audio Editor | tools.zmeyer.dev",
        description: "Audio data processing tools, client-side only.",
      }),
    ],
  }),
});

export function AudioAnnotatorComponent() {
  return <AudioEditor />;
}
