import { z } from "zod";

export const leadRequestSchema = z.object({
  campaign_code: z.string().min(1),
  full_name: z.string().min(1),
  phone: z.string().min(3),
  email: z.string().email().optional().or(z.literal("")),
  message: z.string().max(1000).optional(),
  visitor_id: z.string().trim().min(8).max(120).optional(),
  session_id: z.string().trim().min(8).max(120).optional(),
  experiment_key: z.string().trim().max(120).optional(),
  variant: z.string().trim().max(80).optional()
});

export const manualLeadCreateSchema = z
  .object({
    listing_id: z.string().uuid().optional(),
    full_name: z.string().min(1).optional(),
    phone: z.string().min(3).optional(),
    email: z.string().email().optional().or(z.literal("")),
    message: z.string().max(1000).optional(),
    status: z.enum(["new", "contacted", "qualified", "closed", "lost"]).default("new"),
    urgency: z.enum(["low", "normal", "high"]).default("normal"),
    source_channel: z.string().default("manual")
  })
  .refine((value) => Boolean(value.full_name || value.phone || value.email), {
    message: "A lead needs at least a name, phone, or email"
  });

export const leadUpdateSchema = z
  .object({
    id: z.string().uuid(),
    listing_id: z.string().uuid().nullable().optional(),
    full_name: z.string().min(1).optional(),
    phone: z.string().min(3).optional(),
    email: z.string().email().nullable().optional(),
    message: z.string().max(1000).nullable().optional(),
    status: z.enum(["new", "contacted", "qualified", "closed", "lost"]).optional(),
    urgency: z.enum(["low", "normal", "high"]).optional(),
    next_follow_up_at: z.string().datetime().nullable().optional(),
    last_note: z.string().max(4000).nullable().optional(),
    interested_listing_id: z.string().uuid().nullable().optional(),
    interested_area: z.string().max(200).nullable().optional(),
    budget_min: z.number().nullable().optional(),
    budget_max: z.number().nullable().optional()
  })
  .strict()
  .refine((value) => Object.keys(value).some((key) => key !== "id"), {
    message: "At least one lead field must be provided"
  });
