import type { BrokerEventDraftInput } from "@/lib/events/types";
import { getAgentActionPolicy } from "@/lib/agent/confirmation-policy";
import { getAgentIntentDefinition } from "@/lib/agent/registry/intents";
import type {
  AgentAction,
  LeadCreatePayload,
  LeadDetailsUpdatePayload,
  LeadListingUpdatePayload,
  LeadOperationPayload,
  ListingUpdatePayload,
  ScheduleEventListPayload
} from "@/lib/agent/types";
import type { ListingPromotion } from "@/lib/promotions/types";

export type AgentActionResponseHandler = (
  action: AgentAction,
  sourceMessage: string
) => boolean | Promise<boolean>;

export type AgentActionResponseHandlers = Partial<Record<AgentAction["intent"], AgentActionResponseHandler>>;

type AgentActionResponseHandlerSpec = {
  createHandler: (dependencies: AgentActionResponseHandlerDependencies) => AgentActionResponseHandler;
  intent: AgentAction["intent"];
};

export type AgentActionResponseHandlerManifestItem = {
  audit: ReturnType<typeof getAgentActionPolicy>["audit"];
  confirmation: ReturnType<typeof getAgentActionPolicy>["confirmation"];
  intent: AgentAction["intent"];
  requiresAuthForWrite: boolean;
  requiresConfirmation: boolean;
  risk: ReturnType<typeof getAgentActionPolicy>["risk"];
  uiCard: ReturnType<typeof getAgentActionPolicy>["uiCard"];
};

export type AgentActionResponseHandlerDependencies = {
  appendAssistantMessage: (message: { content: string; promotion?: ListingPromotion }) => void;
  draftReplyForLead: (
    response: string,
    payload: LeadOperationPayload,
    resolution: AgentAction["resolution"]
  ) => Promise<void>;
  looksLikeExternalChannelPromotion: (sourceMessage: string) => boolean;
  proposeLeadCreate: (payload: LeadCreatePayload) => void;
  proposeLeadDetailsUpdate: (
    response: string,
    payload: LeadDetailsUpdatePayload,
    resolution: AgentAction["resolution"]
  ) => void;
  proposeLeadFollowUpRecord: (
    response: string,
    payload: LeadOperationPayload,
    resolution: AgentAction["resolution"]
  ) => void;
  proposeLeadListingUpdate: (
    response: string,
    payload: LeadListingUpdatePayload,
    resolution: AgentAction["resolution"]
  ) => void;
  proposeLeadStatusUpdate: (
    response: string,
    payload: LeadOperationPayload,
    resolution: AgentAction["resolution"]
  ) => void;
  proposeListingUpdateFromMessage: (
    response: string,
    sourceMessage: string,
    payload: ListingUpdatePayload,
    resolution: AgentAction["resolution"]
  ) => void;
  proposePromotionFromMessage: (
    sourceMessage: string,
    resolution: AgentAction["resolution"]
  ) => void | Promise<void>;
  showGeneratedSocialCopy: (
    response: string,
    promotion: ListingPromotion | undefined,
    sourceMessage: string
  ) => void | Promise<void>;
  showAnalyticsSummary: (
    response: string,
    payload: Record<string, unknown> | undefined,
    sourceMessage: string
  ) => Promise<void>;
  showLeadResults: (response: string, payload: LeadOperationPayload, sourceMessage: string) => void;
  showScheduleResolutionMessage: (
    response: string,
    payload: BrokerEventDraftInput,
    resolution: AgentAction["resolution"]
  ) => boolean;
  showScheduleResults: (
    response: string,
    payload: ScheduleEventListPayload,
    sourceMessage: string
  ) => Promise<void>;
  showTodayFollowUps: (response: string) => Promise<void>;
};

const agentActionResponseHandlerSpecs: AgentActionResponseHandlerSpec[] = [
  {
    intent: "create_lead",
    createHandler: (dependencies) => (action) => {
      dependencies.proposeLeadCreate(action.payload as LeadCreatePayload);
      return true;
    }
  },
  {
    intent: "list_leads",
    createHandler: (dependencies) => (action, sourceMessage) => {
      const leadPayload = action.payload as LeadOperationPayload | undefined;
      if (!leadPayload) {
        return false;
      }

      dependencies.showLeadResults(action.response, leadPayload, sourceMessage);
      return true;
    }
  },
  {
    intent: "list_today_followups",
    createHandler: (dependencies) => async (action) => {
      await dependencies.showTodayFollowUps(action.response);
      return true;
    }
  },
  {
    intent: "list_schedule_events",
    createHandler: (dependencies) => async (action, sourceMessage) => {
      await dependencies.showScheduleResults(
        action.response,
        action.payload as ScheduleEventListPayload,
        sourceMessage
      );
      return true;
    }
  },
  {
    intent: "show_basic_attribution",
    createHandler: (dependencies) => async (action, sourceMessage) => {
      await dependencies.showAnalyticsSummary(action.response, action.payload, sourceMessage);
      return true;
    }
  },
  {
    intent: "update_lead_status",
    createHandler: (dependencies) => (action) => {
      const leadPayload = action.payload as LeadOperationPayload | undefined;
      if (!leadPayload) {
        return false;
      }

      dependencies.proposeLeadStatusUpdate(action.response, leadPayload, action.resolution);
      return true;
    }
  },
  {
    intent: "record_lead_followup",
    createHandler: (dependencies) => (action) => {
      const leadPayload = action.payload as LeadOperationPayload | undefined;
      if (!leadPayload) {
        return false;
      }

      dependencies.proposeLeadFollowUpRecord(action.response, leadPayload, action.resolution);
      return true;
    }
  },
  {
    intent: "update_lead_details",
    createHandler: (dependencies) => (action) => {
      dependencies.proposeLeadDetailsUpdate(
        action.response,
        action.payload as LeadDetailsUpdatePayload,
        action.resolution
      );
      return true;
    }
  },
  {
    intent: "update_lead_listing",
    createHandler: (dependencies) => (action) => {
      dependencies.proposeLeadListingUpdate(
        action.response,
        action.payload as LeadListingUpdatePayload,
        action.resolution
      );
      return true;
    }
  },
  {
    intent: "draft_lead_reply",
    createHandler: (dependencies) => async (action) => {
      const leadPayload = action.payload as LeadOperationPayload | undefined;
      if (!leadPayload) {
        return false;
      }

      await dependencies.draftReplyForLead(action.response, leadPayload, action.resolution);
      return true;
    }
  },
  {
    intent: "generate_social_copy",
    createHandler: (dependencies) => async (action, sourceMessage) => {
      const socialCopyPayload = action.payload as { promotion?: ListingPromotion };
      await dependencies.showGeneratedSocialCopy(action.response, socialCopyPayload.promotion, sourceMessage);
      return true;
    }
  },
  {
    intent: "create_campaign_links",
    createHandler: (dependencies) => async (action, sourceMessage) => {
      await dependencies.proposePromotionFromMessage(sourceMessage, action.resolution);
      return true;
    }
  },
  {
    intent: "publish_listing",
    createHandler: (dependencies) => async (action, sourceMessage) => {
      if (!dependencies.looksLikeExternalChannelPromotion(sourceMessage)) {
        return false;
      }

      await dependencies.proposePromotionFromMessage(sourceMessage, action.resolution);
      return true;
    }
  },
  {
    intent: "update_listing_draft",
    createHandler: (dependencies) => (action, sourceMessage) => {
      dependencies.proposeListingUpdateFromMessage(
        action.response,
        sourceMessage,
        action.payload as ListingUpdatePayload,
        action.resolution
      );
      return true;
    }
  },
  {
    intent: "create_schedule_event",
    createHandler: (dependencies) => (action) =>
      dependencies.showScheduleResolutionMessage(
        action.response,
        action.payload as BrokerEventDraftInput,
        action.resolution
      )
  }
];

export function getAgentActionResponseHandlerManifest(): AgentActionResponseHandlerManifestItem[] {
  return agentActionResponseHandlerSpecs.map(({ intent }) => {
    const policy = getAgentActionPolicy({ intent, payload: {} });
    const definition = getAgentIntentDefinition(intent);

    return {
      intent,
      audit: policy.audit,
      confirmation: policy.confirmation,
      requiresAuthForWrite: policy.requiresAuthForWrite,
      requiresConfirmation: policy.requiresConfirmation,
      risk: policy.risk,
      uiCard: definition.uiCard
    };
  });
}

export function createAgentActionResponseHandlers(
  dependencies: AgentActionResponseHandlerDependencies
): AgentActionResponseHandlers {
  return Object.fromEntries(
    agentActionResponseHandlerSpecs.map((spec) => [spec.intent, spec.createHandler(dependencies)])
  ) as AgentActionResponseHandlers;
}

export async function handleAgentActionResponse(
  handlers: AgentActionResponseHandlers,
  action: AgentAction,
  sourceMessage: string
) {
  const handler = handlers[action.intent];
  return handler ? await handler(action, sourceMessage) : false;
}
