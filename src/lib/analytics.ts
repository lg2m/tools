import posthog from "posthog-js";

type AnalyticsProperties = Record<string, string | number | boolean | null | undefined>;

const SESSION_ID_STORAGE_KEY = "tools.analytics.session_id";
const SESSION_STARTED_STORAGE_KEY = "tools.analytics.session_started";

function getSessionId(): string {
  if (typeof window === "undefined") {
    return "server";
  }

  const existingSessionId = window.sessionStorage.getItem(SESSION_ID_STORAGE_KEY);
  if (existingSessionId) {
    return existingSessionId;
  }

  const sessionId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
  window.sessionStorage.setItem(SESSION_ID_STORAGE_KEY, sessionId);
  return sessionId;
}

export function registerAnalyticsContext() {
  if (typeof window === "undefined") {
    return;
  }

  const sessionId = getSessionId();
  const nowIso = new Date().toISOString();
  const baseProperties = {
    app_name: "tools.zmeyer.dev",
    app_version: __APP_VERSION__,
    app_environment: import.meta.env.MODE,
    runtime: "browser",
  };

  posthog.register(baseProperties);
  posthog.register_for_session({
    ...baseProperties,
    session_id: sessionId,
    session_referrer: document.referrer || "direct",
  });

  if (!window.sessionStorage.getItem(SESSION_STARTED_STORAGE_KEY)) {
    window.sessionStorage.setItem(SESSION_STARTED_STORAGE_KEY, nowIso);
    trackEvent("session_started", {
      session_id: sessionId,
      started_at: nowIso,
      path: window.location.pathname,
    });
  }
}

export function trackEvent(event: string, properties?: AnalyticsProperties) {
  if (typeof window === "undefined") {
    return;
  }

  posthog.capture(event, properties);
}
