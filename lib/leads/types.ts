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
  last_contacted_at: string | null;
  next_follow_up_at: string | null;
  last_note: string | null;
  budget_min: number | null;
  budget_max: number | null;
  interested_area: string | null;
  interested_listing_id: string | null;
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

export type FollowUpActivityType =
  | "reply_drafted"
  | "whatsapp_opened"
  | "message_sent"
  | "status_changed"
  | "reminder_created"
  | "note_added"
  | "viewing_scheduled"
  | "chat_imported"
  | "followup_summary_saved";

export type FollowUpChannel =
  | "whatsapp"
  | "phone"
  | "in_person"
  | "facebook"
  | "instagram"
  | "other";

export type FollowUpSourceType =
  | "manual"
  | "whatsapp_paste"
  | "whatsapp_txt_upload"
  | "whatsapp_zip_upload"
  | "agent_chat";

export type FollowUpActivityRecord = {
  id: string;
  broker_id: string;
  lead_id: string;
  related_listing_id: string | null;
  activity_type: FollowUpActivityType;
  channel: FollowUpChannel;
  summary: string | null;
  message_draft: string | null;
  old_status: LeadRecord["status"] | null;
  new_status: LeadRecord["status"] | null;
  next_follow_up_at: string | null;
  source_type: FollowUpSourceType;
  original_chat_saved: boolean;
  original_chat_text: string | null;
  occurred_at: string;
  created_at: string;
  created_by: string | null;
};

export type TodayFollowUpLead = LeadListItem & {
  recommended_reason: string;
  recommended_action: string;
};
