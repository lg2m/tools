import { Wrench } from 'lucide-react';

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-background">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-6 sm:flex-row">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Wrench className="h-4 w-4" />
          <span className="font-mono">tools</span>
          <span className="text-border">•</span>
          <span>Open source</span>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>MIT License</span>
          <span className="text-border">•</span>
          <span>100% client-side</span>
        </div>
      </div>
    </footer>
  );
}
