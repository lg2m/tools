import { cn } from "@/lib/utils";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: RouteComponent,
});

function RouteComponent() {
  const tools = [
    { name: "audio editor", path: "/audio", active: true },
    { name: "video editor", path: "/video", active: false },
    { name: "image labeler", path: "/image", active: false },
  ];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-foreground">
      <div className="w-full max-w-xl space-y-12">

        <header className="space-y-2 border-l-2 border-primary pl-4">
          <h1 className="text-3xl font-bold lowercase tracking-tighter">tools.zmeyer.dev</h1>
          <p className="text-sm text-muted-foreground">
            open source data processing for machine learning.
            <br />
            built to solve my own problems.
          </p>
        </header>

        <nav className="space-y-4">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-2">
            Utilities
          </div>

          <div className="divide-y border-y border-border">
            {tools.map((tool) => (
              <div key={tool.name} className="group py-4">
                <Link
                  to={tool.path}
                  className={cn("flex items-center justify-between", {
                    "hover:text-primary transition-colors": tool.active,
                    "text-muted-foreground/40 cursor-help": !tool.active,
                  })}
                  disabled={!tool.active}
                >
                  <span className="text-[15px]">{tool.name}</span>
                  {!tool.active && (
                    <span className="text-[10px] uppercase border border-border px-1.5 py-0.5 rounded">
                      coming soon
                    </span>
                  )}
                </Link>
              </div>
            ))}
          </div>
        </nav>

        <footer className="pt-8 flex flex-col gap-4 text-xs">
          <div className="h-px w-12 bg-border" />
          <p className="text-muted-foreground">
            source code availabe on{" "}
            <a href="#" className="underline hover:text-foreground">github</a>
          </p>
          <p>
            back to{" "}
            <a
              href="https://zmeyer.dev"
              className="font-bold text-foreground hover:bg-foreground hover:text-background px-1 transition-colors"
            >
              zmeyer.dev
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
}
