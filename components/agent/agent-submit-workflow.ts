import type { ListingDraftInput } from "@/lib/listings/types";
import type { ListingPromotion, PromotionCard as ListingPromotionCard, PromotionChannel } from "@/lib/promotions/types";

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

function formatDraftPrice(draft: ListingDraftInput) {
  if (!draft.price_amount) {
    return null;
  }

  const crore = draft.price_amount / 10000000;
  if (crore >= 1) {
    return `PKR ${Number(crore.toFixed(2)).toString()} Crore`;
  }

  const lakh = draft.price_amount / 100000;
  if (lakh >= 1) {
    return `PKR ${Number(lakh.toFixed(2)).toString()} Lakh`;
  }

  return `PKR ${draft.price_amount.toLocaleString("en-US")}`;
}

function formatDraftLocation(draft: ListingDraftInput) {
  return [draft.location_area, draft.city].filter(Boolean).join(", ");
}

function formatDraftSize(draft: ListingDraftInput) {
  return draft.area_value && draft.area_unit ? `${draft.area_value} ${draft.area_unit}` : null;
}

export function buildDraftSocialCopyPromotion(
  draft: ListingDraftInput,
  channels: PromotionChannel[],
  instruction: string
): ListingPromotion {
  const selectedChannels = channels.length ? channels : (["whatsapp"] as PromotionChannel[]);
  const location = formatDraftLocation(draft);
  const size = formatDraftSize(draft);
  const price = formatDraftPrice(draft);
  const listingType = draft.listing_type === "rent" ? "for rent" : draft.listing_type === "sale" ? "for sale" : "available";
  const listingPhrase = listingType;
  const propertyLabel = [size, draft.property_type].filter(Boolean).join(" ") || draft.property_type || "Property";
  const opening = [propertyLabel, listingType, location ? `in ${location}` : ""].filter(Boolean).join(" ");
  const roomLine = [
    draft.bedrooms !== undefined ? `${draft.bedrooms} beds` : null,
    draft.bathrooms !== undefined ? `${draft.bathrooms} baths` : null
  ]
    .filter(Boolean)
    .join(" | ");
  const featureLine = draft.features?.length ? `Features: ${draft.features.join(", ")}` : null;
  const baseLines = [
    opening || draft.title,
    price ? `Demand: ${price}` : null,
    roomLine || null,
    featureLine
  ].filter(Boolean);
  const buildChannelCards = (channel: PromotionChannel): ListingPromotionCard[] => {
    if (channel !== "whatsapp") {
      return [
        {
          channel,
          title:
            channel === "facebook"
              ? "Facebook promotion draft"
              : channel === "instagram"
                ? "Instagram promotion draft"
                : "Portal promotion draft",
          body: [
            ...baseLines,
            channel === "instagram" ? "DM for details and viewing." : "Interested? Reply for details or a viewing slot."
          ].join("\n\n"),
          cta: channel === "instagram" ? "DM for details." : "Reply for details.",
          image_brief: "Use the strongest property photo or listing preview image."
        }
      ];
    }

    return [
      {
        channel,
        title: "Direct buyer WhatsApp draft",
        body: [...baseLines, "Interested? Reply for details or a viewing slot."].join("\n\n"),
        cta: "Reply for details.",
        image_brief: "Use the clearest property photo or listing preview image."
      },
      {
        channel,
        title: "Premium WhatsApp draft",
        body: [
          `Available now: ${opening || draft.title}.`,
          price ? `Demand: ${price}` : null,
          roomLine ? `Highlights: ${roomLine}` : null,
          featureLine,
          "A strong option for serious buyers looking for a clean location and quick viewing."
        ]
          .filter(Boolean)
          .join("\n\n"),
        cta: "Message to arrange a viewing.",
        image_brief: "Use a polished exterior or best room photo first."
      },
      {
        channel,
        title: "Short broadcast WhatsApp draft",
        body: [
          `${propertyLabel} ${listingPhrase} - ${location || draft.city || "Lahore"}`,
          price ? `Demand: ${price}` : null,
          "Reply for details, pictures, or viewing time."
        ]
          .filter(Boolean)
          .join("\n"),
        cta: "Reply for details.",
        image_brief: "Use one clear property image with minimal text."
      }
    ];
  };

  return {
    summary:
      "Want dedicated tracking links and attribution? Save this as a promotion asset/listing first, then I can generate link tracking.",
    cards: selectedChannels.flatMap(buildChannelCards)
  };
}

export function getEmptyAgentTurnResponse(options: {
  activeDraftId?: string | null;
  hasOutgoingMedia: boolean;
  visionAnalysisError?: string;
}) {
  if (!options.hasOutgoingMedia) {
    return "I attached that context. Tell me what you want to do with it, for example edit it, draft a reply, promote it, or schedule a follow-up.";
  }

  const errorSuffix = options.visionAnalysisError
    ? ` I could not analyze the images yet: ${options.visionAnalysisError}`
    : "";

  if (options.activeDraftId) {
    return `I added these media files to the current listing preview. They will upload when you confirm the listing.${errorSuffix}`;
  }

  return `I can use these as listing media. Please add the property details, and I will draft the listing with these files attached.${errorSuffix}`;
}
