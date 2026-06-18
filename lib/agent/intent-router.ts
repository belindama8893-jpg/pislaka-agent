export type LocalIntentKind =
  | "analytics"
  | "lead_create"
  | "lead_reply"
  | "lead_status_update"
  | "lead_details_update"
  | "lead_listing_update"
  | "today_followups"
  | "lead_followup_record"
  | "schedule_event"
  | "schedule_query"
  | "lead_query"
  | "promotion"
  | "listing_update"
  | "listing_draft"
  | "general_reply";

export type LeadStatusPatch =
  | { status: "lost" }
  | { status: "closed" }
  | { status: "qualified"; urgency: "high" }
  | { status: "contacted" }
  | { status: "new" };

export function isScheduleRequest(message: string) {
  return /schedule|appointment|viewing|visit|showing|remind|follow up|callback|call back|deadline|sign|contract|handover|delivery|weekly|monthly|calendar|日程|预约|看房|提醒|跟进|回访|报价截止|合同|签约|交房|每周|每月/i.test(
    message
  );
}

export function isScheduleQueryRequest(message: string) {
  const hasReadVerb =
    /\b(show|list|view|check|what|what's|whats|do i have|anything|agenda|calendar|kya|kia)\b|查看|显示|列出|有什么|安排|日程|کیا/iu.test(
      message
    );
  const hasScheduleNoun =
    /\b(schedule|calendar|appointment|appointments|viewings|reminders|agenda|plan|plans)\b|日程|安排|预约|看房|提醒|شیڈول|پلانز|پلان/u.test(
      message
    );
  const hasDateOnlyAgenda =
    /\b(?:what(?:'s| is)?|what do i have|do i have anything|kya|kia).*\b(today|tomorrow|kal|aaj|this week|next week)\b|\b(today|tomorrow|kal|aaj|this week|next week)\b.*\b(anything|plan|plans|appointment|appointments|viewing|viewings|reminder|reminders)\b|今天.*安排|今天.*日程|明天.*安排|本周.*安排|کل.*(?:پلانز|پلان|شیڈول)|(?:پلانز|پلان|شیڈول).*کل/iu.test(
      message
    );
  const hasCreateVerb =
    /\b(schedule\s+(?:a|an|the|viewing|visit|showing|appointment|follow|call|reminder)|create|add|book|set up|arrange|remind me|follow up|call back)\b|创建|新增|安排看房|预约看房|提醒我|跟进/u.test(
      message
    );

  return (hasDateOnlyAgenda || (hasReadVerb && hasScheduleNoun)) && !hasCreateVerb;
}

export function isLeadReplyRequest(message: string) {
  return /reply|respond|message back|whatsapp reply|回复|回消息|回覆|whatapps回复|whatsapp回复/i.test(message);
}

export function isLeadQueryRequest(message: string) {
  return /lead|leads|buyer|buyers|customer|customers|inquir|client|客户|线索|买家|询盘|咨询|跟进哪些|新客户|今日客户|今天.*客户|未跟进/i.test(
    message
  );
}

export function isAnalyticsRequest(message: string) {
  return /\b(?:analytics|stats|statistics|performance|conversion|convert|attribution|clicks?|views?|traffic)\b|渠道表现|统计|数据看板|转化率|点击|访问|流量|归因|哪个渠道|哪个房源|效果最好|表现最好/i.test(
    message
  );
}

export function isLeadCreateRequest(message: string) {
  const hasCreateVerb = /\b(add|create|record|save|new)\b|新增|添加|记录|保存|新建/iu.test(message);
  const hasReadVerb = /\b(show|list|view|check|find|search|which|who|what|any)\b|查看|显示|列出|搜索|哪些|哪个/iu.test(
    message
  );
  const hasPromotionAssetCue =
    /\b(?:lead\s*page|landing\s*page|tracking\s+links?|campaign\s+links?|promotion\s+copy|promot(?:e|ion)|advertis(?:e|ing))\b|推广|宣传|落地页|追踪链接/iu.test(
      message
    );

  return hasCreateVerb && !hasReadVerb && !hasPromotionAssetCue && isLeadQueryRequest(message);
}

export function isLeadStatusRequest(message: string) {
  const hasReadVerb = /\b(show|list|view|check|find|search|which|who|what|any)\b|查看|显示|列出|搜索|哪些|哪个/iu.test(
    message
  );

  if (hasReadVerb) {
    return false;
  }

  return (
    /mark|set|change|update|status|contacted|qualified|closed|lost|hot|cold|标记|改成|状态|已联系|成交|丢失|无效|高意向/i.test(
      message
    ) && isLeadQueryRequest(message)
  );
}

export function isTodayFollowUpsRequest(message: string) {
  const trimmed = message.trim();
  return (
    /^(?:follow[-\s]?up|followups|follow-ups)$/i.test(trimmed) ||
    /who should i follow up today|show today'?s follow[-\s]?ups|today'?s follow[-\s]?ups|any hot leads today|which clients need reply|今天.*跟.*客户|今天.*跟进|今日.*跟进/i.test(
      message
    )
  );
}

export function isLeadFollowUpRecordRequest(message: string) {
  return /sent (?:the )?(?:message|whatsapp)|message sent|mark .*contacted|replied interested|is interested|seems hot|not interested|said no|已发送|已经联系|有兴趣|高意向|不感兴趣|没兴趣/i.test(
    message
  );
}

export function isLeadDetailsUpdateRequest(message: string) {
  const hasUpdateVerb = /\b(change|changed|update|edit|modify|revise|set|correct)\b|修改|更改|改成|调整|编辑|更新/iu.test(
    message
  );
  const hasLeadField = /\b(phone|mobile|number|contact|email|mail|name|buyer name|client name|message|note)\b|电话|手机号|号码|邮箱|姓名|名字|备注|留言/iu.test(
    message
  );

  return hasUpdateVerb && hasLeadField && isLeadQueryRequest(message);
}

export function isLeadListingUpdateRequest(message: string) {
  const hasLead = isLeadQueryRequest(message);
  const hasListing =
    /\b(listing|property|house|home|villa|apartment|flat|penthouse|plot|shop|commercial)\b|这套|这个房源|房源|房子|公寓|地皮|商铺/iu.test(
      message
    );
  const hasRelationVerb =
    /\b(link|attach|associate|connect|assign|move|change|switch|set)\b|关联|绑定|换到|改到|转到|设为|添加到/iu.test(
      message
    );

  return hasLead && hasListing && hasRelationVerb;
}

export function isPromotionRequest(message: string) {
  if (isLeadReplyRequest(message)) {
    return false;
  }

  const hasDirectPromotionCue =
    /promote|promotion|marketing|advertise|campaign|facebook|instagram|portal|推广|宣传|营销|发布文案|渠道文案/i.test(
      message
    );
  const hasExternalChannelPublishCue =
    /\b(?:share|post|publish|send)\b.*\b(?:whats\s*app|whatsapp|wa|facebook|fb|instagram|insta|ig|portal|zameen|olx)\b/i.test(
      message
    ) ||
    /\b(?:whats\s*app|whatsapp|wa|facebook|fb|instagram|insta|ig|portal|zameen|olx)\b.*\b(?:share|post|publish|send)\b/i.test(
      message
    );

  return hasDirectPromotionCue || hasExternalChannelPublishCue;
}

export function isListingUpdateRequest(message: string) {
  const hasUpdateVerb =
    /\b(change|update|edit|modify|revise|set|make|correct|adjust)\b|修改|更改|改成|改为|改到|换成|设为|设成|调整|编辑/iu.test(
      message
    );
  const hasListingTarget =
    /\b(this|current|latest|listing|property|house|home|villa|apartment|flat|penthouse|plot|shop|commercial)\b|这套|这个|刚才|房源|房子|公寓|地皮|商铺/iu.test(
      message
    );
  const hasListingField =
    /\b(price|title|description|city|area|location|type|sale|rent|bed|beds|bedroom|bedrooms|bath|baths|bathroom|bathrooms|feature|features|status)\b|\b\d+(?:\.\d+)?\s*(?:kanal|marla|sqft|sqm)\b|价格|标题|描述|城市|区域|面积|卧室|卫生间|状态|卖|租/iu.test(
      message
    );

  return hasUpdateVerb && hasListingTarget && hasListingField;
}

export function isListingDraftRequest(message: string) {
  const hasListingAction =
    /\b(list|listing|create|draft|publish|sell|sale|rent|lease|property|house|home|villa|apartment|flat|penthouse|plot|shop|commercial)\b|房源|房子|出售|出租|发布|挂牌|公寓|地皮|商铺/u.test(
      message
    );
  const hasPropertyFacts =
    /\b\d+(?:\.\d+)?\s*(?:kanal|marla|sqft|sqm|bed|beds|bedroom|bedrooms|bath|baths|crore|cr|karor|lakh)\b|DHA\s*Phase\s*\d+|Bahria\s*Town|Lakecity|Gulberg|Lahore|Karachi|Islamabad/i.test(
      message
    );

  return hasListingAction && hasPropertyFacts;
}

export function classifyLocalIntent(message: string): LocalIntentKind {
  if (isAnalyticsRequest(message)) {
    return "analytics";
  }

  if (isTodayFollowUpsRequest(message)) {
    return "today_followups";
  }

  if (isPromotionRequest(message)) {
    return "promotion";
  }

  if (isLeadCreateRequest(message)) {
    return "lead_create";
  }

  if (isLeadDetailsUpdateRequest(message)) {
    return "lead_details_update";
  }

  if (isLeadListingUpdateRequest(message)) {
    return "lead_listing_update";
  }

  if (isLeadFollowUpRecordRequest(message)) {
    return "lead_followup_record";
  }

  if (isLeadStatusRequest(message)) {
    return "lead_status_update";
  }

  if (isScheduleQueryRequest(message)) {
    return "schedule_query";
  }

  if (isScheduleRequest(message)) {
    return "schedule_event";
  }

  if (isLeadReplyRequest(message)) {
    return "lead_reply";
  }

  if (isLeadQueryRequest(message)) {
    return "lead_query";
  }

  if (isListingUpdateRequest(message)) {
    return "listing_update";
  }

  if (isListingDraftRequest(message)) {
    return "listing_draft";
  }

  return "general_reply";
}

export function extractLeadName(message: string) {
  const englishMatch = message.match(
    /\b(?:reply to|respond to|message back|message|with|for|follow up|call|remind me to call|to)\s+([\p{L}\p{N}'-]+(?:\s+[\p{L}\p{N}'-]+){0,2})/iu
  );
  const subjectMatch = message.match(
    /^\s*([\p{L}\p{N}'-]+(?:\s+[\p{L}\p{N}'-]+){0,2})\s+(?:replied|is|seems|said|has|有兴趣|不感兴趣|没兴趣)/iu
  );
  const englishName = englishMatch?.[1]
    ?.replace(/\s+\b(?:today|tomorrow|tonight|next|this|at|for|about|on|in|with|my)\b.*$/iu, "")
    .trim();
  const normalizedEnglishName = englishName?.toLowerCase();
  const match =
    (englishName && !/^(?:him|her|them|he|she|they|client|lead|buyer|seller)$/i.test(normalizedEnglishName ?? "")
      ? [, englishName]
      : null) ??
    (subjectMatch?.[1] ? [, subjectMatch[1]] : null) ??
    message.match(/(?:客户|跟进|提醒|回复|回消息)\s*([\p{L}\p{N} ]{2,24})/u);

  const candidate = match?.[1]?.trim();
  if (!candidate || /^\d{1,2}(?::\d{2})?$/u.test(candidate)) {
    return undefined;
  }

  return candidate;
}

export function extractLeadStatus(message: string): LeadStatusPatch {
  if (/lost|无效|丢失/i.test(message)) {
    return { status: "lost" };
  }

  if (/closed|成交/i.test(message)) {
    return { status: "closed" };
  }

  if (/hot|qualified|高意向|强意向/i.test(message)) {
    return { status: "qualified", urgency: "high" };
  }

  if (/contacted|已联系|联系过|跟进过/i.test(message)) {
    return { status: "contacted" };
  }

  if (/\bnew\b|新/i.test(message)) {
    return { status: "new" };
  }

  return { status: "contacted" };
}

export function extractLeadStatusFilter(message: string) {
  if (/new|新/i.test(message)) {
    return "new";
  }

  if (/contacted|已联系/i.test(message)) {
    return "contacted";
  }

  if (/qualified|hot|高意向/i.test(message)) {
    return "qualified";
  }

  if (/closed|成交/i.test(message)) {
    return "closed";
  }

  if (/lost|无效|丢失/i.test(message)) {
    return "lost";
  }

  return "all";
}
