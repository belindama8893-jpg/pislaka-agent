import { describe, expect, it } from "vitest";
import {
  formatRoutingRulesForPrompt,
  formatSupportedIntentsForPrompt,
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
    expect(prompt).toContain("Channel words are parameters");
    expect(prompt).toContain("Avoid this intent for: Reply to Ahmed on WhatsApp");
  });

  it("keeps every visible intent represented in the routing prompt", () => {
    const definitions = getPromptVisibleIntentDefinitions();
    const prompt = formatRoutingRulesForPrompt(definitions);

    definitions.forEach((definition) => {
      expect(prompt).toContain(definition.intent);
    });
  });
});
