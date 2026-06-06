export type LocalIntentKind =
  | "lead_reply"
  | "lead_status_update"
  | "schedule_event"
  | "lead_query"
  | "promotion"
  | "listing_draft";

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

export function isLeadStatusRequest(message: string) {
  return (
    /mark|set|change|update|status|contacted|qualified|closed|lost|hot|cold|标记|改成|状态|已联系|成交|丢失|无效|高意向/i.test(
      message
    ) && isLeadQueryRequest(message)
  );
}

export function isPromotionRequest(message: string) {
  if (isLeadReplyRequest(message)) {
    return false;
  }

  return /promote|promotion|marketing|advertise|campaign|推广|宣传|营销|发布文案|渠道文案/i.test(message);
}

export function classifyLocalIntent(message: string): LocalIntentKind {
  if (isLeadReplyRequest(message)) {
    return "lead_reply";
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

  return "listing_draft";
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
