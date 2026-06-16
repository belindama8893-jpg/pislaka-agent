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

export function formatWorkflowRulesForPrompt(definitions: AgentIntentDefinition[] = getPromptVisibleIntentDefinitions()) {
  const configuredRules = definitions.flatMap((definition) =>
    (definition.prompt?.workflowRules ?? []).map((rule) => `- ${rule}`)
  );
  const riskRules = [
    "- Never claim a listing, lead, schedule item, campaign, message, document, or external post is saved, published, shared, sent, or completed unless a backend tool result confirms it.",
    "- Any write, status update, schedule change, campaign generation, external message/open, export/share, or bulk action must require explicit confirmation.",
    "- Read-only list/search, draft content shown inside chat, analytics summaries, and preview cards can run without confirmation."
  ];

  return [...configuredRules, ...riskRules].join("\n");
}
