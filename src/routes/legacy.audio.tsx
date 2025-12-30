import { createFileRoute } from "@tanstack/react-router";

import { AudioTool } from "@/components/tools/audio/audio-tool";

export const Route = createFileRoute("/legacy/audio")({
  component: AudioTool,
  head: () => ({
    meta: [
      {
        title: "Audio Tools | tools.zmeyer.dev",
      },
    ],
  }),
});
