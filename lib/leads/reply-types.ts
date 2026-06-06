import { z } from "zod";

export const leadReplyDraftSchema = z.object({
  reply_text: z.string().min(1),
  tone: z.string().min(1),
  next_step: z.string().min(1)
});

export type LeadReplyDraft = z.infer<typeof leadReplyDraftSchema>;
