import type { BrokerEventDraftInput } from "@/lib/events/types";
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
  proposePromotionFromMessage: (sourceMessage: string, resolution: AgentAction["resolution"]) => void;
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

export function createAgentActionResponseHandlers(
  dependencies: AgentActionResponseHandlerDependencies
): AgentActionResponseHandlers {
  return {
    create_lead: (action) => {
      dependencies.proposeLeadCreate(action.payload as LeadCreatePayload);
      return true;
    },
    list_leads: (action, sourceMessage) => {
      const leadPayload = action.payload as LeadOperationPayload | undefined;
      if (!leadPayload) {
        return false;
      }

      dependencies.showLeadResults(action.response, leadPayload, sourceMessage);
      return true;
    },
    list_today_followups: async (action) => {
      await dependencies.showTodayFollowUps(action.response);
      return true;
    },
    list_schedule_events: async (action, sourceMessage) => {
      await dependencies.showScheduleResults(
        action.response,
        action.payload as ScheduleEventListPayload,
        sourceMessage
      );
      return true;
    },
    show_basic_attribution: async (action, sourceMessage) => {
      await dependencies.showAnalyticsSummary(action.response, action.payload, sourceMessage);
      return true;
    },
    update_lead_status: (action) => {
      const leadPayload = action.payload as LeadOperationPayload | undefined;
      if (!leadPayload) {
        return false;
      }

      dependencies.proposeLeadStatusUpdate(action.response, leadPayload, action.resolution);
      return true;
    },
    record_lead_followup: (action) => {
      const leadPayload = action.payload as LeadOperationPayload | undefined;
      if (!leadPayload) {
        return false;
      }

      dependencies.proposeLeadFollowUpRecord(action.response, leadPayload, action.resolution);
      return true;
    },
    update_lead_details: (action) => {
      dependencies.proposeLeadDetailsUpdate(
        action.response,
        action.payload as LeadDetailsUpdatePayload,
        action.resolution
      );
      return true;
    },
    update_lead_listing: (action) => {
      dependencies.proposeLeadListingUpdate(
        action.response,
        action.payload as LeadListingUpdatePayload,
        action.resolution
      );
      return true;
    },
    draft_lead_reply: async (action) => {
      const leadPayload = action.payload as LeadOperationPayload | undefined;
      if (!leadPayload) {
        return false;
      }

      await dependencies.draftReplyForLead(action.response, leadPayload, action.resolution);
      return true;
    },
    generate_social_copy: (action) => {
      const socialCopyPayload = action.payload as { promotion?: ListingPromotion };
      dependencies.appendAssistantMessage({
        content: action.response,
        promotion: socialCopyPayload.promotion
      });
      return true;
    },
    create_campaign_links: (action, sourceMessage) => {
      dependencies.proposePromotionFromMessage(sourceMessage, action.resolution);
      return true;
    },
    publish_listing: (action, sourceMessage) => {
      if (!dependencies.looksLikeExternalChannelPromotion(sourceMessage)) {
        return false;
      }

      dependencies.proposePromotionFromMessage(sourceMessage, action.resolution);
      return true;
    },
    update_listing_draft: (action, sourceMessage) => {
      dependencies.proposeListingUpdateFromMessage(
        action.response,
        sourceMessage,
        action.payload as ListingUpdatePayload,
        action.resolution
      );
      return true;
    },
    create_schedule_event: (action) =>
      dependencies.showScheduleResolutionMessage(
        action.response,
        action.payload as BrokerEventDraftInput,
        action.resolution
      )
  };
}

export async function handleAgentActionResponse(
  handlers: AgentActionResponseHandlers,
  action: AgentAction,
  sourceMessage: string
) {
  const handler = handlers[action.intent];
  return handler ? await handler(action, sourceMessage) : false;
}
