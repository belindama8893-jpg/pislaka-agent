export type AgentPendingPromotionAction<Listing, Channel extends string> = {
  channels: Channel[];
  instruction: string;
  listing: Listing;
  messageId: string;
};

export type AgentPendingSocialCopyAction<Promotion, Channel extends string> = {
  channels: Channel[];
  instruction: string;
  messageId: string;
  promotion: Promotion;
};

type PromotionCard<Channel extends string> = {
  channel: Channel;
  landing_url?: string | null;
};

type PendingActionMessage<Listing, Promotion extends { cards: PromotionCard<Channel>[] }, Channel extends string> = {
  content: string;
  draft?: unknown;
  id: string;
  isProgress?: boolean;
  listingSaved?: unknown;
  promotion?: Promotion;
  promotionChannels?: Channel[];
  promotionInstruction?: string;
  promotionTarget?: Listing;
  role: "user" | "assistant";
  sourceMessage?: string;
};

export function isAgentConfirmationMessage(messageText: string) {
  return /^(?:yes|y|ok|okay|confirm|confirmed|go ahead|do it|proceed|sure|haan|han|ji|是|对|确认|可以|好的)$/i.test(
    messageText.trim()
  );
}

export function findLatestPendingPromotionAction<
  Listing,
  Promotion extends { cards: PromotionCard<Channel>[] },
  Channel extends string
>(
  messages: PendingActionMessage<Listing, Promotion, Channel>[],
  consumedPendingActionIds: string[],
  fallbackChannels: Channel[]
): AgentPendingPromotionAction<Listing, Channel> | null {
  for (const message of [...messages].reverse()) {
    if (message.role !== "assistant") {
      continue;
    }

    if (message.promotion) {
      return null;
    }

    if (message.promotionTarget && !consumedPendingActionIds.includes(message.id)) {
      return {
        messageId: message.id,
        listing: message.promotionTarget,
        instruction: message.promotionInstruction ?? "",
        channels: message.promotionChannels?.length ? message.promotionChannels : fallbackChannels
      };
    }

    if (!message.isProgress) {
      return null;
    }
  }

  return null;
}

export function findLatestPendingSocialCopyAction<
  Listing,
  Promotion extends { cards: PromotionCard<Channel>[] },
  Channel extends string
>(
  messages: PendingActionMessage<Listing, Promotion, Channel>[],
  consumedPendingActionIds: string[]
): AgentPendingSocialCopyAction<Promotion, Channel> | null {
  for (const message of [...messages].reverse()) {
    if (message.role !== "assistant") {
      continue;
    }

    if (message.draft || message.promotionTarget || message.listingSaved) {
      return null;
    }

    if (
      message.promotion &&
      !consumedPendingActionIds.includes(message.id) &&
      message.promotion.cards.every((card) => !card.landing_url)
    ) {
      return {
        messageId: message.id,
        promotion: message.promotion,
        instruction: message.sourceMessage ?? message.content,
        channels: message.promotion.cards.map((card) => card.channel)
      };
    }

    if (!message.isProgress) {
      return null;
    }
  }

  return null;
}

export function canHandlePendingActionConfirmation(options: {
  hasOutgoingContext: boolean;
  hasOutgoingFiles: boolean;
  hasOutgoingMedia: boolean;
  message: string;
}) {
  return (
    isAgentConfirmationMessage(options.message) &&
    !options.hasOutgoingMedia &&
    !options.hasOutgoingFiles &&
    !options.hasOutgoingContext
  );
}

export function looksLikeBulkLeadWrite(message: string) {
  return /reply|follow[-\s]?up|follow up|mark|status|schedule|hot|warm|contacted|qualified|phone|mobile|number|email|name|contact|话术|回复|跟进|标记|状态|安排|回访|电话|手机号|邮箱|名字/i.test(message);
}

export function looksLikeBulkLeadStatusUpdate(message: string) {
  return /mark|status|hot|contacted|qualified|closed|lost|new|标记|状态|已联系|成交|丢失|无效|高意向/i.test(message);
}

export function getBulkLeadWriteGuard<LeadContext>(message: string, selectedLeadContexts: LeadContext[]) {
  if (selectedLeadContexts.length <= 1 || !looksLikeBulkLeadWrite(message)) {
    return {
      kind: "none" as const,
      leadContexts: selectedLeadContexts
    };
  }

  return {
    kind: looksLikeBulkLeadStatusUpdate(message) ? ("status_update" as const) : ("unsupported_bulk_write" as const),
    leadContexts: selectedLeadContexts
  };
}
