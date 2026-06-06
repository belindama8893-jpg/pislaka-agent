"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ListingDraftInput } from "@/lib/listings/types";

const sampleDraft: ListingDraftInput = {
  title: "Luxurious 1 Kanal Villa in DHA Phase 6",
  description:
    "Experience premium living in this 1 Kanal designer villa located in DHA Phase 6, Lahore. Ideal for buyers looking for a ready family home with strong neighborhood demand.",
  city: "Lahore",
  location_area: "DHA Phase 6",
  property_type: "house",
  listing_type: "sale",
  price_amount: 85000000,
  price_currency: "PKR",
  area_value: 1,
  area_unit: "kanal",
  bedrooms: 5,
  bathrooms: 6,
  features: ["Modern kitchen", "Family lounge", "Secure community"],
  ai_extracted_payload: {
    source: "phase_2_static_chat_draft",
    user_prompt: "Create a listing for 1 Kanal house in DHA Phase 6, price 8.5 crore."
  },
  ai_confidence: 0.82
};

export function SaveListingButton() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function handleSave() {
    setStatus("saving");
    const response = await fetch("/api/listings/draft", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(sampleDraft)
    });

    if (!response.ok) {
      setStatus("error");
      return;
    }

    setStatus("saved");
    router.refresh();
  }

  const label = status === "saving" ? "Saving..." : status === "saved" ? "Added to library" : "Confirm & add";

  return (
    <button className="primary-button small confirm-draft-button" disabled={status === "saving"} type="button" onClick={handleSave}>
      <CheckCircle2 size={15} /> {label}
    </button>
  );
}
