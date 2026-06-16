import { describe, expect, it } from "vitest";
import { agentIntentRegistry, type AgentIntentDefinition } from "../../lib/agent/registry/intents";
import type { AgentAction } from "../../lib/agent/types";

const expectedIntents = [
  "create_listing_draft",
  "create_lead",
  "update_listing_draft",
  "publish_listing",
  "generate_social_copy",
  "create_campaign_links",
  "list_today_followups",
  "record_lead_followup",
  "create_followup_from_chat",
  "list_leads",
  "draft_lead_reply",
  "create_schedule_event",
  "list_schedule_events",
  "update_lead_status",
  "update_lead_details",
  "update_lead_listing",
  "show_basic_attribution",
  "general_reply"
] satisfies AgentAction["intent"][];

describe("agentIntentRegistry", () => {
  it("defines every supported action intent", () => {
    expect(Object.keys(agentIntentRegistry).sort()).toEqual([...expectedIntents].sort());
  });

  it("keeps follow-up records on conditional confirmation", () => {
    expect(agentIntentRegistry.record_lead_followup).toMatchObject({
      requiredEntities: ["lead"],
      confirmation: "conditional",
      audit: "trace_confirm_and_write"
    });
  });

  it("keeps internal publish intent out of direct LLM routing", () => {
    expect(agentIntentRegistry.publish_listing.routing.exposeToLlm).toBe(false);
  });

  it("keeps every intent ready for configurable routing and guidance", () => {
    (Object.values(agentIntentRegistry) as AgentIntentDefinition[]).forEach((definition) => {
      expect(definition.availability).toBeDefined();
      expect(definition.input.examples.length).toBeGreaterThan(0);
      expect(definition.routing.priority).toEqual(expect.any(Number));
      expect(definition.routing.channelBehavior).toMatch(/parameter|not_supported/);
      expect(definition.policy.risk).toMatch(/read|draft|write|external/);
      expect(definition.resolution).toEqual(
        expect.objectContaining({
          allowCurrentContext: expect.any(Boolean),
          allowLatestOnlyWhenExplicit: expect.any(Boolean)
        })
      );
      expect(definition.guidance).toEqual(
        expect.objectContaining({
          proactiveTriggers: expect.any(Array),
          nextSteps: expect.any(Array)
        })
      );
      if (definition.prompt?.workflowRules) {
        expect(definition.prompt.workflowRules.length).toBeGreaterThan(0);
      }
    });
  });

  it("keeps policy risk, confirmation, and audit settings aligned", () => {
    (Object.values(agentIntentRegistry) as AgentIntentDefinition[]).forEach((definition) => {
      if (definition.policy.risk === "write" || definition.policy.risk === "external") {
        expect(definition.confirmation, definition.intent).not.toBe("never");
        expect(definition.audit, definition.intent).toBe("trace_confirm_and_write");
      }

      if (definition.policy.risk === "read" || definition.policy.risk === "draft") {
        expect(definition.audit, definition.intent).not.toBe("trace_confirm_and_write");
      }

      if (definition.availability.requiresAuthForWrite) {
        expect(["write", "external", "draft"], definition.intent).toContain(definition.policy.risk);
      }
    });
  });
});
