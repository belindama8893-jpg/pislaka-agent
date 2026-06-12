import type { AgentResponseLanguage } from "@/lib/agent/response-language";

export type AgentPreferenceLanguage = AgentResponseLanguage;

export type AgentPreferenceDefinition = {
  id: "ui_language";
  defaultValue: AgentPreferenceLanguage | null;
  description: string;
  persistenceScope: "conversation";
  values: Record<
    AgentPreferenceLanguage,
    {
      label: string;
      explicitRequestPatterns: RegExp[];
    }
  >;
  exceptions: {
    whatsappReplyDraftFollowsCustomerLanguage: boolean;
  };
};

export const agentPreferenceConfig = {
  uiLanguage: {
    id: "ui_language",
    defaultValue: null,
    description:
      "Controls the broker-facing Agent language for natural-language responses, progress text, cards, labels, and actions.",
    persistenceScope: "conversation",
    values: {
      english: {
        label: "English",
        explicitRequestPatterns: [
          /(?:用|使用|请用|請用|以后用|之後用|回复用|跟我用|和我用|一直用)\s*(?:英文|英语|英語|English)/i,
          /\b(?:use|reply|respond|speak|communicate(?:\s+with\s+me)?)\s+(?:in\s+)?English\b/i,
          /\bEnglish\s+(?:from now on|all the time|always)\b/i
        ]
      },
      chinese: {
        label: "Chinese",
        explicitRequestPatterns: [
          /(?:用|使用|请用|請用|以后用|之後用|回复用|跟我用|和我用|一直用)\s*(?:中文|汉语|漢語|Chinese)/i,
          /\b(?:use|reply|respond|speak|communicate(?:\s+with\s+me)?)\s+(?:in\s+)?Chinese\b/i,
          /\bChinese\s+(?:from now on|all the time|always)\b/i
        ]
      },
      urdu: {
        label: "Urdu",
        explicitRequestPatterns: [
          /(?:用|使用|请用|請用|以后用|之後用|回复用|跟我用|和我用|一直用)\s*(?:乌尔都语|烏爾都語|Urdu)/i,
          /\b(?:use|reply|respond|speak|communicate(?:\s+with\s+me)?)\s+(?:in\s+)?Urdu\b/i,
          /\bUrdu\s+(?:from now on|all the time|always)\b/i
        ]
      },
      roman_urdu: {
        label: "Roman Urdu",
        explicitRequestPatterns: [
          /\b(?:use|reply|respond|speak|communicate(?:\s+with\s+me)?)\s+(?:in\s+)?(?:Roman Urdu|Romanized Urdu)\b/i,
          /\b(?:Roman Urdu|Romanized Urdu)\s+(?:from now on|all the time|always)\b/i
        ]
      }
    },
    exceptions: {
      whatsappReplyDraftFollowsCustomerLanguage: true
    }
  }
} satisfies {
  uiLanguage: AgentPreferenceDefinition;
};

export function detectExplicitUiLanguagePreference(message: string): AgentPreferenceLanguage | null {
  for (const language of Object.keys(agentPreferenceConfig.uiLanguage.values) as AgentPreferenceLanguage[]) {
    const definition = agentPreferenceConfig.uiLanguage.values[language];
    if (definition.explicitRequestPatterns.some((pattern) => pattern.test(message))) {
      return language;
    }
  }

  return agentPreferenceConfig.uiLanguage.defaultValue;
}
