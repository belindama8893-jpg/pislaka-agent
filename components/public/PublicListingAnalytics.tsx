"use client";

import { useEffect, useRef } from "react";
import { trackPublicListingEvent } from "@/lib/analytics/browser";

export function PublicListingAnalytics({ campaignCode }: { campaignCode: string }) {
  const hasTracked = useRef(false);

  useEffect(() => {
    if (hasTracked.current) {
      return;
    }

    hasTracked.current = true;
    trackPublicListingEvent({
      campaignCode,
      eventName: "page_view"
    });
    trackPublicListingEvent({
      campaignCode,
      eventName: "lead_form_view"
    });
  }, [campaignCode]);

  return null;
}
