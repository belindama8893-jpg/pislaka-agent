import type { AgentAction } from "@/lib/agent/types";

export type AgentIntentDomain =
  | "information_management"
  | "content_generation"
  | "analysis"
  | "schedule_tasks"
  | "general";

export type AgentIntentEntity = "lead" | "listing" | "schedule_event";

export type AgentIntentConfirmation = "never" | "always" | "conditional";

export type AgentIntentChannel =
  | "whatsapp"
  | "facebook"
  | "instagram"
  | "portal"
  | "manual"
  | "in_app";

export type AgentIntentUiCard =
  | "listing_draft"
  | "listing_update"
  | "promotion_pack"
  | "lead_create"
  | "lead_list"
  | "lead_reply"
  | "lead_followup"
  | "lead_update"
  | "schedule_event"
  | "schedule_list"
  | "attribution_summary"
  | "message";

export type AgentIntentAuditPolicy =
  | "none"
  | "trace_only"
  | "trace_and_confirm"
  | "trace_confirm_and_write";

export type AgentIntentDefinition = {
  intent: AgentAction["intent"];
  domain: AgentIntentDomain;
  requiredEntities: AgentIntentEntity[];
  confirmation: AgentIntentConfirmation;
  supportedChannels: AgentIntentChannel[];
  uiCard: AgentIntentUiCard;
  audit: AgentIntentAuditPolicy;
};

export const agentIntentRegistry = {
  create_listing_draft: {
    intent: "create_listing_draft",
    domain: "information_management",
    requiredEntities: [],
    confirmation: "never",
    supportedChannels: ["in_app"],
    uiCard: "listing_draft",
    audit: "trace_only"
  },
  create_lead: {
    intent: "create_lead",
    domain: "information_management",
    requiredEntities: [],
    confirmation: "always",
    supportedChannels: ["manual", "whatsapp", "facebook", "instagram", "portal"],
    uiCard: "lead_create",
    audit: "trace_confirm_and_write"
  },
  update_listing_draft: {
    intent: "update_listing_draft",
    domain: "information_management",
    requiredEntities: ["listing"],
    confirmation: "always",
    supportedChannels: ["in_app"],
    uiCard: "listing_update",
    audit: "trace_confirm_and_write"
  },
  publish_listing: {
    intent: "publish_listing",
    domain: "information_management",
    requiredEntities: ["listing"],
    confirmation: "always",
    supportedChannels: ["in_app"],
    uiCard: "listing_update",
    audit: "trace_confirm_and_write"
  },
  generate_social_copy: {
    intent: "generate_social_copy",
    domain: "content_generation",
    requiredEntities: [],
    confirmation: "never",
    supportedChannels: ["whatsapp", "facebook", "instagram", "portal"],
    uiCard: "promotion_pack",
    audit: "trace_only"
  },
  create_campaign_links: {
    intent: "create_campaign_links",
    domain: "content_generation",
    requiredEntities: ["listing"],
    confirmation: "always",
    supportedChannels: ["whatsapp", "facebook", "instagram", "portal"],
    uiCard: "promotion_pack",
    audit: "trace_confirm_and_write"
  },
  list_today_followups: {
    intent: "list_today_followups",
    domain: "information_management",
    requiredEntities: [],
    confirmation: "never",
    supportedChannels: ["in_app"],
    uiCard: "lead_list",
    audit: "trace_only"
  },
  record_lead_followup: {
    intent: "record_lead_followup",
    domain: "information_management",
    requiredEntities: ["lead"],
    confirmation: "conditional",
    supportedChannels: ["manual", "whatsapp", "facebook", "instagram", "portal"],
    uiCard: "lead_followup",
    audit: "trace_confirm_and_write"
  },
  create_followup_from_chat: {
    intent: "create_followup_from_chat",
    domain: "information_management",
    requiredEntities: ["lead"],
    confirmation: "always",
    supportedChannels: ["whatsapp"],
    uiCard: "lead_followup",
    audit: "trace_confirm_and_write"
  },
  list_leads: {
    intent: "list_leads",
    domain: "information_management",
    requiredEntities: [],
    confirmation: "never",
    supportedChannels: ["in_app"],
    uiCard: "lead_list",
    audit: "trace_only"
  },
  draft_lead_reply: {
    intent: "draft_lead_reply",
    domain: "content_generation",
    requiredEntities: ["lead"],
    confirmation: "never",
    supportedChannels: ["whatsapp", "manual"],
    uiCard: "lead_reply",
    audit: "trace_only"
  },
  create_schedule_event: {
    intent: "create_schedule_event",
    domain: "schedule_tasks",
    requiredEntities: [],
    confirmation: "always",
    supportedChannels: ["in_app"],
    uiCard: "schedule_event",
    audit: "trace_confirm_and_write"
  },
  list_schedule_events: {
    intent: "list_schedule_events",
    domain: "schedule_tasks",
    requiredEntities: [],
    confirmation: "never",
    supportedChannels: ["in_app"],
    uiCard: "schedule_list",
    audit: "trace_only"
  },
  update_lead_status: {
    intent: "update_lead_status",
    domain: "information_management",
    requiredEntities: ["lead"],
    confirmation: "always",
    supportedChannels: ["in_app"],
    uiCard: "lead_update",
    audit: "trace_confirm_and_write"
  },
  update_lead_details: {
    intent: "update_lead_details",
    domain: "information_management",
    requiredEntities: ["lead"],
    confirmation: "always",
    supportedChannels: ["in_app"],
    uiCard: "lead_update",
    audit: "trace_confirm_and_write"
  },
  update_lead_listing: {
    intent: "update_lead_listing",
    domain: "information_management",
    requiredEntities: ["lead", "listing"],
    confirmation: "always",
    supportedChannels: ["in_app"],
    uiCard: "lead_update",
    audit: "trace_confirm_and_write"
  },
  show_basic_attribution: {
    intent: "show_basic_attribution",
    domain: "analysis",
    requiredEntities: [],
    confirmation: "never",
    supportedChannels: ["in_app"],
    uiCard: "attribution_summary",
    audit: "trace_only"
  },
  general_reply: {
    intent: "general_reply",
    domain: "general",
    requiredEntities: [],
    confirmation: "never",
    supportedChannels: ["in_app"],
    uiCard: "message",
    audit: "none"
  }
} satisfies Record<AgentAction["intent"], AgentIntentDefinition>;

export function getAgentIntentDefinition(intent: AgentAction["intent"]) {
  return agentIntentRegistry[intent];
}
