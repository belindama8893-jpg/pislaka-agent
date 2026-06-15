import { env, requireServerEnv } from "@/lib/env";

const visionRequestTimeoutMs = 60000;

export const maxVisionImageBytes = 8 * 1024 * 1024;

export type AgentVisionAnalysis = {
  image_type:
    | "property_listing_screenshot"
    | "property_photo"
    | "customer_chat_screenshot"
    | "map_or_location_screenshot"
    | "document_or_form"
    | "other";
  summary: string;
  extracted_text: string;
  entities: Record<string, unknown>;
  suggested_intent:
    | "create_listing_draft"
    | "create_lead"
    | "draft_lead_reply"
    | "create_schedule_event"
    | "analyze_listings"
    | "list_leads"
    | "general_reply";
  confidence: number;
  missing_information: string[];
  safety_notes: string[];
};

type AnalyzeImageInput = {
  fileName?: string;
  contentType: string;
  imageBase64: string;
  userMessage?: string;
};

function extractJsonObject(content: string) {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Vision model did not return JSON.");
  }

  return content.slice(start, end + 1);
}

function normalizeVisionAnalysis(value: unknown): AgentVisionAnalysis {
  const record = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const imageType = typeof record.image_type === "string" ? record.image_type : "other";
  const suggestedIntent = typeof record.suggested_intent === "string" ? record.suggested_intent : "general_reply";
  const parsedConfidence =
    typeof record.confidence === "number"
      ? record.confidence
      : typeof record.confidence === "string"
        ? Number(record.confidence)
        : 0;
  const rawLocation = [record.area, record.location, record.city].filter((item) => typeof item === "string").join(" ");
  const correctedCity =
    /johar town|wafaqi colony|pia housing/i.test(rawLocation) && /karachi/i.test(String(record.city ?? ""))
      ? "Lahore"
      : record.city;
  const flatEntities = {
    city: correctedCity,
    area: record.area ?? record.location,
    property_type: record.property_type ?? record.property,
    listing_type: record.listing_type,
    price: record.price,
    size: record.size,
    bedrooms: record.bedrooms,
    bathrooms: record.bathrooms,
    customer_name: record.customer_name,
    phone: record.phone,
    requirements: record.requirements ?? record.request,
    appointment_time: record.appointment_time,
    appointment_date: record.appointment_date,
    landmarks: record.landmarks,
    media_observations: record.media_observations
  };
  const entities =
    record.entities && typeof record.entities === "object" && !Array.isArray(record.entities)
      ? { ...flatEntities, ...(record.entities as Record<string, unknown>) }
      : flatEntities;

  return {
    image_type: [
      "property_listing_screenshot",
      "property_photo",
      "customer_chat_screenshot",
      "map_or_location_screenshot",
      "document_or_form",
      "other"
    ].includes(imageType)
      ? (imageType as AgentVisionAnalysis["image_type"])
      : /chat|whatsapp|screenshot/i.test(imageType)
        ? "customer_chat_screenshot"
      : "other",
    summary: typeof record.summary === "string" ? record.summary : "",
    extracted_text: typeof record.extracted_text === "string" ? record.extracted_text : "",
    entities,
    suggested_intent: [
      "create_listing_draft",
      "create_lead",
      "draft_lead_reply",
      "create_schedule_event",
      "analyze_listings",
      "list_leads",
      "general_reply"
    ].includes(suggestedIntent)
      ? (suggestedIntent as AgentVisionAnalysis["suggested_intent"])
      : "general_reply",
    confidence: Number.isFinite(parsedConfidence) ? Math.max(0, Math.min(1, parsedConfidence)) : 0,
    missing_information: Array.isArray(record.missing_information)
      ? record.missing_information.filter((item): item is string => typeof item === "string").slice(0, 12)
      : typeof record.missing === "string" && record.missing.trim()
        ? [record.missing.trim()]
      : [],
    safety_notes: Array.isArray(record.safety_notes)
      ? record.safety_notes.filter((item): item is string => typeof item === "string").slice(0, 8)
      : []
  };
}

export function formatVisionAnalysesForAgent(analyses: AgentVisionAnalysis[]) {
  if (!analyses.length) {
    return "";
  }

  const formatEntity = (analysis: AgentVisionAnalysis, key: string) => {
    const value = analysis.entities[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number") {
      return String(value);
    }
    return "";
  };
  const formatLocation = (analysis: AgentVisionAnalysis) => {
    const area = formatEntity(analysis, "area");
    const city = formatEntity(analysis, "city");
    if (area && city && area.toLowerCase().includes(city.toLowerCase())) {
      return area;
    }
    return [area, city].filter(Boolean).join(", ");
  };

  return [
    "Uploaded image evidence (internal). Use this for intent routing and draft extraction only. Do not show this block verbatim to the user. Writes, external messages, publishing, and status changes still require confirmation.",
    ...analyses.map((analysis, index) =>
      [
        `Image ${index + 1}:`,
        `- type: ${analysis.image_type}`,
        `- summary: ${analysis.summary || "No summary"}`,
        formatEntity(analysis, "requirements") ? `- customer request: ${formatEntity(analysis, "requirements")}` : "",
        formatEntity(analysis, "appointment_date") || formatEntity(analysis, "appointment_time")
          ? `- appointment: ${[formatEntity(analysis, "appointment_date"), formatEntity(analysis, "appointment_time")]
              .filter(Boolean)
              .join(" ")}`
          : "",
        formatLocation(analysis)
          ? `- location: ${formatLocation(analysis)}`
          : "",
        formatEntity(analysis, "property_type") ? `- property type: ${formatEntity(analysis, "property_type")}` : "",
        formatEntity(analysis, "listing_type") ? `- listing type: ${formatEntity(analysis, "listing_type")}` : "",
        formatEntity(analysis, "price") ? `- price: ${formatEntity(analysis, "price")}` : "",
        formatEntity(analysis, "size") ? `- size: ${formatEntity(analysis, "size")}` : "",
        formatEntity(analysis, "bedrooms") ? `- bedrooms: ${formatEntity(analysis, "bedrooms")}` : "",
        formatEntity(analysis, "bathrooms") ? `- bathrooms: ${formatEntity(analysis, "bathrooms")}` : "",
        formatEntity(analysis, "customer_name") ? `- visible customer name: ${formatEntity(analysis, "customer_name")}` : "",
        analysis.extracted_text ? `- key visible text: ${analysis.extracted_text.slice(0, 700)}` : "",
        `- suggested intent: ${analysis.suggested_intent}`,
        `- confidence: ${analysis.confidence}`,
        analysis.missing_information.length
          ? `- missing information: ${analysis.missing_information.join(", ")}`
          : "",
        analysis.safety_notes.length ? `- notes: ${analysis.safety_notes.join(", ")}` : ""
      ]
        .filter(Boolean)
        .join("\n")
    )
  ].join("\n\n");
}

export async function analyzeImageForAgent(input: AnalyzeImageInput): Promise<AgentVisionAnalysis> {
  const apiKey = requireServerEnv("aliyunBailianApiKey");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), visionRequestTimeoutMs);

  try {
    const response = await fetch(`${env.aliyunBailianBaseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: env.aliyunVisionModel,
        max_tokens: 320,
        response_format: { type: "json_object" },
        temperature: 0,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `User message: ${input.userMessage || "(none)"}\nFile: ${
                  input.fileName || "uploaded image"
                }\n\nRead this real estate image. Return ONE valid minified JSON object only, no markdown, no extra keys. Keys: image_type, summary, request, appointment_date, appointment_time, location, city, property_type, listing_type, price, size, bedrooms, bathrooms, customer_name, suggested_intent, confidence, missing. image_type one of: property_listing_screenshot, property_photo, customer_chat_screenshot, map_or_location_screenshot, document_or_form, other. suggested_intent one of: create_listing_draft, create_lead, draft_lead_reply, create_schedule_event, general_reply. If the user only asks where/what/location/address, set suggested_intent to general_reply and identify the place; do not invent a scheduling or listing action. For maps, do not guess the city unless visible or strongly implied by labels; Johar Town L Block, Wafaqi Colony, and PIA Housing Society indicate Lahore. confidence must be a number 0 to 1. Use short strings. Never say anything was saved, sent, published, or completed.`
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${input.contentType};base64,${input.imageBase64}`
                }
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: { message?: string }; message?: string } | null;
      throw new Error(payload?.error?.message ?? payload?.message ?? "Vision model request failed.");
    }

    const json = await response.json();
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new Error("Vision model returned an empty response.");
    }

    return normalizeVisionAnalysis(JSON.parse(extractJsonObject(content)));
  } finally {
    clearTimeout(timeout);
  }
}
