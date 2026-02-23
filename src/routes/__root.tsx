import { createRootRoute, HeadContent, Outlet, Scripts, useLocation } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import * as React from "react";

import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { trackEvent } from "@/lib/analytics";
import { seo } from "@/lib/seo";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      ...seo({
        title: "tools.zmeyer.dev",
        description: "Open-source data processing tools built for machine learning at scale.",
      }),
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  const location = useLocation();

  React.useEffect(() => {
    trackEvent("$pageview", {
      path: location.pathname,
      search: location.searchStr,
    });
  }, [location.pathname, location.searchStr]);

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
