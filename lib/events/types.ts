import { z } from "zod";

export const brokerEventCategorySchema = z.enum(["appointment", "reminder", "recurring"]);

export const brokerEventTypeSchema = z.enum([
  "viewing",
  "contract_signing",
  "handover",
  "follow_up",
  "offer_deadline",
  "document_expiry",
  "weekly_review",
  "monthly_client_review",
  "custom"
]);

export const brokerEventStatusSchema = z.enum(["scheduled", "completed", "canceled", "overdue"]);

export const brokerEventDraftInputSchema = z.object({
  event_category: brokerEventCategorySchema,
  event_type: brokerEventTypeSchema,
  title: z.string().min(1),
  description: z.string().optional(),
  start_at: z.string().datetime().optional(),
  end_at: z.string().datetime().optional(),
  reminder_at: z.string().datetime().optional(),
  recurrence_rule: z.string().optional(),
  lead_id: z.string().uuid().optional(),
  listing_id: z.string().uuid().optional(),
  lead_name: z.string().optional(),
  listing_reference: z.string().optional(),
  location_text: z.string().optional(),
  source_payload: z.record(z.unknown()).optional()
});

export const brokerEventCreateSchema = brokerEventDraftInputSchema.extend({
  status: brokerEventStatusSchema.default("scheduled")
});

export const brokerEventUpdateSchema = brokerEventCreateSchema
  .partial()
  .extend({
    id: z.string().uuid(),
    in_app_reminded_at: z.string().datetime().nullable().optional(),
    in_app_reminder_dismissed_at: z.string().datetime().nullable().optional()
  })
  .refine((value) => Object.keys(value).some((key) => key !== "id"), {
    message: "At least one event field must be provided"
  });

export type BrokerEventCategory = z.infer<typeof brokerEventCategorySchema>;
export type BrokerEventType = z.infer<typeof brokerEventTypeSchema>;
export type BrokerEventStatus = z.infer<typeof brokerEventStatusSchema>;
export type BrokerEventDraftInput = z.infer<typeof brokerEventDraftInputSchema>;
export type BrokerEventCreateInput = z.infer<typeof brokerEventCreateSchema>;
export type BrokerEventUpdateInput = z.infer<typeof brokerEventUpdateSchema>;

export type BrokerEventRecord = {
  id: string;
  broker_id: string;
  event_category: BrokerEventCategory;
  event_type: BrokerEventType;
  title: string;
  description: string | null;
  start_at: string | null;
  end_at: string | null;
  reminder_at: string | null;
  in_app_reminded_at: string | null;
  in_app_reminder_dismissed_at: string | null;
  recurrence_rule: string | null;
  status: BrokerEventStatus;
  lead_id: string | null;
  listing_id: string | null;
  lead_name: string | null;
  listing_reference: string | null;
  location_text: string | null;
  source_payload: Record<string, unknown> | null;
  created_from: "agent" | "manual" | "lead" | "listing";
  created_at: string;
  updated_at: string | null;
};
