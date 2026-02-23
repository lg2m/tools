import { PostHogProvider } from "@posthog/react";
import posthog from "posthog-js";
import React from "react";
import ReactDOM from "react-dom/client";

import App from "./app";
import { registerAnalyticsContext } from "./lib/analytics";

if (import.meta.env.VITE_PUBLIC_POSTHOG_KEY) {
  posthog.init(import.meta.env.VITE_PUBLIC_POSTHOG_KEY, {
    api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
    capture_pageview: false,
    defaults: "2026-01-30",
  });

  registerAnalyticsContext();
}

const rootEl = document.getElementById("root");
if (rootEl) {
  const root = ReactDOM.createRoot(rootEl);
  root.render(
    <React.StrictMode>
      <PostHogProvider client={posthog}>
        <App />
      </PostHogProvider>
    </React.StrictMode>,
  );
}
