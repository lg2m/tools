import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Kbd, KbdGroup } from "@/components/ui/kbd";

export interface Shortcut {
  keys: string[];
  action: string;
}

export interface ShortcutGroup {
  title: string;
  shortcuts: Shortcut[];
}

interface HotkeyOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: ShortcutGroup[];
  tip?: string;
}

function ShortcutItem({ action, keys }: { action: string; keys: string[] }) {
  return (
    <div className="flex items-center justify-between rounded bg-muted px-3 py-2">
      <span className="text-sm text-foreground">{action}</span>
      <KbdGroup>
        {keys.map((key) => (
          <Kbd key={key} className="bg-background">
            {key}
          </Kbd>
        ))}
      </KbdGroup>
    </div>
  );
}

export function HotkeyOverlay({ open, onOpenChange, groups, tip }: HotkeyOverlayProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>Shortcuts for a lightning-fast workflow</DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 sm:grid-cols-2">
          {groups.map((group) => (
            <div key={group.title}>
              <h3 className="mb-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {group.title}
              </h3>
              <div className="space-y-2">
                {group.shortcuts.length > 0 ? (
                  group.shortcuts.map((shortcut) => (
                    <ShortcutItem key={shortcut.keys.join("-")} action={shortcut.action} keys={shortcut.keys} />
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No shortcuts configured</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {tip && (
          <div className="rounded border border-border bg-muted p-4">
            <p className="text-xs leading-relaxed text-muted-foreground">
              <strong className="text-foreground">Pro tip:</strong> {tip}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
