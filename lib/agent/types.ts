import { z } from "zod";
import { brokerEventDraftInputSchema } from "@/lib/events/types";

export const agentMessageSchema = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string().min(1),
  brokerId: z.string().uuid().optional(),
  current_listing_id: z.string().uuid().optional(),
  context_messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string()
      })
    )
    .max(20)
    .optional()
});

export const listingDraftPayloadSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  city: z.string().optional(),
  location_area: z.string().optional(),
  property_type: z.string().optional(),
  listing_type: z.enum(["sale", "rent"]).optional(),
  price_amount: z.number().optional(),
  price_currency: z.string().optional(),
  area_value: z.number().optional(),
  area_unit: z.enum(["kanal", "marla", "sqft", "sqm"]).optional(),
  bedrooms: z.number().int().optional(),
  bathrooms: z.number().int().optional(),
  features: z.array(z.string()).optional()
});

export const agentResolutionCandidateSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  status: z.string().optional(),
  listing_title: z.string().nullable().optional(),
  listing_area: z.string().nullable().optional(),
  listing_city: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  location_area: z.string().nullable().optional(),
  property_type: z.string().nullable().optional(),
  area_value: z.number().nullable().optional(),
  area_unit: z.enum(["kanal", "marla", "sqft", "sqm"]).nullable().optional(),
  bedrooms: z.number().nullable().optional()
});

export const agentResolutionSchema = z.object({
  status: z.enum(["matched", "ambiguous", "no_match", "needs_clarification"]),
  target_type: z.enum(["lead", "listing", "schedule_event"]).optional(),
  target_id: z.string().uuid().optional(),
  matched: agentResolutionCandidateSchema.optional(),
  candidates: z.array(agentResolutionCandidateSchema).optional()
});

export const agentActionSchema = z.object({
  intent: z.enum([
    "create_listing_draft",
    "update_listing_draft",
    "publish_listing",
    "create_campaign_links",
    "list_leads",
    "draft_lead_reply",
    "create_schedule_event",
    "list_schedule_events",
    "update_lead_status",
    "show_basic_attribution",
    "general_reply"
  ]),
  requires_confirmation: z.boolean().default(true),
  response: z.string(),
  payload: z.record(z.unknown()).default({}),
  resolution: agentResolutionSchema.optional()
});

export type AgentAction = z.infer<typeof agentActionSchema>;

export const scheduleEventActionPayloadSchema = brokerEventDraftInputSchema;

export const leadOperationPayloadSchema = z.object({
  lead_id: z.string().uuid().optional(),
  lead_name: z.string().optional(),
  status: z.enum(["new", "contacted", "qualified", "closed", "lost"]).optional(),
  urgency: z.enum(["low", "normal", "high"]).optional(),
  query: z.string().optional(),
  status_filter: z.enum(["new", "contacted", "qualified", "closed", "lost", "all"]).optional(),
  channel_filter: z.string().optional()
});

export type LeadOperationPayload = z.infer<typeof leadOperationPayloadSchema>;
