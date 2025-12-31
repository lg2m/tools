import { createFileRoute } from "@tanstack/react-router";

import { AudioAnnotator } from "@/components/audio/annotator";

export const Route = createFileRoute("/audio")({
  component: AudioAnnotator,
  head: () => ({
    meta: [
      {
        title: "Audio Tools | tools.zmeyer.dev",
      },
    ],
  }),
});
