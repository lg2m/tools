import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import * as React from "react";

import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <React.Fragment>
      <HeadContent />
      <div className="font-sans antialiased">
        <ThemeProvider defaultTheme="system" storageKey="ui-theme">
          <TooltipProvider>
            <main>
              <Outlet />
            </main>
          </TooltipProvider>
        </ThemeProvider>
        <TanStackRouterDevtools position="bottom-right" />
      </div>
      <Scripts />
    </React.Fragment>
  );
}
