import { detectAgentResponseLanguage, type AgentResponseLanguage } from "@/lib/agent/response-language";
import { detectExplicitUiLanguagePreference } from "@/lib/agent/agent-preferences";

export type AgentCopyLanguage = AgentResponseLanguage;

export function detectExplicitResponseLanguage(message: string): AgentCopyLanguage | null {
  return detectExplicitUiLanguagePreference(message);
}

export async function detectTurnUiLanguage(
  messageText: string,
  files: Array<{ kind?: string; file: File }>,
  preferredLanguage?: AgentCopyLanguage | null
): Promise<AgentCopyLanguage> {
  const explicitLanguage = detectExplicitResponseLanguage(messageText);
  if (explicitLanguage) {
    return explicitLanguage;
  }

  if (preferredLanguage) {
    return preferredLanguage;
  }

  if (messageText.trim()) {
    return detectAgentResponseLanguage(messageText);
  }

  const textFile = files.find((item) => item.kind === "whatsapp_chat" && item.file.name.toLowerCase().endsWith(".txt"));
  if (textFile) {
    try {
      const sample = (await textFile.file.text()).slice(0, 8000);
      return detectAgentResponseLanguage(sample);
    } catch {
      return "english";
    }
  }

  return "english";
}

export function getCardLanguage(sourceMessage?: string, uiLanguage?: AgentCopyLanguage): AgentCopyLanguage {
  if (
    sourceMessage === "english" ||
    sourceMessage === "urdu" ||
    sourceMessage === "roman_urdu" ||
    sourceMessage === "chinese"
  ) {
    return sourceMessage;
  }

  return uiLanguage ?? detectAgentResponseLanguage(sourceMessage ?? "");
}

export function getWhatsAppImportProgressCopy(language: AgentCopyLanguage) {
  if (language === "urdu") {
    return [
      "ٹھیک ہے۔ میں WhatsApp chat file پڑھ رہا ہوں۔",
      "میں customer، phone، intent، اور follow-up signals نکال رہا ہوں۔",
      "میں اس chat کو recent leads سے match کر رہا ہوں۔",
      "Chat history ابھی process ہو رہی ہے۔ نتیجہ یہاں shortly دکھاؤں گا۔"
    ];
  }

  if (language === "chinese") {
    return [
      "收到。我正在读取 WhatsApp 聊天文件。",
      "我正在提取客户、电话、意图和跟进信号。",
      "我正在把这段聊天和最近的线索做匹配。",
      "聊天记录还在处理，我会很快在这里显示结果。"
    ];
  }

  if (language === "roman_urdu") {
    return [
      "Theek hai. Main WhatsApp chat file parh raha hun.",
      "Main customer, phone, intent, aur follow-up signals nikal raha hun.",
      "Main is chat ko recent leads se match kar raha hun.",
      "Chat history abhi process ho rahi hai. Result yahin shortly dikha dunga."
    ];
  }

  return [
    "Got it. I am reading the WhatsApp chat file.",
    "I am extracting the customer, phone, intent, and follow-up signals.",
    "I am matching this chat against recent leads before suggesting the next step.",
    "Still processing the chat history. I will show the result here shortly."
  ];
}

export function getLeadCardCopy(language: AgentCopyLanguage) {
  if (language === "urdu") {
    return {
      title: "میچنگ لیڈز",
      listingNotSet: "لسٹنگ سیٹ نہیں",
      via: "بذریعہ",
      noPhone: "فون نہیں",
      unnamedBuyer: "بے نام خریدار",
      select: "منتخب کریں",
      selected: "منتخب ہو گیا",
      empty: "حالیہ ان باکس میں کوئی میچنگ لیڈ نہیں ملی۔",
      statuses: {
        new: "نئی",
        contacted: "رابطہ ہو چکا",
        qualified: "دلچسپی رکھتا ہے",
        hot: "ہاٹ لیڈ",
        closed: "بند",
        lost: "دلچسپی نہیں"
      }
    };
  }

  if (language === "roman_urdu") {
    return {
      title: "Matching leads",
      listingNotSet: "Listing set nahi",
      via: "via",
      noPhone: "No phone",
      unnamedBuyer: "Unnamed buyer",
      select: "Select",
      selected: "Selected",
      empty: "Recent inbox mein koi matching lead nahi mili.",
      statuses: {
        new: "New",
        contacted: "Contacted",
        qualified: "Interested",
        hot: "Hot lead",
        closed: "Closed",
        lost: "Not interested"
      }
    };
  }

  if (language === "chinese") {
    return {
      title: "匹配线索",
      listingNotSet: "未设置房源",
      via: "来自",
      noPhone: "无电话",
      unnamedBuyer: "未命名买家",
      select: "选择",
      selected: "已选择",
      empty: "最近收件箱里没有匹配的线索。",
      statuses: {
        new: "新线索",
        contacted: "已联系",
        qualified: "有意向",
        hot: "高意向",
        closed: "已成交",
        lost: "不感兴趣"
      }
    };
  }

  return {
    title: "Matching leads",
    listingNotSet: "Listing not set",
    via: "via",
    noPhone: "No phone",
    unnamedBuyer: "Unnamed buyer",
    select: "Select",
    selected: "Selected",
    empty: "No matching leads found in the recent inbox.",
    statuses: {
      new: "New",
      contacted: "Contacted",
      qualified: "Interested",
      hot: "Hot lead",
      closed: "Closed",
      lost: "Not interested"
    }
  };
}

export function getScheduleCardCopy(language: AgentCopyLanguage) {
  if (language === "urdu") {
    return {
      title: "شیڈول آئٹمز",
      empty: "کوئی میچنگ شیڈول آئٹم نہیں ملا۔",
      eventTypes: {
        viewing: "وزٹ",
        contract_signing: "معاہدے پر دستخط",
        handover: "حوالگی",
        follow_up: "فالو اپ",
        offer_deadline: "آفر کی آخری تاریخ",
        document_expiry: "دستاویز کی میعاد",
        weekly_review: "ہفتہ وار جائزہ",
        monthly_client_review: "ماہانہ کلائنٹ جائزہ",
        custom: "کسٹم"
      }
    };
  }

  if (language === "roman_urdu") {
    return {
      title: "Schedule items",
      empty: "Koi matching schedule item nahi mila.",
      eventTypes: {
        viewing: "Viewing",
        contract_signing: "Contract signing",
        handover: "Handover",
        follow_up: "Follow-up",
        offer_deadline: "Offer deadline",
        document_expiry: "Document expiry",
        weekly_review: "Weekly review",
        monthly_client_review: "Monthly client review",
        custom: "Custom"
      }
    };
  }

  if (language === "chinese") {
    return {
      title: "日程",
      empty: "没有匹配的日程。",
      eventTypes: {
        viewing: "看房",
        contract_signing: "签约",
        handover: "交房",
        follow_up: "跟进",
        offer_deadline: "报价截止",
        document_expiry: "文件到期",
        weekly_review: "每周复盘",
        monthly_client_review: "每月客户复盘",
        custom: "自定义"
      }
    };
  }

  return {
    title: "Schedule items",
    empty: "No matching schedule items.",
    eventTypes: {
      viewing: "viewing",
      contract_signing: "contract signing",
      handover: "handover",
      follow_up: "follow up",
      offer_deadline: "offer deadline",
      document_expiry: "document expiry",
      weekly_review: "weekly review",
      monthly_client_review: "monthly client review",
      custom: "custom"
    }
  };
}

export function getAgentCardCopy(language: AgentCopyLanguage) {
  const lead = getLeadCardCopy(language);
  const schedule = getScheduleCardCopy(language);

  if (language === "urdu") {
    return {
      lead,
      schedule,
      buttons: {
        addMore: "مزید شامل کریں",
        addMedia: "تصاویر / ویڈیو شامل کریں",
        askAgent: "ایجنٹ سے پوچھیں",
        confirmAdd: "کنفرم کر کے شامل کریں",
        confirmBatchUpdate: "بیچ اپ ڈیٹ کنفرم کریں",
        confirmListing: "لسٹنگ کنفرم کریں",
        confirmSave: "کنفرم کر کے محفوظ کریں",
        confirmSchedule: "شیڈول کنفرم کریں",
        confirmUpdate: "اپ ڈیٹ کنفرم کریں",
        continueWithoutBinding: "بائنڈ کیے بغیر جاری رکھیں",
        continued: "جاری رکھا",
        copy: "کاپی",
        copied: "کاپی ہو گیا",
        editCard: "کارڈ ایڈٹ کریں",
        generatePromotionPack: "پروموشن پیک بنائیں",
        generated: "بن گیا",
        generating: "بن رہا ہے...",
        openListing: "لسٹنگ کھولیں",
        openWhatsApp: "WhatsApp کھولیں",
        promoteListing: "لسٹنگ پروموٹ کریں",
        preview: "پری ویو",
        saved: "محفوظ ہو گیا",
        saving: "محفوظ ہو رہا ہے...",
        select: "منتخب کریں",
        selected: "منتخب ہو گیا",
        shareToWhatsApp: "WhatsApp پر شیئر کریں",
        showLatestLead: "تازہ ترین لیڈ دکھائیں",
        shown: "دکھا دیا",
        updated: "اپ ڈیٹ ہو گیا",
        updating: "اپ ڈیٹ ہو رہا ہے..."
      },
      generic: {
        areaNotSet: "ایریا سیٹ نہیں",
        baths: "باتھ",
        beds: "بیڈ",
        chooseLead: "لیڈ منتخب کریں",
        chooseListing: "لسٹنگ منتخب کریں",
        chooseListingToUpdate: "اپ ڈیٹ کے لیے لسٹنگ منتخب کریں",
        copiedToClipboard: "کلپ بورڈ میں کاپی ہو گیا",
        confirmBatchUpdate: "بیچ اپ ڈیٹ کنفرم کریں",
        confirmLeadDetails: "لیڈ تفصیلات کنفرم کریں",
        confirmLeadListing: "لیڈ لسٹنگ کنفرم کریں",
        confirmLeadUpdate: "لیڈ اپ ڈیٹ کنفرم کریں",
        confirmListingUpdate: "لسٹنگ اپ ڈیٹ کنفرم کریں",
        confirmNewLead: "نئی لیڈ کنفرم کریں",
        fieldArea: "ایریا",
        fieldAreaSize: "ایریا سائز",
        fieldBaths: "باتھ",
        fieldBeds: "بیڈ",
        fieldCity: "شہر",
        fieldCurrency: "کرنسی",
        fieldDescription: "تفصیل",
        fieldEmail: "ای میل",
        fieldFeatures: "فیچرز",
        fieldIntent: "ارادہ",
        fieldMessage: "پیغام",
        fieldName: "نام",
        fieldPhone: "فون",
        fieldPrice: "قیمت",
        fieldPropertyType: "پراپرٹی ٹائپ",
        fieldStatus: "اسٹیٹس",
        fieldTitle: "عنوان",
        followUpRecord: "فالو اپ ریکارڈ",
        listingPreview: "لسٹنگ پری ویو",
        listingSaved: "لسٹنگ محفوظ ہو گئی",
        locationNotSet: "لوکیشن سیٹ نہیں",
        manageFollowUp: "فالو اپ مینیج کریں",
        mediaFiles: "میڈیا فائلز",
        noMediaAdded: "کوئی میڈیا شامل نہیں",
        noNotes: "ابھی کوئی نوٹ نہیں۔",
        noPrimaryListing: "پرائمری لسٹنگ نہیں",
        notDetected: "ڈیٹیکٹ نہیں ہوا",
        notMatched: "میچ نہیں ہوا",
        primaryListing: "پرائمری لسٹنگ",
        promotionPack: "پروموشن پیک",
        promotionTarget: "پروموشن ٹارگٹ",
        draftReply: "جواب ڈرافٹ کریں",
        savedListing: "محفوظ لسٹنگ",
        schedulePreview: "شیڈول پری ویو",
        untitledListing: "بے عنوان لسٹنگ",
        whatsappReplyDraft: "WhatsApp جواب کا ڈرافٹ"
      },
      hints: {
        chooseChannels: "چینلز منتخب کریں، پھر پروموشن پیک بنائیں۔",
        confirmLeadListing: "اس لیڈ کی پرائمری لسٹنگ بدلنے سے پہلے کنفرم کریں۔",
        confirmLeadUpdate: "اس لیڈ کو اپ ڈیٹ کرنے سے پہلے کنفرم کریں۔",
        confirmNewLead: "اس لیڈ کو محفوظ کرنے سے پہلے کنفرم کریں۔",
        editSchedule: "محفوظ کرنے سے پہلے وقت ایڈٹ کریں۔",
        listingUpdate: "لسٹنگ تبدیلیاں ریویو کریں، پھر کنفرم کریں۔",
        reviewLeadFields: "بدلے ہوئے فیلڈز ریویو کریں، پھر کنفرم کریں۔",
        reviewListing: "محفوظ کرنے سے پہلے اہم لسٹنگ تفصیلات ریویو کریں۔",
        reviewSchedule: "شیڈول آئٹم شامل کرنے سے پہلے ریویو کریں۔",
        selectListing: "جاری رکھنے کے لیے ایک لسٹنگ منتخب کریں۔",
        selectRecord: "جاری رکھنے کے لیے ایک ریکارڈ منتخب کریں۔"
      }
    };
  }

  if (language === "chinese") {
    return {
      lead,
      schedule,
      buttons: {
        addMore: "继续添加",
        addMedia: "添加图片 / 视频",
        askAgent: "问 Agent",
        confirmAdd: "确认并添加",
        confirmBatchUpdate: "确认批量更新",
        confirmListing: "确认房源",
        confirmSave: "确认并保存",
        confirmSchedule: "确认日程",
        confirmUpdate: "确认更新",
        continueWithoutBinding: "不绑定继续",
        continued: "已继续",
        copy: "复制",
        copied: "已复制",
        editCard: "编辑卡片",
        generatePromotionPack: "生成推广包",
        generated: "已生成",
        generating: "生成中...",
        openListing: "打开房源",
        openWhatsApp: "打开 WhatsApp",
        promoteListing: "推广房源",
        preview: "预览",
        saved: "已保存",
        saving: "保存中...",
        select: "选择",
        selected: "已选择",
        shareToWhatsApp: "分享到 WhatsApp",
        showLatestLead: "查看最新线索",
        shown: "已显示",
        updated: "已更新",
        updating: "更新中..."
      },
      generic: {
        areaNotSet: "未设置面积",
        baths: "卫浴",
        beds: "卧室",
        chooseLead: "选择线索",
        chooseListing: "选择房源",
        chooseListingToUpdate: "选择要更新的房源",
        copiedToClipboard: "已复制到剪贴板",
        confirmBatchUpdate: "确认批量更新",
        confirmLeadDetails: "确认线索详情",
        confirmLeadListing: "确认线索房源",
        confirmLeadUpdate: "确认线索更新",
        confirmListingUpdate: "确认房源更新",
        confirmNewLead: "确认新线索",
        fieldArea: "区域",
        fieldAreaSize: "面积",
        fieldBaths: "卫浴",
        fieldBeds: "卧室",
        fieldCity: "城市",
        fieldCurrency: "币种",
        fieldDescription: "描述",
        fieldEmail: "邮箱",
        fieldFeatures: "特点",
        fieldIntent: "意图",
        fieldMessage: "消息",
        fieldName: "姓名",
        fieldPhone: "电话",
        fieldPrice: "价格",
        fieldPropertyType: "房源类型",
        fieldStatus: "状态",
        fieldTitle: "标题",
        followUpRecord: "跟进记录",
        listingPreview: "房源预览",
        listingSaved: "房源已保存",
        locationNotSet: "未设置位置",
        manageFollowUp: "管理跟进",
        mediaFiles: "媒体文件",
        noMediaAdded: "未添加媒体",
        noNotes: "暂无备注。",
        noPrimaryListing: "无主房源",
        notDetected: "未识别",
        notMatched: "未匹配",
        primaryListing: "主房源",
        promotionPack: "推广包",
        promotionTarget: "推广目标",
        draftReply: "起草回复",
        savedListing: "已保存房源",
        schedulePreview: "日程预览",
        untitledListing: "未命名房源",
        whatsappReplyDraft: "WhatsApp 回复草稿"
      },
      hints: {
        chooseChannels: "选择渠道后生成推广包。",
        confirmLeadListing: "更改这条线索的主房源前请确认。",
        confirmLeadUpdate: "更新这条线索前请确认。",
        confirmNewLead: "保存这条线索前请确认。",
        editSchedule: "保存前请编辑时间。",
        listingUpdate: "检查房源变更后确认。",
        reviewLeadFields: "检查变更字段后确认。",
        reviewListing: "添加到房源库前请检查主要信息。",
        reviewSchedule: "添加日程前请检查。",
        selectListing: "选择一个房源继续。",
        selectRecord: "选择一条记录继续。"
      }
    };
  }

  return {
    lead,
    schedule,
    buttons: {
      addMore: "Add more",
      addMedia: "Add photos / video",
      askAgent: "Ask Agent",
      confirmAdd: "Confirm & add",
      confirmBatchUpdate: "Confirm batch update",
      confirmListing: "Confirm listing",
      confirmSave: "Confirm & save",
      confirmSchedule: "Confirm schedule",
      confirmUpdate: "Confirm update",
      continueWithoutBinding: language === "roman_urdu" ? "Binding ke baghair continue" : "Continue without binding",
      continued: language === "roman_urdu" ? "Continued" : "Continued",
      copy: "Copy",
      copied: "Copied",
      editCard: "Edit card",
      generatePromotionPack: "Generate promotion pack",
      generated: "Generated",
      generating: "Generating...",
      openListing: "Open listing",
      openWhatsApp: "Open WhatsApp",
      promoteListing: language === "roman_urdu" ? "Listing promote karein" : "Promote listing",
      preview: "Preview",
      saved: "Saved",
      saving: "Saving...",
      select: "Select",
      selected: "Selected",
      shareToWhatsApp: "Share to WhatsApp",
      showLatestLead: "View latest lead",
      shown: "Shown",
      updated: "Updated",
      updating: "Updating..."
    },
    generic: {
      areaNotSet: language === "roman_urdu" ? "Area set nahi" : "Area not set",
      baths: "baths",
      beds: "beds",
      chooseLead: "Choose lead",
      chooseListing: "Choose listing",
      chooseListingToUpdate: "Choose listing to update",
      copiedToClipboard: "Copied to clipboard",
      confirmBatchUpdate: "Confirm batch update",
      confirmLeadDetails: "Confirm lead details",
      confirmLeadListing: "Confirm lead listing",
      confirmLeadUpdate: "Confirm lead update",
      confirmListingUpdate: "Confirm listing update",
      confirmNewLead: "Confirm new lead",
      fieldArea: "Area",
      fieldAreaSize: "Area size",
      fieldBaths: "Baths",
      fieldBeds: "Beds",
      fieldCity: "City",
      fieldCurrency: "Currency",
      fieldDescription: "Description",
      fieldEmail: "Email",
      fieldFeatures: "Features",
      fieldIntent: "Intent",
      fieldMessage: "Message",
      fieldName: "Name",
      fieldPhone: "Phone",
      fieldPrice: "Price",
      fieldPropertyType: "Property type",
      fieldStatus: "Status",
      fieldTitle: "Title",
      followUpRecord: "Follow-up record",
      listingPreview: "Listing preview",
      listingSaved: "Listing saved",
      locationNotSet: language === "roman_urdu" ? "Location set nahi" : "Location not set",
      manageFollowUp: language === "roman_urdu" ? "Follow-up manage karein" : "Manage follow-up",
      mediaFiles: "media files",
      noMediaAdded: "No media added",
      noNotes: language === "roman_urdu" ? "Abhi notes nahi." : "No notes yet.",
      noPrimaryListing: "No primary listing",
      notDetected: language === "roman_urdu" ? "Detect nahi hua" : "Not detected",
      notMatched: language === "roman_urdu" ? "Match nahi hua" : "Not matched",
      primaryListing: "Primary listing",
      promotionPack: "Promotion pack",
      promotionTarget: "Promotion target",
      draftReply: language === "roman_urdu" ? "Reply draft karein" : "Draft reply",
      savedListing: "Saved listing",
      schedulePreview: "Schedule preview",
      untitledListing: "Untitled listing",
      whatsappReplyDraft: "WhatsApp reply draft"
    },
    hints: {
      chooseChannels: "Choose channels, then generate the promotion pack.",
      confirmLeadListing: "Confirm before I change this lead's primary listing.",
      confirmLeadUpdate: "Confirm before I update this lead.",
      confirmNewLead: "Confirm before I save this lead.",
      editSchedule: "Edit the timing before saving.",
      listingUpdate: "Review the listing changes, then confirm.",
      reviewLeadFields: "Review the changed fields, then confirm.",
      reviewListing: "Review the key listing details before adding it to your library.",
      reviewSchedule: "Review the schedule item before adding it.",
      selectListing: "Select one listing to continue.",
      selectRecord: "Select one record to continue."
    }
  };
}
