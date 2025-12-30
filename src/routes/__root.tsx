import * as React from "react";

import { createRootRoute, Outlet, HeadContent, Scripts } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import { ThemeProvider } from "@/components/theme-provider";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <React.Fragment>
      <HeadContent />
      <div className="font-sans antialiased">
        <ThemeProvider defaultTheme="system" storageKey="ui-theme">
          <main>
            <Outlet />
          </main>
        </ThemeProvider>
        <TanStackRouterDevtools position="bottom-right" />
      </div>
      <Scripts />
    </React.Fragment>
  );
}
