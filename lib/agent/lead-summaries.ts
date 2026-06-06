import { env, requireServerEnv } from "@/lib/env";
import type { ListingRecord } from "@/lib/listings/types";

type LeadSummaryContext = {
  fullName: string;
  phone: string;
  message: string | null;
  channel: string | null;
  listing: ListingRecord | null;
};

const leadSummarySystemPrompt = `
You are Pislaka Agent, helping a Pakistan real estate broker triage buyer leads.
Return only JSON. Do not return markdown.

Output shape:
{
  "summary": "One short broker-facing lead summary"
}

Rules:
- Keep it under 28 words.
- Mention concrete buyer intent, budget, viewing timing, channel, or property if available.
- Do not invent facts.
- Use concise English.
`;

function extractJsonObject(content: string) {
  const trimmed = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("Lead summary response was not JSON.");
  }

  return trimmed.slice(firstBrace, lastBrace + 1);
}

function fallbackLeadSummary(context: LeadSummaryContext) {
  const buyer = context.fullName || "Buyer";
  const listing = context.listing?.title || [context.listing?.location_area, context.listing?.city].filter(Boolean).join(", ");
  const message = context.message?.split("\n").slice(0, 2).join(" ").trim();
  const channel = context.channel ? ` via ${context.channel}` : "";

  return [buyer, listing ? `asked about ${listing}` : "sent an inquiry", message ? `: ${message}` : "", channel]
    .join("")
    .slice(0, 220);
}

export async function generateLeadSummary(context: LeadSummaryContext) {
  if (!env.deepseekApiKey) {
    return fallbackLeadSummary(context);
  }

  const apiKey = requireServerEnv("deepseekApiKey");

  try {
    const response = await fetch(`${env.deepseekBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: env.deepseekModel,
        response_format: { type: "json_object" },
        temperature: 0.2,
        messages: [
          { role: "system", content: leadSummarySystemPrompt },
          {
            role: "user",
            content: JSON.stringify({
              buyer: {
                full_name: context.fullName,
                phone: context.phone,
                message: context.message,
                channel: context.channel
              },
              listing: context.listing
                ? {
                    title: context.listing.title,
                    city: context.listing.city,
                    location_area: context.listing.location_area,
                    property_type: context.listing.property_type,
                    price_amount: context.listing.price_amount,
                    price_currency: context.listing.price_currency,
                    area_value: context.listing.area_value,
                    area_unit: context.listing.area_unit,
                    bedrooms: context.listing.bedrooms,
                    bathrooms: context.listing.bathrooms
                  }
                : null
            })
          }
        ]
      })
    });

    if (!response.ok) {
      return fallbackLeadSummary(context);
    }

    const json = await response.json();
    const content = json?.choices?.[0]?.message?.content;

    if (typeof content !== "string") {
      return fallbackLeadSummary(context);
    }

    const parsed = JSON.parse(extractJsonObject(content)) as { summary?: unknown };
    const summary = typeof parsed.summary === "string" ? parsed.summary.trim() : "";

    return summary || fallbackLeadSummary(context);
  } catch {
    return fallbackLeadSummary(context);
  }
}
