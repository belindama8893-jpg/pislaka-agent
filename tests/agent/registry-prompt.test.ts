import { describe, expect, it } from "vitest";
import {
  formatResolutionRulesForPrompt,
  formatRoutingRulesForPrompt,
  formatSemanticRoutingRulesForPrompt,
  formatSupportedIntentsForPrompt,
  formatWorkflowRulesForPrompt,
  getPromptVisibleIntentDefinitions
} from "../../lib/agent/registry/prompt";

describe("agent registry prompt compiler", () => {
  it("exposes only LLM-routable intents", () => {
    const supportedIntents = formatSupportedIntentsForPrompt();

    expect(supportedIntents).toContain("- create_listing_draft");
    expect(supportedIntents).toContain("- create_campaign_links");
    expect(supportedIntents).toContain("- show_basic_attribution");
    expect(supportedIntents).not.toContain("- publish_listing");
  });

  it("keeps routing prompt rules sourced from registry metadata", () => {
    const prompt = formatRoutingRulesForPrompt();

    expect(prompt).toContain("Use draft_lead_reply");
    expect(prompt).toContain("Use create_campaign_links");
    expect(prompt).toContain("Use generate_social_copy");
    expect(prompt).toContain("Channel words are parameters");
    expect(prompt).toContain("Avoid this intent for: Reply to Ahmed on WhatsApp");
    expect(prompt).toContain("ordinary channel copy");
    expect(prompt).toContain("Do not use this intent for ordinary WhatsApp");
  });

  it("keeps every visible intent represented in the routing prompt", () => {
    const definitions = getPromptVisibleIntentDefinitions();
    const prompt = formatRoutingRulesForPrompt(definitions);

    definitions.forEach((definition) => {
      expect(prompt).toContain(definition.intent);
    });
  });

  it("compiles workflow execution rules from capability metadata", () => {
    const prompt = formatWorkflowRulesForPrompt();

    expect(prompt).toContain("only record message_sent when the broker says it was sent or clicks Sent");
    expect(prompt).toContain("Hot or interested maps to status qualified and urgency high");
    expect(prompt).toContain("If an entity is missing or ambiguous");
    expect(prompt).toContain("latest listing only when the broker explicitly says latest");
    expect(prompt).toContain("Any write, status update, schedule change");
    expect(prompt).toContain("Read-only list/search");
  });

  it("compiles entity resolution rules from capability metadata", () => {
    const prompt = formatResolutionRulesForPrompt();

    expect(prompt).toContain("create_campaign_links");
    expect(prompt).toContain("update_listing_draft");
    expect(prompt).toContain("general_reply");
    expect(prompt).toContain("must not use current context automatically");
    expect(prompt).toContain("WhatsApp or Facebook are parameters");
  });

  it("compiles semantic routing metadata rules without requiring a second LLM call", () => {
    const prompt = formatSemanticRoutingRulesForPrompt();

    expect(prompt).toContain("Choose exactly one supported intent");
    expect(prompt).toContain("never route from one keyword alone");
    expect(prompt).toContain("confidence from 0 to 1");
    expect(prompt).toContain("alternative_intents");
    expect(prompt).toContain("missing_slots");
    expect(prompt).toContain("is_follow_up_to_workflow");
    expect(prompt).toContain("Do not require a separate classification call");
  });
});
