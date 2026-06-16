import { getAgentIntentDefinitions, type AgentIntentDefinition } from "@/lib/agent/registry/intents";

export function getPromptVisibleIntentDefinitions() {
  return getAgentIntentDefinitions().filter((definition) => definition.routing.exposeToLlm !== false);
}

export function formatSupportedIntentsForPrompt(definitions: AgentIntentDefinition[] = getPromptVisibleIntentDefinitions()) {
  return definitions.map((definition) => `- ${definition.intent}`).join("\n");
}

function formatIntentRule(definition: AgentIntentDefinition) {
  const baseRule =
    definition.routing.promptRule ??
    `Use ${definition.intent} for examples like: ${definition.input.examples.join("; ")}.`;
  const channelNote =
    definition.routing.channelBehavior === "parameter"
      ? "Channel words are parameters for this workflow, not separate intents."
      : "Channel words should not force this workflow.";
  const confirmationNote =
    definition.confirmation === "never"
      ? "No confirmation is needed for this read/draft action."
      : "Confirmation is required before any persistent or external action.";
  const negativeExamples = definition.routing.negativeExamples?.length
    ? ` Avoid this intent for: ${definition.routing.negativeExamples.join("; ")}.`
    : "";

  return `- ${baseRule} ${channelNote} ${confirmationNote}${negativeExamples}`;
}

export function formatRoutingRulesForPrompt(definitions: AgentIntentDefinition[] = getPromptVisibleIntentDefinitions()) {
  return definitions.map(formatIntentRule).join("\n");
}
