import { NextResponse } from "next/server";
import { generateSocialCopyPromotion } from "@/lib/agent/social-copy";
import { socialCopyRequestSchema } from "@/lib/promotions/promotion-api-schemas";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = socialCopyRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid social copy payload", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const channels = parsed.data.channels ?? ["whatsapp"];
  const promotion = await generateSocialCopyPromotion(parsed.data.draft, parsed.data.instruction, channels);

  return NextResponse.json({ promotion });
}
