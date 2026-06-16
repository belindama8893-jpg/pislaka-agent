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

export type AgentIntentRisk = "read" | "draft" | "write" | "external";

export type AgentIntentChannelBehavior = "parameter" | "not_supported";

export type AgentCapabilityAvailability = {
  guest: boolean;
  broker: boolean;
  requiresAuthForWrite: boolean;
};

export type AgentCapabilityInput = {
  requiredSlots: string[];
  optionalSlots: string[];
  examples: string[];
};

export type AgentCapabilityRouting = {
  priority: number;
  triggerPhrases: string[];
  negativeExamples?: string[];
  channelBehavior: AgentIntentChannelBehavior;
  exposeToLlm?: boolean;
  promptRule?: string;
};

export type AgentCapabilityPolicy = {
  risk: AgentIntentRisk;
};

export type AgentCapabilityResolution = {
  allowCurrentContext: boolean;
  allowLatestOnlyWhenExplicit: boolean;
};

export type AgentCapabilityUi = {
  emptyStateLabel?: string;
  actionLabel?: string;
  placeholder?: string;
  starterPrompt?: string;
};

export type AgentCapabilityGuidance = {
  proactiveTriggers: string[];
  nextSteps: AgentAction["intent"][];
  completionPrompt?: string;
};

export type AgentIntentDefinition = {
  intent: AgentAction["intent"];
  domain: AgentIntentDomain;
  requiredEntities: AgentIntentEntity[];
  confirmation: AgentIntentConfirmation;
  supportedChannels: AgentIntentChannel[];
  uiCard: AgentIntentUiCard;
  audit: AgentIntentAuditPolicy;
  availability: AgentCapabilityAvailability;
  input: AgentCapabilityInput;
  routing: AgentCapabilityRouting;
  policy: AgentCapabilityPolicy;
  resolution: AgentCapabilityResolution;
  ui: AgentCapabilityUi;
  guidance: AgentCapabilityGuidance;
};

export const agentIntentRegistry = {
  create_listing_draft: {
    intent: "create_listing_draft",
    domain: "information_management",
    requiredEntities: [],
    confirmation: "never",
    supportedChannels: ["in_app"],
    uiCard: "listing_draft",
    audit: "trace_only",
    availability: { guest: true, broker: true, requiresAuthForWrite: true },
    input: {
      requiredSlots: [],
      optionalSlots: ["city", "location_area", "property_type", "price_amount", "area_value", "media"],
      examples: ["Create a 10 marla villa in DHA Phase 5", "Draft a rental apartment listing from these photos"]
    },
    routing: {
      priority: 70,
      triggerPhrases: ["create listing", "draft listing", "property for sale", "property for rent"],
      channelBehavior: "not_supported",
      promptRule:
        "Use create_listing_draft when the broker gives property facts or asks to create a listing. If details are incomplete, still return a draft with known fields and mention what is missing."
    },
    policy: { risk: "draft" },
    resolution: { allowCurrentContext: false, allowLatestOnlyWhenExplicit: false },
    ui: {
      emptyStateLabel: "List from Link",
      actionLabel: "Create listing",
      placeholder: "Paste a listing link, photos, or property details...",
      starterPrompt:
        "I can help you create a property listing in seconds. Send me a property link, photos, details, or just tell me what you want to list."
    },
    guidance: {
      proactiveTriggers: ["broker_has_no_listings", "empty_workspace"],
      nextSteps: ["create_campaign_links"],
      completionPrompt: "The listing draft is ready. Save it first, then I can create promotion links."
    }
  },
  create_lead: {
    intent: "create_lead",
    domain: "information_management",
    requiredEntities: [],
    confirmation: "always",
    supportedChannels: ["manual", "whatsapp", "facebook", "instagram", "portal"],
    uiCard: "lead_create",
    audit: "trace_confirm_and_write",
    availability: { guest: true, broker: true, requiresAuthForWrite: true },
    input: {
      requiredSlots: [],
      optionalSlots: ["full_name", "phone", "email", "message", "source_channel", "listing_id"],
      examples: ["Add Ahmed as a buyer lead", "Save this WhatsApp chat as a new lead"]
    },
    routing: {
      priority: 65,
      triggerPhrases: ["add lead", "create customer", "save buyer", "record inquiry"],
      channelBehavior: "parameter",
      promptRule:
        "Use create_lead when the broker asks to add, create, record, or save a lead/customer/buyer."
    },
    policy: { risk: "write" },
    resolution: { allowCurrentContext: true, allowLatestOnlyWhenExplicit: false },
    ui: {
      emptyStateLabel: "Import WhatsApp Leads",
      actionLabel: "Add lead",
      placeholder: "Paste a WhatsApp chat or customer details to create a lead...",
      starterPrompt:
        "I can turn chats or messy customer lists into organized leads. Paste a WhatsApp chat, upload a screenshot/list, or just tell me about your customers."
    },
    guidance: {
      proactiveTriggers: ["broker_has_no_leads", "new_chat_without_saved_lead"],
      nextSteps: ["draft_lead_reply", "create_schedule_event"]
    }
  },
  update_listing_draft: {
    intent: "update_listing_draft",
    domain: "information_management",
    requiredEntities: ["listing"],
    confirmation: "always",
    supportedChannels: ["in_app"],
    uiCard: "listing_update",
    audit: "trace_confirm_and_write",
    availability: { guest: false, broker: true, requiresAuthForWrite: true },
    input: {
      requiredSlots: ["listing_target", "changed_fields"],
      optionalSlots: ["price_amount", "features", "status", "media"],
      examples: ["Change this listing price to 1.2 crore", "Add swimming pool to my DHA 6 house"]
    },
    routing: {
      priority: 75,
      triggerPhrases: ["change listing", "update property", "edit this listing"],
      channelBehavior: "not_supported",
      promptRule:
        "Use update_listing_draft when the broker asks to change, edit, update, or correct an existing listing or this/current listing. Only include fields the broker explicitly changed."
    },
    policy: { risk: "write" },
    resolution: { allowCurrentContext: true, allowLatestOnlyWhenExplicit: true },
    ui: {
      actionLabel: "Edit listing",
      placeholder: "Tell me what to change on this listing..."
    },
    guidance: {
      proactiveTriggers: ["listing_selected"],
      nextSteps: ["create_campaign_links"]
    }
  },
  publish_listing: {
    intent: "publish_listing",
    domain: "information_management",
    requiredEntities: ["listing"],
    confirmation: "always",
    supportedChannels: ["in_app"],
    uiCard: "listing_update",
    audit: "trace_confirm_and_write",
    availability: { guest: false, broker: true, requiresAuthForWrite: true },
    input: {
      requiredSlots: ["listing_target"],
      optionalSlots: [],
      examples: ["Publish this listing", "Make this property live"]
    },
    routing: {
      priority: 80,
      triggerPhrases: ["publish listing", "make listing live"],
      channelBehavior: "not_supported",
      exposeToLlm: false,
      promptRule: "Do not return publish_listing from LLM routing. External publishing must route through confirmed promotion workflows."
    },
    policy: { risk: "write" },
    resolution: { allowCurrentContext: true, allowLatestOnlyWhenExplicit: true },
    ui: { actionLabel: "Publish listing" },
    guidance: {
      proactiveTriggers: ["saved_listing_is_draft"],
      nextSteps: ["create_campaign_links"]
    }
  },
  generate_social_copy: {
    intent: "generate_social_copy",
    domain: "content_generation",
    requiredEntities: [],
    confirmation: "never",
    supportedChannels: ["whatsapp", "facebook", "instagram", "portal"],
    uiCard: "promotion_pack",
    audit: "trace_only",
    availability: { guest: true, broker: true, requiresAuthForWrite: false },
    input: {
      requiredSlots: [],
      optionalSlots: ["channel", "listing_facts", "media", "tone"],
      examples: ["Write Facebook copy for this villa", "Make WhatsApp copy from these photos"]
    },
    routing: {
      priority: 68,
      triggerPhrases: ["write copy", "caption", "post text", "social copy"],
      channelBehavior: "parameter",
      promptRule:
        "Use generate_social_copy when the broker asks only to write social media copy, captions, post text, or channel-specific wording. This can use broker text, uploaded image evidence, or recent context and does not require a saved listing."
    },
    policy: { risk: "draft" },
    resolution: { allowCurrentContext: true, allowLatestOnlyWhenExplicit: true },
    ui: {
      actionLabel: "Write copy",
      placeholder: "Tell me the channel and property facts for the post copy..."
    },
    guidance: {
      proactiveTriggers: ["listing_selected", "media_uploaded_without_instruction"],
      nextSteps: ["create_campaign_links"]
    }
  },
  create_campaign_links: {
    intent: "create_campaign_links",
    domain: "content_generation",
    requiredEntities: ["listing"],
    confirmation: "always",
    supportedChannels: ["whatsapp", "facebook", "instagram", "portal"],
    uiCard: "promotion_pack",
    audit: "trace_confirm_and_write",
    availability: { guest: true, broker: true, requiresAuthForWrite: true },
    input: {
      requiredSlots: ["listing_target"],
      optionalSlots: ["channels", "audience", "tone"],
      examples: ["Promote my DHA 5 villa on WhatsApp and Facebook", "Create campaign links for this listing"]
    },
    routing: {
      priority: 85,
      triggerPhrases: ["promote", "campaign links", "share listing", "advertise"],
      negativeExamples: ["Reply to Ahmed on WhatsApp"],
      channelBehavior: "parameter",
      promptRule:
        "Use create_campaign_links when the broker asks for trackable links, lead pages, campaign links, sharing links, attribution, or to promote/share/post/publish/send a saved/current listing to WhatsApp, Facebook, Instagram, portals, Zameen, OLX, or another external channel. Pislaka generates channel copy and trackable lead-page links; it does not silently publish externally."
    },
    policy: { risk: "external" },
    resolution: { allowCurrentContext: true, allowLatestOnlyWhenExplicit: true },
    ui: {
      emptyStateLabel: "Create Promo Post",
      actionLabel: "Promote listing",
      placeholder: "Choose a property and channel, for example WhatsApp or Facebook...",
      starterPrompt:
        "I can help you promote a property on WhatsApp or Facebook. Send me a listing link, photos, details, or tell me what kind of buyers you want to attract."
    },
    guidance: {
      proactiveTriggers: ["listing_created_not_promoted", "broker_has_listings"],
      nextSteps: ["list_leads", "show_basic_attribution"]
    }
  },
  list_today_followups: {
    intent: "list_today_followups",
    domain: "information_management",
    requiredEntities: [],
    confirmation: "never",
    supportedChannels: ["in_app"],
    uiCard: "lead_list",
    audit: "trace_only",
    availability: { guest: false, broker: true, requiresAuthForWrite: false },
    input: {
      requiredSlots: [],
      optionalSlots: ["date"],
      examples: ["Who should I follow up today?", "follow up"]
    },
    routing: {
      priority: 90,
      triggerPhrases: ["follow up", "today followups", "clients need reply"],
      channelBehavior: "not_supported",
      promptRule:
        "Use list_today_followups when the broker asks specifically who to follow up today, today's follow-ups, or simply says follow up as a standalone request."
    },
    policy: { risk: "read" },
    resolution: { allowCurrentContext: false, allowLatestOnlyWhenExplicit: false },
    ui: {
      emptyStateLabel: "Today's Follow-ups",
      actionLabel: "Check follow-ups",
      placeholder: "Ask who to follow up today, or paste a recent customer chat...",
      starterPrompt:
        "I can help you decide who to follow up with today. Send recent chats, a lead list, screenshots, or just tell me who you have been talking to."
    },
    guidance: {
      proactiveTriggers: ["today_followups_due", "overdue_followups"],
      nextSteps: ["draft_lead_reply", "record_lead_followup", "create_schedule_event"]
    }
  },
  record_lead_followup: {
    intent: "record_lead_followup",
    domain: "information_management",
    requiredEntities: ["lead"],
    confirmation: "conditional",
    supportedChannels: ["manual", "whatsapp", "facebook", "instagram", "portal"],
    uiCard: "lead_followup",
    audit: "trace_confirm_and_write",
    availability: { guest: false, broker: true, requiresAuthForWrite: true },
    input: {
      requiredSlots: ["lead_target", "followup_summary"],
      optionalSlots: ["activity_type", "status", "urgency", "next_follow_up_at"],
      examples: ["I sent message to Ahmed", "Ahmed is interested, remind me tomorrow"]
    },
    routing: {
      priority: 78,
      triggerPhrases: ["sent message", "customer is interested", "not interested", "save follow-up"],
      channelBehavior: "parameter",
      promptRule:
        "Use record_lead_followup when the broker says they sent a message, contacted a lead, the lead is interested/hot, or the lead is not interested."
    },
    policy: { risk: "write" },
    resolution: { allowCurrentContext: true, allowLatestOnlyWhenExplicit: false },
    ui: {
      actionLabel: "Record follow-up",
      placeholder: "Tell me what happened with this customer..."
    },
    guidance: {
      proactiveTriggers: ["reply_drafted", "lead_selected"],
      nextSteps: ["create_schedule_event", "update_lead_status"]
    }
  },
  create_followup_from_chat: {
    intent: "create_followup_from_chat",
    domain: "information_management",
    requiredEntities: ["lead"],
    confirmation: "always",
    supportedChannels: ["whatsapp"],
    uiCard: "lead_followup",
    audit: "trace_confirm_and_write",
    availability: { guest: false, broker: true, requiresAuthForWrite: true },
    input: {
      requiredSlots: ["lead_target", "chat_summary"],
      optionalSlots: ["next_follow_up_at", "status", "urgency"],
      examples: ["Save this WhatsApp chat as follow-up", "Record this chat on Ahmed"]
    },
    routing: {
      priority: 82,
      triggerPhrases: ["save this chat", "record whatsapp chat", "chat follow-up"],
      channelBehavior: "parameter",
      promptRule:
        "Use create_followup_from_chat when the broker explicitly asks to save, record, or attach a WhatsApp chat as follow-up history for a matched lead."
    },
    policy: { risk: "write" },
    resolution: { allowCurrentContext: true, allowLatestOnlyWhenExplicit: false },
    ui: {
      actionLabel: "Save chat follow-up",
      placeholder: "Paste WhatsApp chat or drop a .txt/.zip export..."
    },
    guidance: {
      proactiveTriggers: ["whatsapp_chat_imported"],
      nextSteps: ["draft_lead_reply", "create_schedule_event", "update_lead_status"]
    }
  },
  list_leads: {
    intent: "list_leads",
    domain: "information_management",
    requiredEntities: [],
    confirmation: "never",
    supportedChannels: ["in_app"],
    uiCard: "lead_list",
    audit: "trace_only",
    availability: { guest: false, broker: true, requiresAuthForWrite: false },
    input: {
      requiredSlots: [],
      optionalSlots: ["status_filter", "channel_filter", "listing_target"],
      examples: ["Show my hot leads", "List new buyers from Facebook"]
    },
    routing: {
      priority: 55,
      triggerPhrases: ["show leads", "list buyers", "hot leads", "new customers"],
      channelBehavior: "parameter",
      promptRule:
        "Use list_leads when the broker asks who/which leads/customers/buyers to follow up, new leads, hot leads, or today's leads without specifically asking for today's follow-up queue."
    },
    policy: { risk: "read" },
    resolution: { allowCurrentContext: true, allowLatestOnlyWhenExplicit: false },
    ui: {
      actionLabel: "Show leads",
      placeholder: "Ask for hot leads, new leads, or leads from a channel..."
    },
    guidance: {
      proactiveTriggers: ["broker_has_leads"],
      nextSteps: ["draft_lead_reply", "list_today_followups"]
    }
  },
  draft_lead_reply: {
    intent: "draft_lead_reply",
    domain: "content_generation",
    requiredEntities: ["lead"],
    confirmation: "never",
    supportedChannels: ["whatsapp", "manual"],
    uiCard: "lead_reply",
    audit: "trace_only",
    availability: { guest: false, broker: true, requiresAuthForWrite: false },
    input: {
      requiredSlots: ["lead_target"],
      optionalSlots: ["channel", "tone", "latest_chat"],
      examples: ["Reply to Ahmed on WhatsApp", "Draft a reply for this buyer"]
    },
    routing: {
      priority: 88,
      triggerPhrases: ["reply to", "respond to", "message back", "draft reply"],
      negativeExamples: ["Promote this listing on WhatsApp"],
      channelBehavior: "parameter",
      promptRule:
        "Use draft_lead_reply when the broker asks to reply, respond, message back, or draft a WhatsApp/manual reply to a lead/customer/buyer."
    },
    policy: { risk: "draft" },
    resolution: { allowCurrentContext: true, allowLatestOnlyWhenExplicit: false },
    ui: {
      actionLabel: "Draft reply",
      placeholder: "Ask me to draft a reply for the selected lead..."
    },
    guidance: {
      proactiveTriggers: ["lead_needs_reply", "lead_selected", "whatsapp_chat_imported"],
      nextSteps: ["record_lead_followup", "create_schedule_event"]
    }
  },
  create_schedule_event: {
    intent: "create_schedule_event",
    domain: "schedule_tasks",
    requiredEntities: [],
    confirmation: "always",
    supportedChannels: ["in_app"],
    uiCard: "schedule_event",
    audit: "trace_confirm_and_write",
    availability: { guest: false, broker: true, requiresAuthForWrite: true },
    input: {
      requiredSlots: ["time_or_date", "event_purpose"],
      optionalSlots: ["lead_target", "listing_target", "location_text", "reminder_at"],
      examples: ["Schedule viewing with Ahmed tomorrow 3pm", "Remind me to call Sara next week"]
    },
    routing: {
      priority: 80,
      triggerPhrases: ["schedule", "viewing", "appointment", "remind me"],
      channelBehavior: "not_supported",
      promptRule:
        "Use create_schedule_event when the broker asks to schedule a viewing, appointment, reminder, callback, signing, handover, deadline, or recurring review."
    },
    policy: { risk: "write" },
    resolution: { allowCurrentContext: true, allowLatestOnlyWhenExplicit: false },
    ui: {
      actionLabel: "Schedule task",
      placeholder: "Tell me who, what, and when to schedule..."
    },
    guidance: {
      proactiveTriggers: ["lead_has_viewing_signal", "reply_drafted", "lead_selected"],
      nextSteps: ["list_schedule_events", "record_lead_followup"]
    }
  },
  list_schedule_events: {
    intent: "list_schedule_events",
    domain: "schedule_tasks",
    requiredEntities: [],
    confirmation: "never",
    supportedChannels: ["in_app"],
    uiCard: "schedule_list",
    audit: "trace_only",
    availability: { guest: false, broker: true, requiresAuthForWrite: false },
    input: {
      requiredSlots: [],
      optionalSlots: ["date_filter", "event_type", "status"],
      examples: ["What do I have today?", "Show tomorrow's viewings"]
    },
    routing: {
      priority: 60,
      triggerPhrases: ["what do I have today", "show schedule", "today appointments"],
      channelBehavior: "not_supported",
      promptRule:
        "Use list_schedule_events when the broker asks to view, check, or list schedule items, appointments, reminders, or agenda items."
    },
    policy: { risk: "read" },
    resolution: { allowCurrentContext: false, allowLatestOnlyWhenExplicit: false },
    ui: {
      actionLabel: "Check schedule",
      placeholder: "Ask what viewings or reminders you have today..."
    },
    guidance: {
      proactiveTriggers: ["today_schedule_due"],
      nextSteps: ["record_lead_followup", "draft_lead_reply"]
    }
  },
  update_lead_status: {
    intent: "update_lead_status",
    domain: "information_management",
    requiredEntities: ["lead"],
    confirmation: "always",
    supportedChannels: ["in_app"],
    uiCard: "lead_update",
    audit: "trace_confirm_and_write",
    availability: { guest: false, broker: true, requiresAuthForWrite: true },
    input: {
      requiredSlots: ["lead_target", "status"],
      optionalSlots: ["urgency", "summary"],
      examples: ["Mark Ahmed as hot lead", "Set Sara to lost"]
    },
    routing: {
      priority: 83,
      triggerPhrases: ["mark lead", "update status", "hot lead", "lost lead"],
      channelBehavior: "not_supported",
      promptRule:
        "Use update_lead_status when the broker asks to mark, change, or update a lead status. Hot or interested maps to qualified/high; not interested maps to lost."
    },
    policy: { risk: "write" },
    resolution: { allowCurrentContext: true, allowLatestOnlyWhenExplicit: false },
    ui: {
      actionLabel: "Update status",
      placeholder: "Tell me the lead and the new status..."
    },
    guidance: {
      proactiveTriggers: ["strong_status_signal_from_chat"],
      nextSteps: ["record_lead_followup", "create_schedule_event"]
    }
  },
  update_lead_details: {
    intent: "update_lead_details",
    domain: "information_management",
    requiredEntities: ["lead"],
    confirmation: "always",
    supportedChannels: ["in_app"],
    uiCard: "lead_update",
    audit: "trace_confirm_and_write",
    availability: { guest: false, broker: true, requiresAuthForWrite: true },
    input: {
      requiredSlots: ["lead_target", "changed_fields"],
      optionalSlots: ["full_name", "phone", "email", "message"],
      examples: ["Change Ahmed phone to 03001234567", "Update this buyer email"]
    },
    routing: {
      priority: 74,
      triggerPhrases: ["change lead phone", "update customer", "edit buyer"],
      channelBehavior: "not_supported",
      promptRule:
        "Use update_lead_details when the broker asks to edit a lead's phone, email, name, or message."
    },
    policy: { risk: "write" },
    resolution: { allowCurrentContext: true, allowLatestOnlyWhenExplicit: false },
    ui: {
      actionLabel: "Edit lead",
      placeholder: "Tell me which lead detail to change..."
    },
    guidance: {
      proactiveTriggers: ["lead_selected"],
      nextSteps: ["draft_lead_reply", "record_lead_followup"]
    }
  },
  update_lead_listing: {
    intent: "update_lead_listing",
    domain: "information_management",
    requiredEntities: ["lead", "listing"],
    confirmation: "always",
    supportedChannels: ["in_app"],
    uiCard: "lead_update",
    audit: "trace_confirm_and_write",
    availability: { guest: false, broker: true, requiresAuthForWrite: true },
    input: {
      requiredSlots: ["lead_target", "listing_target"],
      optionalSlots: [],
      examples: ["Attach Ahmed to the DHA Phase 6 house", "Move this buyer to this listing"]
    },
    routing: {
      priority: 76,
      triggerPhrases: ["attach lead to listing", "move buyer to property", "link customer to listing"],
      channelBehavior: "not_supported",
      promptRule:
        "Use update_lead_listing when the broker asks to link, attach, associate, move, change, or assign a lead/customer/buyer to a listing/property."
    },
    policy: { risk: "write" },
    resolution: { allowCurrentContext: true, allowLatestOnlyWhenExplicit: false },
    ui: {
      actionLabel: "Link lead",
      placeholder: "Tell me which lead and listing to connect..."
    },
    guidance: {
      proactiveTriggers: ["lead_selected", "listing_selected"],
      nextSteps: ["draft_lead_reply", "create_schedule_event"]
    }
  },
  show_basic_attribution: {
    intent: "show_basic_attribution",
    domain: "analysis",
    requiredEntities: [],
    confirmation: "never",
    supportedChannels: ["in_app"],
    uiCard: "attribution_summary",
    audit: "trace_only",
    availability: { guest: false, broker: true, requiresAuthForWrite: false },
    input: {
      requiredSlots: [],
      optionalSlots: ["range", "focus", "listing_target", "channel"],
      examples: ["Which channel brought these leads?", "Show campaign performance this week"]
    },
    routing: {
      priority: 50,
      triggerPhrases: ["analytics", "performance", "attribution", "conversion"],
      channelBehavior: "parameter",
      promptRule:
        "Use show_basic_attribution when the broker asks for analytics, statistics, performance, clicks, views, traffic, conversion rate, channel attribution, top channels, top listings, or follow-up health. This is read-only and does not require confirmation."
    },
    policy: { risk: "read" },
    resolution: { allowCurrentContext: true, allowLatestOnlyWhenExplicit: false },
    ui: {
      actionLabel: "Check performance",
      placeholder: "Ask which channels, listings, or leads are performing..."
    },
    guidance: {
      proactiveTriggers: ["campaign_links_created", "broker_has_campaign_activity"],
      nextSteps: ["list_leads", "create_campaign_links"]
    }
  },
  general_reply: {
    intent: "general_reply",
    domain: "general",
    requiredEntities: [],
    confirmation: "never",
    supportedChannels: ["in_app"],
    uiCard: "message",
    audit: "none",
    availability: { guest: true, broker: true, requiresAuthForWrite: false },
    input: {
      requiredSlots: [],
      optionalSlots: [],
      examples: ["What can you do?", "Help me decide the next step"]
    },
    routing: {
      priority: 0,
      triggerPhrases: [],
      channelBehavior: "not_supported",
      promptRule:
        "Use general_reply when the message is unclear or does not contain enough evidence for a workflow. Ask one concise follow-up question."
    },
    policy: { risk: "read" },
    resolution: { allowCurrentContext: false, allowLatestOnlyWhenExplicit: false },
    ui: {
      placeholder: "Paste a listing link, WhatsApp chat, or ask anything..."
    },
    guidance: {
      proactiveTriggers: [],
      nextSteps: []
    }
  }
} satisfies Record<AgentAction["intent"], AgentIntentDefinition>;

export function getAgentIntentDefinition(intent: AgentAction["intent"]) {
  return agentIntentRegistry[intent] as AgentIntentDefinition;
}

export function getAgentIntentDefinitions() {
  return Object.values(agentIntentRegistry) as AgentIntentDefinition[];
}
