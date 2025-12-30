import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: RouteComponent,
  head: () => ({
    meta: [
      {
        title: "tools.zmeyer.dev",
      },
    ],
  }),
});

function RouteComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <div className="max-w-2xl space-y-8 text-center">
        <div className="space-y-3">
          <h1 className="font-mono text-5xl font-light tracking-tight text-foreground">tools</h1>
          <p className="font-mono text-sm text-muted-foreground">tools.zmeyer.dev</p>
        </div>

        <p className="text-lg leading-relaxed text-muted-foreground">
          Data processing and labeling for modeling.
          <br />
          Open source tooling for personal use.
        </p>

        <div className="pt-4">
          <Link
            to="/audio"
            className="inline-block rounded-lg bg-muted px-8 py-3 font-mono text-sm text-foreground transition-colors hover:bg-accent"
          >
            audio editor
          </Link>
        </div>
      </div>
    </div>
  );
}
