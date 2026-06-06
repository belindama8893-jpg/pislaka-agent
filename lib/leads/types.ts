export type LeadRecord = {
  id: string;
  broker_id: string;
  listing_id: string | null;
  campaign_link_id: string | null;
  source_channel: string | null;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  message: string | null;
  status: "new" | "contacted" | "qualified" | "closed" | "lost";
  urgency: "low" | "normal" | "high" | null;
  ai_summary: string | null;
  created_at: string;
  updated_at: string | null;
};

export type LeadListItem = LeadRecord & {
  listing_title: string | null;
  listing_area: string | null;
  listing_city: string | null;
  campaign_code: string | null;
  campaign_channel: string | null;
};
