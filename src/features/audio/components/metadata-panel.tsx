import { Info } from "lucide-react";

import type { AudioFile } from "@/features/audio/types";

export function MetadataPanel({ file }: { file: AudioFile }) {
  const metadata = [
    { label: "Filename", value: file.name },
    { label: "Duration", value: file.duration > 0 ? `${file.duration.toFixed(2)}s` : "Loading..." },
    { label: "Format", value: file.format || "Unknown" },
    { label: "Sample Rate", value: `${file.sampleRate} Hz` },
    { label: "Channels", value: file.channels === 2 ? "Stereo" : "Mono" },
    { label: "Bit Depth", value: `${file.bitDepth} bit` },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-3">
      <div className="mb-2 flex items-center gap-2">
        <Info className="h-3 w-3 text-muted-foreground" />
        <div className="text-[10px] font-medium tracking-wider text-muted-foreground">METADATA</div>
      </div>
      <div className="space-y-2.5">
        {metadata.map((item) => (
          <div key={item.label} className="space-y-1">
            <div className="text-[10px] font-medium text-muted-foreground">{item.label}</div>
            <div className="rounded border border-border bg-background px-2 py-1.5 font-mono text-[11px] text-muted-foreground">
              {item.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
