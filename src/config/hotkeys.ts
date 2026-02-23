/**
 * Hotkey Configuration
 *
 * Centralized configuration for keyboard shortcuts.
 * Keys array represents alternative shortcuts (e.g., ["Space", "K"] = "Space or K").
 * Use "+" within a key for compound shortcuts (e.g., "Ctrl+B").
 */

import type { ShortcutGroup } from "@/components/hotkey-overlay";

export const AUDIO_HOTKEYS: ShortcutGroup[] = [
  {
    title: "Playback & Navigation",
    shortcuts: [
      { keys: ["Space", "K"], action: "Play/Pause" },
      { keys: ["J"], action: "Skip backward 5s" },
      { keys: ["L"], action: "Skip forward 5s" },
      { keys: [","], action: "Previous file" },
      { keys: ["."], action: "Next file" },
      { keys: ["Ctrl/Cmd+B"], action: "Batch Operations" },
      { keys: ["Scroll"], action: "Zoom in/out" },
      { keys: ["Middle-drag"], action: "Pan timeline" },
      { keys: ["Click-drag"], action: "Select region" },
      { keys: ["/"], action: "Toggle hotkeys" },
    ],
  },
];

export const AUDIO_HOTKEY_TIP =
  "After selecting a region on the waveform, the label selector will default to your last used label. Use batch operations to process hundreds of files with resampling, format conversion, and normalization before exporting your annotations.";
