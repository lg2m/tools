import { useState } from "react";

import { Keyboard } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface Hotkey {
  keys: string[];
  description: string;
  category?: string;
}

interface HotkeysDisplayProps {
  hotkeys: Hotkey[];
  className?: string;
}

function KeyCap({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
      {children}
    </kbd>
  );
}

export function HotkeysDisplay({ hotkeys, className }: HotkeysDisplayProps) {
  const [open, setOpen] = useState(false);

  // Group by category
  const grouped = hotkeys.reduce(
    (acc, hotkey) => {
      const category = hotkey.category || "General";
      if (!acc[category]) acc[category] = [];
      acc[category].push(hotkey);
      return acc;
    },
    {} as Record<string, Hotkey[]>,
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className={cn("h-7 gap-1.5 text-xs text-muted-foreground", className)}>
          <Keyboard className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Shortcuts</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <div className="border-b border-border px-3 py-2">
          <h4 className="text-sm font-medium">Keyboard Shortcuts</h4>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category} className="mb-3 last:mb-0">
              <p className="mb-1.5 px-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {category}
              </p>
              <div className="space-y-1">
                {items.map((hotkey, i) => (
                  <div key={i} className="flex items-center justify-between rounded px-1 py-0.5 hover:bg-muted/50">
                    <span className="text-xs text-foreground">{hotkey.description}</span>
                    <div className="flex items-center gap-0.5">
                      {hotkey.keys.map((key, j) => (
                        <KeyCap key={j}>{key}</KeyCap>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Inline version for toolbars
export function HotkeysInline({ hotkeys }: { hotkeys: Hotkey[] }) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      {hotkeys.slice(0, 5).map((hotkey, i) => (
        <div key={i} className="flex items-center gap-1">
          <span>{hotkey.description}:</span>
          <div className="flex items-center gap-0.5">
            {hotkey.keys.map((key, j) => (
              <KeyCap key={j}>{key}</KeyCap>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
