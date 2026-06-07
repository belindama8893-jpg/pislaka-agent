export type LocalIntentKind =
  | "lead_create"
  | "lead_reply"
  | "lead_status_update"
  | "lead_details_update"
  | "lead_listing_update"
  | "schedule_event"
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

export function isLeadReplyRequest(message: string) {
  return /reply|respond|message back|whatsapp reply|回复|回消息|回覆|whatapps回复|whatsapp回复/i.test(message);
}

export function isLeadQueryRequest(message: string) {
  return /lead|leads|buyer|buyers|customer|customers|inquir|client|客户|线索|买家|询盘|咨询|跟进哪些|新客户|今日客户|今天.*客户|未跟进/i.test(
    message
  );
}

export function isLeadCreateRequest(message: string) {
  const hasCreateVerb = /\b(add|create|record|save|new)\b|新增|添加|记录|保存|新建/iu.test(message);
  return hasCreateVerb && isLeadQueryRequest(message);
}

export function isLeadStatusRequest(message: string) {
  return (
    /mark|set|change|update|status|contacted|qualified|closed|lost|hot|cold|标记|改成|状态|已联系|成交|丢失|无效|高意向/i.test(
      message
    ) && isLeadQueryRequest(message)
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

  return /promote|promotion|marketing|advertise|campaign|推广|宣传|营销|发布文案|渠道文案/i.test(message);
}

export function isListingUpdateRequest(message: string) {
  const hasUpdateVerb = /\b(change|update|edit|modify|revise|set|make|correct|adjust)\b|修改|更改|改成|调整|编辑/iu.test(
    message
  );
  const hasListingTarget =
    /\b(this|current|latest|listing|property|house|home|villa|apartment|flat|penthouse|plot|shop|commercial)\b|这套|这个|刚才|房源|房子|公寓|地皮|商铺/iu.test(
      message
    );
  const hasListingField =
    /\b(price|title|description|city|area|location|type|sale|rent|bed|beds|bedroom|bedrooms|bath|baths|bathroom|bathrooms|feature|features|status)\b|价格|标题|描述|城市|区域|面积|卧室|卫生间|状态|卖|租/iu.test(
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
  if (isLeadCreateRequest(message)) {
    return "lead_create";
  }

  if (isLeadReplyRequest(message)) {
    return "lead_reply";
  }

  if (isLeadDetailsUpdateRequest(message)) {
    return "lead_details_update";
  }

  if (isLeadListingUpdateRequest(message)) {
    return "lead_listing_update";
  }

  if (isLeadStatusRequest(message)) {
    return "lead_status_update";
  }

  if (isScheduleRequest(message)) {
    return "schedule_event";
  }

  if (isPromotionRequest(message)) {
    return "promotion";
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
  const match =
    message.match(
      /\b(?:reply to|respond to|message back|message|with|for|follow up|call|remind me to call|to)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/
    ) ??
    message.match(/(?:客户|跟进|提醒|回复|回消息)\s*([\p{L}\p{N} ]{2,24})/u);

  return match?.[1]?.trim();
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
