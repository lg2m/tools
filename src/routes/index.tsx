import { createFileRoute, Link } from '@tanstack/react-router';
import { AudioWaveform } from 'lucide-react';

export const Route = createFileRoute('/')({
  component: RouteComponent,
});

const tools = [
  {
    name: 'Audio Tools',
    description: 'Convert, downsample, trim, and process audio files in bulk',
    href: '/audio',
    icon: AudioWaveform,
    features: [
      'Format conversion',
      'Sample rate adjustment',
      'Batch trimming',
      'Bulk processing',
    ],
  },
];

function RouteComponent() {
  return (
    <>
      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-4 py-16 md:py-24">
          <div className="max-w-2xl">
            <p className="mb-4 font-mono text-sm text-muted-foreground">
              Open source • Client-side only
            </p>
            <h1 className="mb-4 text-balance text-4xl font-bold tracking-tight md:text-5xl">
              tools
            </h1>
            <p className="mb-8 text-lg text-muted-foreground">
              Daily utilities for processing audio, vision, and sensor data.
              Built for personal use (or you) to handle large-scale dataset
              transformations locally.
            </p>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="mb-2 font-mono text-sm text-muted-foreground">
            Available Tools
          </h2>
          <div className="grid gap-4">
            {tools.map((tool) => (
              <Link
                key={tool.href}
                to={tool.href}
                className="group flex flex-col gap-4 rounded-lg border border-border bg-card p-6 transition-colors hover:border-muted-foreground/50 md:flex-row md:items-center md:justify-between"
              >
                <div className="flex items-start gap-4">
                  <div className="rounded-md border border-border bg-secondary p-3">
                    <tool.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="mb-1 text-lg font-medium">{tool.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {tool.description}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 md:justify-end">
                  {tool.features.map((feature) => (
                    <span
                      key={feature}
                      className="rounded-full border border-border bg-secondary px-3 py-1 font-mono text-xs text-muted-foreground"
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
