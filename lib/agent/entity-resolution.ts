import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AgentAction,
  AgentContextAttachment,
  LeadDetailsUpdatePayload,
  LeadListingUpdatePayload,
  LeadOperationPayload
} from "@/lib/agent/types";
import {
  leadDetailsUpdatePayloadSchema,
  leadCreatePayloadSchema,
  leadListingUpdatePayloadSchema,
  leadOperationPayloadSchema,
  listingUpdatePayloadSchema,
  scheduleEventActionPayloadSchema
} from "@/lib/agent/types";
import { getAgentIntentDefinition, type AgentCapabilityResolution } from "@/lib/agent/registry/intents";
import type { BrokerEventDraftInput } from "@/lib/events/types";
import { getRecentLeadsForBroker } from "@/lib/leads/queries";
import type { LeadListItem } from "@/lib/leads/types";
import type { ListingRecord } from "@/lib/listings/types";

type ResolveAgentActionEntitiesOptions = {
  contextAttachments?: AgentContextAttachment[];
  currentLeadId?: string;
  currentListingId?: string;
  originalMessage?: string;
};

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}@+.]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePhone(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

function leadLabel(lead: LeadListItem) {
  return lead.full_name || lead.phone || lead.email || "Unnamed buyer";
}

function toResolutionCandidate(lead: LeadListItem) {
  return {
    id: lead.id,
    label: leadLabel(lead),
    phone: lead.phone,
    email: lead.email,
    status: lead.status,
    listing_title: lead.listing_title,
    listing_area: lead.listing_area,
    listing_city: lead.listing_city
  };
}

function listingLabel(listing: ListingRecord) {
  return (
    listing.title ||
    [listing.area_value, listing.area_unit, listing.property_type].filter(Boolean).join(" ") ||
    "Untitled listing"
  );
}

function toListingResolutionCandidate(listing: ListingRecord) {
  return {
    id: listing.id,
    label: listingLabel(listing),
    status: listing.status,
    listing_title: listing.title,
    description: listing.description,
    listing_area: listing.location_area,
    listing_city: listing.city,
    city: listing.city,
    location_area: listing.location_area,
    property_type: listing.property_type,
    listing_type: listing.listing_type,
    price_amount: listing.price_amount,
    price_currency: listing.price_currency,
    area_value: listing.area_value,
    area_unit: listing.area_unit,
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
    features: listing.features
  };
}

function scoreLead(query: string, lead: LeadListItem) {
  const normalizedQuery = normalizeText(query);
  const queryPhone = normalizePhone(query);
  const leadPhone = normalizePhone(lead.phone);
  const leadName = normalizeText(lead.full_name);
  const searchable = normalizeText(
    [
      lead.full_name,
      lead.phone,
      lead.email,
      lead.message,
      lead.ai_summary,
      lead.listing_title,
      lead.listing_area,
      lead.listing_city,
      lead.campaign_code,
      lead.campaign_channel,
      lead.source_channel
    ]
      .filter(Boolean)
      .join(" ")
  );

  let score = 0;

  if (queryPhone && leadPhone && leadPhone.includes(queryPhone)) {
    score += queryPhone.length >= 7 ? 30 : 14;
  }

  if (lead.email && normalizedQuery.includes(normalizeText(lead.email))) {
    score += 28;
  }

  if (leadName && normalizedQuery.includes(leadName)) {
    score += 20;
  }

  if (leadName && normalizedQuery.length > 2 && leadName.includes(normalizedQuery)) {
    score += normalizedQuery.length >= 5 ? 14 : 8;
  }

  for (const token of new Set(normalizedQuery.split(" ").filter((part) => part.length > 2))) {
    if (searchable.includes(token)) {
      score += token.length >= 5 ? 4 : 2;
    }
  }

  return score;
}

function leadQueryFromPayload(payload: Pick<LeadOperationPayload, "lead_name" | "query">) {
  return [payload.lead_name, payload.query].filter(Boolean).join(" ").trim();
}

function scheduleLeadQueryFromPayload(payload: BrokerEventDraftInput) {
  if (isPlaceholderParticipant(payload.lead_name)) {
    return "";
  }

  return [payload.lead_name].filter(Boolean).join(" ").trim();
}

function scheduleListingQueryFromPayload(payload: BrokerEventDraftInput, originalMessage?: string) {
  return [payload.listing_reference, payload.location_text, originalMessage].filter(Boolean).join(" ").trim();
}

function scheduleEventNeedsParticipant(payload: BrokerEventDraftInput) {
  return (
    payload.event_type === "viewing" ||
    payload.event_type === "contract_signing" ||
    payload.event_type === "handover" ||
    payload.event_type === "follow_up"
  );
}

function isPlaceholderParticipant(value: string | null | undefined) {
  return /^(?:him|her|them|he|she|they|client|lead|buyer|seller)$/i.test((value ?? "").trim());
}

function scheduleTitleHasPlaceholderParticipant(title: string | null | undefined) {
  return /\b(?:with|for|to)\s+(?:him|her|them|client|lead|buyer|seller)\b/i.test(title ?? "");
}

function buildResolvedScheduleTitle(
  payload: BrokerEventDraftInput,
  participantName: string,
  originalMessage?: string
) {
  const message = originalMessage ?? payload.description ?? "";

  if (payload.event_type === "viewing") {
    return `Viewing with ${participantName}`;
  }

  if (payload.event_type === "contract_signing") {
    return `Contract signing with ${participantName}`;
  }

  if (payload.event_type === "handover") {
    return `Handover with ${participantName}`;
  }

  if (payload.event_type === "follow_up") {
    if (/\b(call|phone|ring|callback|call back)\b|打电话|回电|电话/i.test(message)) {
      return `Call ${participantName}`;
    }

    return `Follow up with ${participantName}`;
  }

  return payload.title || payload.event_type.replace(/_/g, " ");
}

function shouldRefreshScheduleTitle(payload: BrokerEventDraftInput) {
  if (!payload.title?.trim()) {
    return true;
  }

  const normalizedTitle = payload.title.trim().toLowerCase();
  if (
    scheduleEventNeedsParticipant(payload) &&
    (normalizedTitle === payload.event_type.replace(/_/g, " ") ||
      normalizedTitle === "follow up" ||
      normalizedTitle === "viewing" ||
      normalizedTitle === "contract signing" ||
      normalizedTitle === "handover")
  ) {
    return true;
  }

  if (scheduleTitleHasPlaceholderParticipant(payload.title)) {
    return true;
  }

  const participantName = payload.lead_name;
  if (participantName && isPlaceholderParticipant(participantName) && payload.title.toLowerCase().includes(participantName.toLowerCase())) {
    return true;
  }

  return false;
}

function queryMentionsCurrentListing(query: string) {
  return /\b(this|current|latest confirmed|just confirmed)\b|这套|这个|刚才|刚刚/i.test(query);
}

function queryMentionsCurrentLead(query: string) {
  return /\b(this|current|selected|attached|latest confirmed|just confirmed)\s+(?:lead|client|buyer|customer)?\b|这位|这个客户|这条线索|刚才|刚刚/i.test(query);
}

function queryMentionsLatestListing(query: string) {
  return /\b(latest|most recent|newest|last listing)\b|最新|最近/i.test(query);
}

function getResolutionPolicy(intent: AgentAction["intent"]): AgentCapabilityResolution {
  return getAgentIntentDefinition(intent).resolution;
}

function getSelectedContextId(
  options: ResolveAgentActionEntitiesOptions,
  type: AgentContextAttachment["type"],
  policy: AgentCapabilityResolution,
  query = ""
) {
  if (!policy.allowCurrentContext) {
    return undefined;
  }

  const matchingAttachment = [...(options.contextAttachments ?? [])]
    .reverse()
    .find((attachment) => attachment.type === type);

  if (matchingAttachment) {
    return matchingAttachment.entity_id;
  }

  if (type === "lead" && options.currentLeadId && queryMentionsCurrentLead(query)) {
    return options.currentLeadId;
  }

  if (type === "listing" && options.currentListingId && queryMentionsCurrentListing(query)) {
    return options.currentListingId;
  }

  return undefined;
}

function listingSearchText(listing: ListingRecord) {
  return normalizeText(
    [
      listing.title,
      listing.description,
      listing.city,
      listing.location_area,
      listing.property_type,
      listing.listing_type,
      listing.area_value && listing.area_unit ? `${listing.area_value} ${listing.area_unit}` : null,
      listing.bedrooms !== null && listing.bedrooms !== undefined ? `${listing.bedrooms} beds` : null
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function extractRequiredListingLocations(query: string) {
  const locations: string[] = [];
  const normalizedQuery = normalizeText(query);
  const dhaMatch = query.match(/DHA\s*Phase\s*\d+/i);

  if (dhaMatch) {
    locations.push(normalizeText(dhaMatch[0]));
  }

  for (const location of ["gulberg", "bahria town", "lakecity"]) {
    if (normalizedQuery.includes(location)) {
      locations.push(location);
    }
  }

  return Array.from(new Set(locations));
}

function extractRequiredListingTypeTerms(query: string) {
  const normalizedQuery = normalizeText(query);
  const groups: string[][] = [];

  if (/\bpenthouse\b/.test(normalizedQuery)) {
    groups.push(["penthouse"]);
  } else if (/\b(villa|bungalow)\b/.test(normalizedQuery)) {
    groups.push(["villa", "house"]);
  } else if (/\bhouse\b/.test(normalizedQuery)) {
    groups.push(["house", "villa"]);
  } else if (/\b(apartment|flat)\b/.test(normalizedQuery)) {
    groups.push(["apartment", "flat", "penthouse"]);
  } else if (/\bplot\b/.test(normalizedQuery)) {
    groups.push(["plot"]);
  } else if (/\b(shop|commercial)\b/.test(normalizedQuery)) {
    groups.push(["shop", "commercial"]);
  }

  return groups;
}

function listingSatisfiesHardQueryTerms(query: string, listing: ListingRecord) {
  const searchable = listingSearchText(listing);
  const requiredLocations = extractRequiredListingLocations(query);

  if (requiredLocations.some((location) => !searchable.includes(location))) {
    return false;
  }

  const requiredTypeGroups = extractRequiredListingTypeTerms(query);
  return requiredTypeGroups.every((group) => group.some((term) => searchable.includes(term)));
}

function scoreListing(query: string, listing: ListingRecord) {
  const normalizedQuery = normalizeText(query);
  const searchable = listingSearchText(listing);

  let score = 0;
  for (const token of new Set(normalizedQuery.split(" ").filter((part) => part.length > 2))) {
    if (searchable.includes(token)) {
      score += token.length >= 5 ? 4 : 2;
    }
  }

  if (listing.location_area && normalizedQuery.includes(normalizeText(listing.location_area))) {
    score += 12;
  }

  if (
    listing.area_value &&
    listing.area_unit &&
    normalizedQuery.includes(`${listing.area_value} ${listing.area_unit}`)
  ) {
    score += 14;
  }

  if (listing.property_type && normalizedQuery.includes(normalizeText(listing.property_type))) {
    score += 6;
  }

  return score;
}

async function getListingsForResolution(supabase: SupabaseClient, brokerId: string) {
  const { data, error } = await supabase
    .from("listings")
    .select(
      "id, status, title, description, city, location_area, property_type, listing_type, price_amount, price_currency, area_value, area_unit, bedrooms, bathrooms, features, created_at, updated_at"
    )
    .eq("broker_id", brokerId)
    .neq("status", "archived")
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ListingRecord[];
}

function resolveLeadFromPayload(
  payload: Pick<LeadListingUpdatePayload, "lead_id" | "lead_name" | "query">,
  leads: LeadListItem[],
  selectedLeadId?: string
) {
  const targetLeadId = selectedLeadId ?? payload.lead_id;
  if (targetLeadId) {
    return {
      lead: leads.find((lead) => lead.id === targetLeadId),
      ambiguous: false,
      candidates: [] as ReturnType<typeof toResolutionCandidate>[]
    };
  }

  const query = leadQueryFromPayload(payload);
  if (!query) {
    return { lead: undefined, ambiguous: false, candidates: [] as ReturnType<typeof toResolutionCandidate>[] };
  }

  const scoredLeads = leads
    .map((lead) => ({ lead, score: scoreLead(query, lead) }))
    .filter((item) => item.score >= 8)
    .sort((left, right) => right.score - left.score);
  const [best, second] = scoredLeads;

  if (!best) {
    return { lead: undefined, ambiguous: false, candidates: [] as ReturnType<typeof toResolutionCandidate>[] };
  }

  if (second && (best.score === second.score || best.score - second.score < 5)) {
    return {
      lead: undefined,
      ambiguous: true,
      candidates: scoredLeads.slice(0, 5).map((item) => toResolutionCandidate(item.lead))
    };
  }

  return { lead: best.lead, ambiguous: false, candidates: [] as ReturnType<typeof toResolutionCandidate>[] };
}

function resolveListingFromLeadListingPayload(
  payload: LeadListingUpdatePayload,
  listings: ListingRecord[],
  selectedListingId?: string,
  originalMessage?: string
) {
  const targetListingId = selectedListingId ?? payload.listing_id;
  if (targetListingId) {
    return {
      listing: listings.find((listing) => listing.id === targetListingId),
      ambiguous: false,
      candidates: [] as ReturnType<typeof toListingResolutionCandidate>[]
    };
  }

  const query = [payload.listing_query, payload.query, originalMessage].filter(Boolean).join(" ").trim();
  if (!query) {
    return { listing: undefined, ambiguous: false, candidates: [] as ReturnType<typeof toListingResolutionCandidate>[] };
  }

  const scoredListings = listings
    .filter((listing) => listingSatisfiesHardQueryTerms(query, listing))
    .map((listing) => ({ listing, score: scoreListing(query, listing) }))
    .filter((item) => item.score >= 8)
    .sort((left, right) => right.score - left.score);
  const [best, second] = scoredListings;

  if (!best) {
    return { listing: undefined, ambiguous: false, candidates: [] as ReturnType<typeof toListingResolutionCandidate>[] };
  }

  if (second && (best.score === second.score || best.score - second.score < 5)) {
    return {
      listing: undefined,
      ambiguous: true,
      candidates: scoredListings.slice(0, 5).map((item) => toListingResolutionCandidate(item.listing))
    };
  }

  return { listing: best.listing, ambiguous: false, candidates: [] as ReturnType<typeof toListingResolutionCandidate>[] };
}

async function resolveScheduleEventEntities(
  action: AgentAction,
  supabase: SupabaseClient,
  brokerId: string,
  options: ResolveAgentActionEntitiesOptions
): Promise<AgentAction> {
  const parsedPayload = scheduleEventActionPayloadSchema.safeParse(action.payload);
  if (!parsedPayload.success) {
    return action;
  }

  const payload = parsedPayload.data;
  const policy = getResolutionPolicy(action.intent);
  const nextPayload: BrokerEventDraftInput = { ...payload };
  const sourcePayload = {
    ...(typeof payload.source_payload === "object" && payload.source_payload ? payload.source_payload : {})
  };

  const leads = await getRecentLeadsForBroker(supabase, brokerId, 100, { includeClosed: true });
  const selectedLeadId = getSelectedContextId(
    options,
    "lead",
    policy,
    [payload.lead_name, payload.title, payload.description, options.originalMessage].filter(Boolean).join(" ")
  );

  if (payload.lead_id) {
    const matchedLead = leads.find((lead) => lead.id === payload.lead_id);
    if (!matchedLead) {
      return {
        ...action,
        resolution: {
          status: "no_match",
          target_type: "lead"
        }
      };
    }

    nextPayload.lead_name = isPlaceholderParticipant(payload.lead_name)
      ? leadLabel(matchedLead)
      : (payload.lead_name ?? leadLabel(matchedLead));
    sourcePayload.resolved_lead = toResolutionCandidate(matchedLead);
  } else if (selectedLeadId) {
    const matchedLead = leads.find((lead) => lead.id === selectedLeadId);
    if (!matchedLead) {
      return {
        ...action,
        resolution: {
          status: "no_match",
          target_type: "lead"
        }
      };
    }

    nextPayload.lead_id = matchedLead.id;
    nextPayload.lead_name = isPlaceholderParticipant(payload.lead_name)
      ? leadLabel(matchedLead)
      : (payload.lead_name ?? leadLabel(matchedLead));
    sourcePayload.resolved_lead = toResolutionCandidate(matchedLead);
  } else {
    const leadQuery = scheduleLeadQueryFromPayload(payload);

    if (!leadQuery && scheduleEventNeedsParticipant(payload)) {
      return {
        ...action,
        resolution: {
          status: "needs_clarification",
          target_type: "lead"
        }
      };
    }

    if (leadQuery) {
      const scoredLeads = leads
        .map((lead) => ({ lead, score: scoreLead(leadQuery, lead) }))
        .filter((item) => item.score >= 8)
        .sort((left, right) => right.score - left.score);

      if (!scoredLeads.length) {
        sourcePayload.unresolved_lead_name = leadQuery;
        nextPayload.lead_name = payload.lead_name ?? leadQuery;
      } else {
        const [best, second] = scoredLeads;
        if (second && (best.score === second.score || best.score - second.score < 5)) {
          return {
            ...action,
            resolution: {
              status: "ambiguous",
              target_type: "lead",
              candidates: scoredLeads.slice(0, 5).map((item) => toResolutionCandidate(item.lead))
            }
          };
        }

        nextPayload.lead_id = best.lead.id;
        nextPayload.lead_name = isPlaceholderParticipant(payload.lead_name)
          ? leadLabel(best.lead)
          : (payload.lead_name ?? leadLabel(best.lead));
        sourcePayload.resolved_lead = toResolutionCandidate(best.lead);
      }
    }
  }

  if (
    nextPayload.lead_name &&
    !isPlaceholderParticipant(nextPayload.lead_name) &&
    shouldRefreshScheduleTitle(payload)
  ) {
    nextPayload.title = buildResolvedScheduleTitle(payload, nextPayload.lead_name, options.originalMessage);
  }

  const listings = await getListingsForResolution(supabase, brokerId);
  const listingQuery = scheduleListingQueryFromPayload(payload, options.originalMessage);
  const mentionsCurrentListing = queryMentionsCurrentListing(listingQuery);
  const selectedListingId = getSelectedContextId(options, "listing", policy, listingQuery);

  if (payload.listing_id) {
    const matchedListing = listings.find((listing) => listing.id === payload.listing_id);
    if (!matchedListing) {
      return {
        ...action,
        resolution: {
          status: "no_match",
          target_type: "listing"
        }
      };
    }

    nextPayload.listing_reference = listingLabel(matchedListing);
    sourcePayload.resolved_listing = toListingResolutionCandidate(matchedListing);
  } else if (selectedListingId) {
    const matchedListing = listings.find((listing) => listing.id === selectedListingId);
    if (!matchedListing) {
      return {
        ...action,
        resolution: {
          status: "no_match",
          target_type: "listing"
        }
      };
    }

    nextPayload.listing_id = matchedListing.id;
    nextPayload.listing_reference = listingLabel(matchedListing);
    sourcePayload.resolved_listing = toListingResolutionCandidate(matchedListing);
  } else if (policy.allowCurrentContext && options.currentListingId && mentionsCurrentListing) {
    const matchedListing = listings.find((listing) => listing.id === options.currentListingId);
    if (!matchedListing) {
      return {
        ...action,
        resolution: {
          status: "no_match",
          target_type: "listing"
        }
      };
    }

    nextPayload.listing_id = matchedListing.id;
    nextPayload.listing_reference = listingLabel(matchedListing);
    sourcePayload.resolved_listing = toListingResolutionCandidate(matchedListing);
  } else if (payload.listing_reference || payload.location_text) {
    const scoredListings = listings
      .map((listing) => ({ listing, score: scoreListing(listingQuery, listing) }))
      .filter((item) => item.score >= 8)
      .sort((left, right) => right.score - left.score);

    if (!scoredListings.length) {
      sourcePayload.unresolved_listing_reference = payload.listing_reference ?? payload.location_text ?? listingQuery;
    } else {
      const [best, second] = scoredListings;
      if (second && (best.score === second.score || best.score - second.score < 5)) {
        const candidates = scoredListings.slice(0, 5).map((item) => toListingResolutionCandidate(item.listing));
        sourcePayload.ambiguous_listing_candidates = candidates;
        sourcePayload.unresolved_listing_reference = payload.listing_reference ?? payload.location_text ?? listingQuery;
        return {
          ...action,
          payload: {
            ...nextPayload,
            source_payload: sourcePayload
          },
          resolution: {
            status: "ambiguous",
            target_type: "listing",
            candidates
          }
        };
      } else {
        nextPayload.listing_id = best.listing.id;
        nextPayload.listing_reference = payload.listing_reference ?? listingLabel(best.listing);
        sourcePayload.resolved_listing = toListingResolutionCandidate(best.listing);
      }
    }
  }

  return {
    ...action,
    payload: {
      ...nextPayload,
      source_payload: sourcePayload
    },
    resolution: {
      status: "matched",
      target_type: "schedule_event"
    }
  };
}

export async function resolveAgentActionEntities(
  action: AgentAction,
  supabase: SupabaseClient,
  brokerId: string,
  options: ResolveAgentActionEntitiesOptions = {}
): Promise<AgentAction> {
  if (
    action.intent !== "draft_lead_reply" &&
    action.intent !== "record_lead_followup" &&
    action.intent !== "create_lead" &&
    action.intent !== "update_lead_details" &&
    action.intent !== "update_lead_listing" &&
    action.intent !== "update_lead_status" &&
    action.intent !== "create_campaign_links" &&
    action.intent !== "update_listing_draft" &&
    action.intent !== "create_schedule_event"
  ) {
    return action;
  }

  if (action.intent === "create_schedule_event") {
    return resolveScheduleEventEntities(action, supabase, brokerId, options);
  }

  const policy = getResolutionPolicy(action.intent);

  if (action.intent === "create_lead") {
    const parsedPayload = leadCreatePayloadSchema.safeParse(action.payload);
    if (!parsedPayload.success) {
      return action;
    }

    const selectedListingId = getSelectedContextId(
      options,
      "listing",
      policy,
      [parsedPayload.data.message, options.originalMessage].filter(Boolean).join(" ")
    );
    if (!selectedListingId) {
      return action;
    }

    const listings = await getListingsForResolution(supabase, brokerId);
    const matchedListing = listings.find((listing) => listing.id === selectedListingId);

    return {
      ...action,
      payload: matchedListing ? { ...parsedPayload.data, listing_id: matchedListing.id } : parsedPayload.data,
      resolution: matchedListing
        ? {
            status: "matched",
            target_type: "listing",
            target_id: matchedListing.id,
            matched: toListingResolutionCandidate(matchedListing)
          }
        : {
            status: "no_match",
            target_type: "listing"
          }
    };
  }

  if (action.intent === "record_lead_followup") {
    const parsedPayload = leadOperationPayloadSchema.safeParse(action.payload);
    if (!parsedPayload.success) {
      return action;
    }

    const leads = await getRecentLeadsForBroker(supabase, brokerId, 100, { includeClosed: true });
    const leadResolution = resolveLeadFromPayload(
      parsedPayload.data,
      leads,
      getSelectedContextId(
        options,
        "lead",
        policy,
        [leadQueryFromPayload(parsedPayload.data), options.originalMessage].filter(Boolean).join(" ")
      )
    );

    if (leadResolution.ambiguous) {
      return {
        ...action,
        resolution: {
          status: "ambiguous",
          target_type: "lead",
          candidates: leadResolution.candidates
        }
      };
    }

    if (!leadResolution.lead) {
      return {
        ...action,
        resolution: {
          status: "needs_clarification",
          target_type: "lead"
        }
      };
    }

    return {
      ...action,
      payload: {
        ...parsedPayload.data,
        lead_id: leadResolution.lead.id
      },
      resolution: {
        status: "matched",
        target_type: "lead",
        target_id: leadResolution.lead.id,
        matched: toResolutionCandidate(leadResolution.lead)
      }
    };
  }

  if (action.intent === "update_lead_listing") {
    const parsedPayload = leadListingUpdatePayloadSchema.safeParse(action.payload);
    if (!parsedPayload.success) {
      return action;
    }

    const payload = parsedPayload.data;
    const leads = await getRecentLeadsForBroker(supabase, brokerId, 100, { includeClosed: true });
    const leadResolution = resolveLeadFromPayload(
      payload,
      leads,
      getSelectedContextId(
        options,
        "lead",
        policy,
        [leadQueryFromPayload(payload), options.originalMessage].filter(Boolean).join(" ")
      )
    );

    if (leadResolution.ambiguous) {
      return {
        ...action,
        resolution: {
          status: "ambiguous",
          target_type: "lead",
          candidates: leadResolution.candidates
        }
      };
    }

    if (!leadResolution.lead) {
      return {
        ...action,
        resolution: {
          status: "needs_clarification",
          target_type: "lead"
        }
      };
    }

    const listings = await getListingsForResolution(supabase, brokerId);
    const listingResolution = resolveListingFromLeadListingPayload(
      payload,
      listings,
      getSelectedContextId(
        options,
        "listing",
        policy,
        [payload.listing_query, payload.query, options.originalMessage].filter(Boolean).join(" ")
      ),
      options.originalMessage
    );

    if (listingResolution.ambiguous) {
      return {
        ...action,
        payload: {
          ...payload,
          lead_id: leadResolution.lead.id
        },
        resolution: {
          status: "ambiguous",
          target_type: "listing",
          candidates: listingResolution.candidates
        }
      };
    }

    if (!listingResolution.listing) {
      return {
        ...action,
        payload: {
          ...payload,
          lead_id: leadResolution.lead.id
        },
        resolution: {
          status: "needs_clarification",
          target_type: "listing"
        }
      };
    }

    return {
      ...action,
      payload: {
        ...payload,
        lead_id: leadResolution.lead.id,
        listing_id: listingResolution.listing.id
      },
      resolution: {
        status: "matched",
        target_type: "lead",
        target_id: leadResolution.lead.id,
        matched: toResolutionCandidate(leadResolution.lead)
      }
    };
  }

  if (action.intent === "create_campaign_links" || action.intent === "update_listing_draft") {
    const parsedListingUpdate =
      action.intent === "update_listing_draft" ? listingUpdatePayloadSchema.safeParse(action.payload) : null;
    if (parsedListingUpdate && !parsedListingUpdate.success) {
      return action;
    }

    const payload = parsedListingUpdate?.success ? parsedListingUpdate.data : action.payload;
    const payloadQuery = typeof payload.query === "string" ? payload.query : "";
    const originalQuery = options.originalMessage ?? "";
    const query = [payloadQuery, originalQuery].filter(Boolean).join(" ").trim();
    const contextQuery = originalQuery || payloadQuery;
    const listings = await getListingsForResolution(supabase, brokerId);
    const payloadListingId = typeof payload.listing_id === "string" ? payload.listing_id : undefined;
    const selectedListingId = getSelectedContextId(options, "listing", policy, contextQuery);

    if (selectedListingId || payloadListingId) {
      const targetListingId = selectedListingId ?? payloadListingId;
      const matchedListing = listings.find((listing) => listing.id === targetListingId);

      return {
        ...action,
        payload: matchedListing ? { ...payload, listing_id: matchedListing.id } : payload,
        resolution: matchedListing
          ? {
              status: "matched",
              target_type: "listing",
              target_id: matchedListing.id,
              matched: toListingResolutionCandidate(matchedListing)
            }
          : {
              status: "no_match",
              target_type: "listing"
            }
      };
    }

    if (policy.allowCurrentContext && options.currentListingId && queryMentionsCurrentListing(contextQuery)) {
      const matchedListing = listings.find((listing) => listing.id === options.currentListingId);

      return {
        ...action,
        payload: matchedListing ? { ...payload, listing_id: matchedListing.id } : payload,
        resolution: matchedListing
          ? {
              status: "matched",
              target_type: "listing",
              target_id: matchedListing.id,
              matched: toListingResolutionCandidate(matchedListing)
            }
          : {
              status: "no_match",
              target_type: "listing"
            }
      };
    }

    if (policy.allowLatestOnlyWhenExplicit && queryMentionsLatestListing(contextQuery) && listings[0]) {
      return {
        ...action,
        payload: {
          ...payload,
          listing_id: listings[0].id
        },
        resolution: {
          status: "matched",
          target_type: "listing",
          target_id: listings[0].id,
          matched: toListingResolutionCandidate(listings[0])
        }
      };
    }

    const scoredListings = listings
      .filter((listing) => listingSatisfiesHardQueryTerms(query, listing))
      .map((listing) => ({ listing, score: scoreListing(query, listing) }))
      .filter((item) => item.score >= 8)
      .sort((left, right) => right.score - left.score);

    if (!scoredListings.length) {
      return {
        ...action,
        resolution: {
          status: "no_match",
          target_type: "listing"
        }
      };
    }

    const [best, second] = scoredListings;
    if (second && (best.score === second.score || best.score - second.score < 5)) {
      return {
        ...action,
        resolution: {
          status: "ambiguous",
          target_type: "listing",
          candidates: scoredListings.slice(0, 5).map((item) => toListingResolutionCandidate(item.listing))
        }
      };
    }

    return {
      ...action,
      payload: {
        ...payload,
        listing_id: best.listing.id
      },
      resolution: {
        status: "matched",
        target_type: "listing",
        target_id: best.listing.id,
        matched: toListingResolutionCandidate(best.listing)
      }
    };
  }

  let payload: LeadOperationPayload | LeadDetailsUpdatePayload;
  if (action.intent === "update_lead_details") {
    const parsedPayload = leadDetailsUpdatePayloadSchema.safeParse(action.payload);
    if (!parsedPayload.success) {
      return action;
    }
    payload = parsedPayload.data;
  } else {
    const parsedPayload = leadOperationPayloadSchema.safeParse(action.payload);
    if (!parsedPayload.success) {
      return action;
    }
    payload = parsedPayload.data;
  }
  const leads = await getRecentLeadsForBroker(supabase, brokerId, 100, { includeClosed: true });
  const selectedLeadId = getSelectedContextId(
    options,
    "lead",
    policy,
    [leadQueryFromPayload(payload), options.originalMessage].filter(Boolean).join(" ")
  );

  if (selectedLeadId || payload.lead_id) {
    const targetLeadId = selectedLeadId ?? payload.lead_id;
    const matchedLead = leads.find((lead) => lead.id === targetLeadId);

    return {
      ...action,
      payload: matchedLead ? { ...payload, lead_id: matchedLead.id } : payload,
      resolution: matchedLead
        ? {
            status: "matched",
            target_type: "lead",
            target_id: matchedLead.id,
            matched: toResolutionCandidate(matchedLead)
          }
        : {
            status: "no_match",
            target_type: "lead"
          }
    };
  }

  const query = leadQueryFromPayload(payload);
  if (!query) {
    return {
      ...action,
      resolution: {
        status: "needs_clarification",
        target_type: "lead"
      }
    };
  }

  const scoredLeads = leads
    .map((lead) => ({ lead, score: scoreLead(query, lead) }))
    .filter((item) => item.score >= 8)
    .sort((left, right) => right.score - left.score);

  if (!scoredLeads.length) {
    return {
      ...action,
      resolution: {
        status: "no_match",
        target_type: "lead"
      }
    };
  }

  const [best, second] = scoredLeads;
  if (second && (best.score === second.score || best.score - second.score < 5)) {
    return {
      ...action,
      resolution: {
        status: "ambiguous",
        target_type: "lead",
        candidates: scoredLeads.slice(0, 5).map((item) => toResolutionCandidate(item.lead))
      }
    };
  }

  return {
    ...action,
    payload: {
      ...payload,
      lead_id: best.lead.id
    },
    resolution: {
      status: "matched",
      target_type: "lead",
      target_id: best.lead.id,
      matched: toResolutionCandidate(best.lead)
    }
  };
}
