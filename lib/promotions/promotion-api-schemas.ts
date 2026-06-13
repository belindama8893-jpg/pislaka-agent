import { z } from "zod";
import { promotionChannelSchema } from "@/lib/promotions/types";

export const promoteListingRequestSchema = z.object({
  listing_id: z.string().uuid(),
  instruction: z.string().max(1000).optional(),
  channels: z.array(promotionChannelSchema).min(1).max(4).optional()
});
