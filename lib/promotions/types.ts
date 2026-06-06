import { z } from "zod";

export const promotionChannelSchema = z.enum(["whatsapp", "facebook", "instagram", "portal"]);

export const promotionCardSchema = z.object({
  channel: promotionChannelSchema,
  title: z.string().min(1),
  body: z.string().min(1),
  cta: z.string().min(1),
  image_brief: z.string().min(1),
  selected_media_id: z.string().uuid().optional(),
  campaign_code: z.string().optional(),
  landing_url: z.string().url().optional(),
  whatsapp_share_url: z.string().url().optional()
});

export const listingPromotionSchema = z.object({
  summary: z.string().min(1),
  cards: z.array(promotionCardSchema).min(1)
});

export type PromotionChannel = z.infer<typeof promotionChannelSchema>;
export type PromotionCard = z.infer<typeof promotionCardSchema>;
export type ListingPromotion = z.infer<typeof listingPromotionSchema>;
