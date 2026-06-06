import { NextResponse } from "next/server";
import { routeAgentMessage } from "@/lib/agent/deepseek";
import { agentMessageSchema } from "@/lib/agent/types";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = agentMessageSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid agent message payload", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const action = await routeAgentMessage(parsed.data.message);

    return NextResponse.json({
      action
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown agent error"
      },
      { status: 500 }
    );
  }
}
