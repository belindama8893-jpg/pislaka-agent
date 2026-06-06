---
name: pislaka-agent-intent-router
description: Use when designing, reviewing, or changing Pislaka Agent intent routing, entity resolution, confirmation gates, lead/listing/schedule/promotion workflows, or no-fallback behavior for Pakistani real estate broker operations.
---

# Pislaka Agent Intent Router

Use this skill before changing Agent behavior in Pislaka.

## Workflow

1. Read `references/intent-rules.md` when the task touches intent classification, entity matching, action confirmation, or workflow routing.
2. Identify the primary business domain:
   - information management
   - content generation
   - analysis and decision support
   - schedule and tasks
3. Classify intent before extracting channels. `WhatsApp`, `Facebook`, `Instagram`, and `portal` are parameters, not intents.
4. Resolve entities before executing actions. Never show or mutate a latest/random record when the requested entity was not found.
5. Require confirmation for writes, status updates, schedule changes, campaign generation, external messaging, and bulk actions.
6. Add or update representative examples whenever a routing bug is fixed.

## Implementation Pointers

- Shared routing helpers live in `lib/agent/intent-router.ts`.
- LLM routing and local fallback live in `lib/agent/deepseek.ts`.
- Chat workspace routing shortcuts live in `components/agent/AgentWorkspace.tsx`.
- Product rulebook lives in `AGENT_INTENT_RULES.md`.

