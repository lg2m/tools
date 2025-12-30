import { X } from "lucide-react";

import type { Label } from "@/lib/audio/types";

interface HotkeyOverlayProps {
  onClose: () => void;
  labels: Label[];
}

export function HotkeyOverlay({ onClose, labels }: HotkeyOverlayProps) {
  const shortcuts = [
    { key: "Space / K", action: "Play/Pause" },
    { key: "J", action: "Skip backward 5s" },
    { key: "L", action: "Skip forward 5s" },
    { key: ",", action: "Previous file" },
    { key: ".", action: "Next file" },
    { key: "Ctrl/Cmd+B", action: "Batch Operations" },
    { key: "Scroll", action: "Zoom in/out" },
    { key: "Middle-drag", action: "Pan timeline" },
    { key: "Click-drag", action: "Select region" },
    { key: "/", action: "Toggle hotkeys" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-lg border border-border bg-card p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Keyboard Shortcuts</h2>
            <p className="text-xs text-muted-foreground">Shortcuts for a lightning-fast workflow</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <h3 className="mb-3 text-[10px] font-medium tracking-wider text-muted-foreground">PLAYBACK & NAVIGATION</h3>
            <div className="space-y-2">
              {shortcuts.map((shortcut) => (
                <div key={shortcut.key} className="flex items-center justify-between rounded bg-muted px-3 py-2">
                  <span className="text-sm text-foreground">{shortcut.action}</span>
                  <kbd className="rounded bg-background px-2 py-1 font-mono text-xs text-foreground">
                    {shortcut.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-[10px] font-medium tracking-wider text-muted-foreground">LABEL SHORTCUTS</h3>
            <div className="space-y-2">
              {labels.map((label) => (
                <div key={label.id} className="flex items-center justify-between rounded bg-muted px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded" style={{ backgroundColor: label.color }} />
                    <span className="text-sm text-foreground">{label.name}</span>
                  </div>
                  <kbd className="rounded bg-background px-2 py-1 font-mono text-xs text-foreground">
                    {label.hotkey}
                  </kbd>
                </div>
              ))}
            </div>
            {labels.length === 0 && <p className="text-sm text-muted-foreground">No labels configured yet</p>}
          </div>
        </div>

        <div className="mt-6 rounded border border-border bg-muted p-4">
          <p className="text-xs leading-relaxed text-muted-foreground">
            <strong className="text-foreground">Pro tip:</strong> After selecting a region on the waveform, the label
            selector will default to your last used label. Use batch operations to process hundreds of files with
            resampling, format conversion, and normalization before exporting your annotations.
          </p>
        </div>
      </div>
    </div>
  );
}
