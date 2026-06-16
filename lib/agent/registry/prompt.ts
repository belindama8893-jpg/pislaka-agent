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

export function formatResolutionRulesForPrompt(definitions: AgentIntentDefinition[] = getPromptVisibleIntentDefinitions()) {
  const currentContextIntents = definitions
    .filter((definition) => definition.resolution.allowCurrentContext)
    .map((definition) => definition.intent);
  const noCurrentContextIntents = definitions
    .filter((definition) => !definition.resolution.allowCurrentContext)
    .map((definition) => definition.intent);
  const latestOnlyWhenExplicitIntents = definitions
    .filter((definition) => definition.resolution.allowLatestOnlyWhenExplicit)
    .map((definition) => definition.intent);

  return [
    "- Resolve explicit ids, phone/email, exact names, and strong listing terms before proposing an action.",
    "- If an entity is missing or ambiguous, return a no_match, needs_clarification, or ambiguous resolution rather than using a latest/random record.",
    currentContextIntents.length
      ? `- These intents may use attached/current context only when the broker explicitly says this/current/selected/attached/just confirmed or an entity is selected: ${currentContextIntents.join(", ")}.`
      : "",
    noCurrentContextIntents.length
      ? `- These intents must not use current context automatically: ${noCurrentContextIntents.join(", ")}.`
      : "",
    latestOnlyWhenExplicitIntents.length
      ? `- These intents may use the latest listing only when the broker explicitly says latest, most recent, newest, or equivalent: ${latestOnlyWhenExplicitIntents.join(", ")}.`
      : "",
    "- Channels such as WhatsApp or Facebook are parameters; they are never a replacement for resolving the lead or listing target."
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatWorkflowRulesForPrompt(definitions: AgentIntentDefinition[] = getPromptVisibleIntentDefinitions()) {
  const configuredRules = definitions.flatMap((definition) =>
    (definition.prompt?.workflowRules ?? []).map((rule) => `- ${rule}`)
  );
  const resolutionRules = formatResolutionRulesForPrompt(definitions).split("\n");
  const riskRules = [
    "- Never claim a listing, lead, schedule item, campaign, message, document, or external post is saved, published, shared, sent, or completed unless a backend tool result confirms it.",
    "- Any write, status update, schedule change, campaign generation, external message/open, export/share, or bulk action must require explicit confirmation.",
    "- Read-only list/search, draft content shown inside chat, analytics summaries, and preview cards can run without confirmation."
  ];

  return [...configuredRules, ...resolutionRules, ...riskRules].join("\n");
}
