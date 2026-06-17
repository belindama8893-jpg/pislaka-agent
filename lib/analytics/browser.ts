"use client";

export const PUBLIC_LISTING_EXPERIMENT_KEY = "public_listing_lead_form_v1";

const visitorCookieName = "pislaka_visitor_id";
const sessionStorageKey = "pislaka_session_id";
const experimentStoragePrefix = "pislaka_experiment_variant:";

type AnalyticsContext = {
  experiment_key: string;
  session_id: string;
  variant: string;
  visitor_id: string;
};

type TrackAnalyticsEventInput = {
  campaignCode: string;
  eventName:
    | "page_view"
    | "lead_form_view"
    | "lead_form_start"
    | "lead_submit_attempt"
    | "lead_submit_success"
    | "whatsapp_opened";
  metadata?: Record<string, unknown>;
};

type ProductEventName =
  | "home_page_view"
  | "auth_modal_opened"
  | "auth_started"
  | "auth_succeeded"
  | "workspace_view";

type TrackProductEventInput = {
  eventName: ProductEventName;
  metadata?: Record<string, unknown>;
};

function createId(prefix: string) {
  const randomId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

  return `${prefix}_${randomId}`;
}

function getCookie(name: string) {
  const match = document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${name}=`));

  return match ? decodeURIComponent(match.split("=")[1] ?? "") : null;
}

function setCookie(name: string, value: string) {
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; samesite=lax`;
}

function getVisitorId() {
  const existing = getCookie(visitorCookieName);
  if (existing) {
    return existing;
  }

  const visitorId = createId("v");
  setCookie(visitorCookieName, visitorId);
  return visitorId;
}

function getSessionId() {
  const existing = sessionStorage.getItem(sessionStorageKey);
  if (existing) {
    return existing;
  }

  const sessionId = createId("s");
  sessionStorage.setItem(sessionStorageKey, sessionId);
  return sessionId;
}

function getExperimentVariant(experimentKey: string) {
  const storageKey = `${experimentStoragePrefix}${experimentKey}`;
  const existing = localStorage.getItem(storageKey);
  if (existing) {
    return existing;
  }

  const variant = Math.random() < 0.5 ? "control" : "variant_a";
  localStorage.setItem(storageKey, variant);
  return variant;
}

export function getPublicListingAnalyticsContext(): AnalyticsContext {
  return {
    experiment_key: PUBLIC_LISTING_EXPERIMENT_KEY,
    visitor_id: getVisitorId(),
    session_id: getSessionId(),
    variant: getExperimentVariant(PUBLIC_LISTING_EXPERIMENT_KEY)
  };
}

function postAnalyticsEvent(payload: Record<string, unknown>) {
  const body = JSON.stringify(payload);

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon("/api/analytics/events", blob)) {
      return;
    }
  }

  void fetch("/api/analytics/events", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body,
    keepalive: true
  });
}

export function trackProductEvent({ eventName, metadata }: TrackProductEventInput) {
  const payload = {
    event_name: eventName,
    path: window.location.pathname,
    referrer: document.referrer || undefined,
    visitor_id: getVisitorId(),
    session_id: getSessionId(),
    metadata
  };

  postAnalyticsEvent(payload);
}

export function trackPublicListingEvent({ campaignCode, eventName, metadata }: TrackAnalyticsEventInput) {
  const context = getPublicListingAnalyticsContext();
  const payload = {
    campaign_code: campaignCode,
    event_name: eventName,
    path: window.location.pathname,
    referrer: document.referrer || undefined,
    metadata,
    ...context
  };

  postAnalyticsEvent(payload);
}
