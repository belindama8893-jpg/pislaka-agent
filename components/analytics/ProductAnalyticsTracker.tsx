"use client";

import { useEffect, useRef } from "react";
import { trackProductEvent } from "@/lib/analytics/browser";

type ProductAnalyticsTrackerProps = {
  eventName: "home_page_view" | "workspace_view";
  metadata?: Record<string, unknown>;
};

export function ProductAnalyticsTracker({ eventName, metadata }: ProductAnalyticsTrackerProps) {
  const hasTracked = useRef(false);

  useEffect(() => {
    if (hasTracked.current) {
      return;
    }

    hasTracked.current = true;
    trackProductEvent({ eventName, metadata });
  }, [eventName, metadata]);

  return null;
}
