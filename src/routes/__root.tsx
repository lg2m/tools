import { createRootRoute, Outlet, HeadContent } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import * as React from 'react';
import { Footer } from '@/components/footer';
import { MainNav } from '@/components/main-nav';
import { ThemeProvider } from '@/components/theme-provider';

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <React.Fragment>
      <HeadContent />
      <div className="font-sans antialiased flex min-h-screen flex-col">
        <ThemeProvider defaultTheme="system" storageKey="ui-theme">
          <MainNav />
          <main className="flex-1">
            <Outlet />
          </main>
          <Footer />
        </ThemeProvider>
        <TanStackRouterDevtools position="bottom-right" />
      </div>
    </React.Fragment>
  );
}
