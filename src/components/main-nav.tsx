import { Link } from '@tanstack/react-router';

import { AudioWaveform, Github, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';

const tools = [{ name: 'Audio', href: '/audio', icon: AudioWaveform }];

export function MainNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link
            to="/"
            className="flex items-center gap-2 font-mono text-sm font-medium"
          >
            <Wrench className="h-4 w-4" />
            <span>tools</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {tools.map((tool) => (
              <Link
                key={tool.href}
                to={tool.href}
                activeProps={{
                  className: 'bg-secondary text-foreground',
                }}
                inactiveProps={{
                  className:
                    'text-muted-foreground hover:bg-secondary/50 hover:text-foreground',
                }}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors',
                )}
              >
                <tool.icon className="h-4 w-4" />
                {tool.name}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <Github className="h-4 w-4" />
            <span className="hidden sm:inline">GitHub</span>
          </a>
        </div>
      </div>
    </header>
  );
}
