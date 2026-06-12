import { NextResponse } from "next/server";
import { z } from "zod";
import { generateChatFollowUpSummary, normalizeWhatsAppChatText } from "@/lib/leads/followup-import";
import { requireCurrentBroker } from "@/lib/auth/current-user";
import { getRecentLeadsForBroker, leadBaseSelect } from "@/lib/leads/queries";
import type { LeadListItem, LeadRecord } from "@/lib/leads/types";
import {
  chooseZipTextCandidate,
  listZipTextCandidates,
  readZipTextFile,
  type ZipTextCandidate
} from "@/lib/leads/whatsapp-zip";
import type { AgentResponseLanguage } from "@/lib/agent/response-language";

const jsonImportSchema = z.object({
  source_type: z.enum(["whatsapp_paste", "whatsapp_txt_upload", "whatsapp_zip_upload"]).default("whatsapp_paste"),
  text: z.string().min(1).max(2_000_000),
  lead_id: z.string().uuid().optional(),
  broker_display_language: z.enum(["english", "urdu", "roman_urdu", "chinese"]).optional(),
  save_original_chat_text: z.boolean().default(false)
});

type ParsedChatImport =
  | {
      source_type: "whatsapp_paste" | "whatsapp_txt_upload" | "whatsapp_zip_upload";
      text: string;
      lead_id?: string;
      broker_display_language?: AgentResponseLanguage;
      save_original_chat_text: boolean;
    }
  | {
      needs_txt_selection: true;
      source_type: "whatsapp_zip_upload";
      lead_id?: string;
      broker_display_language?: AgentResponseLanguage;
      save_original_chat_text: boolean;
      txt_candidates: ZipTextCandidate[];
    };

function parseDisplayLanguage(value: FormDataEntryValue | null): AgentResponseLanguage | undefined {
  return value === "english" || value === "urdu" || value === "roman_urdu" || value === "chinese" ? value : undefined;
}

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

function scoreLead(query: string, lead: LeadListItem) {
  const normalizedQuery = normalizeText(query);
  const queryPhone = normalizePhone(query);
  const leadPhone = normalizePhone(lead.phone);
  const leadName = normalizeText(lead.full_name);
  const searchable = normalizeText(
    [lead.full_name, lead.phone, lead.email, lead.message, lead.ai_summary, lead.listing_title, lead.listing_area]
      .filter(Boolean)
      .join(" ")
  );
  let score = 0;

  if (queryPhone && leadPhone && leadPhone.includes(queryPhone)) {
    score += queryPhone.length >= 7 ? 30 : 12;
  }

  if (leadName && normalizedQuery.includes(leadName)) {
    score += 18;
  }

  for (const token of new Set(normalizedQuery.split(" ").filter((part) => part.length > 2))) {
    if (searchable.includes(token)) {
      score += token.length >= 5 ? 4 : 2;
    }
  }

  return score;
}

async function readTxtFile(file: File) {
  if (file.size > 2_000_000) {
    throw new Error("TXT file is too large. Please upload a WhatsApp chat text file under 2MB.");
  }

  return file.text();
}

async function readZipFile(file: File, selectedTxtName: string | null) {
  if (file.size > 20_000_000) {
    throw new Error("Zip file is too large. Please upload a WhatsApp export under 20MB.");
  }

  const bytes = await file.arrayBuffer();
  const candidates = listZipTextCandidates(bytes);

  if (!candidates.length) {
    throw new Error("No .txt chat file found in this zip. Upload the WhatsApp chat .txt or paste the text.");
  }

  if (selectedTxtName) {
    return {
      text: readZipTextFile(bytes, selectedTxtName),
      txt_candidates: candidates
    };
  }

  const chosen = chooseZipTextCandidate(candidates);
  if (!chosen) {
    return {
      needs_txt_selection: true as const,
      txt_candidates: candidates
    };
  }

  return {
    text: readZipTextFile(bytes, chosen.name),
    txt_candidates: candidates
  };
}

async function parseRequest(request: Request): Promise<ParsedChatImport> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const sourceType = String(formData.get("source_type") ?? "whatsapp_txt_upload");
    const leadId = formData.get("lead_id");
    const brokerDisplayLanguage = parseDisplayLanguage(formData.get("broker_display_language"));
    const selectedTxtName = formData.get("selected_txt_name");
    const saveOriginal = formData.get("save_original_chat_text") === "true";
    const pastedText = formData.get("text");
    const file = formData.get("file");

    if (sourceType === "whatsapp_paste" && typeof pastedText === "string" && pastedText.trim()) {
      return {
        source_type: "whatsapp_paste" as const,
        text: pastedText,
        lead_id: typeof leadId === "string" && leadId ? leadId : undefined,
        broker_display_language: brokerDisplayLanguage,
        save_original_chat_text: saveOriginal
      };
    }

    if (!(file instanceof File)) {
      throw new Error("Please paste chat text or upload a .txt file.");
    }

    const fileName = file.name.toLowerCase();
    if (sourceType === "whatsapp_zip_upload" || fileName.endsWith(".zip")) {
      const zipResult = await readZipFile(file, typeof selectedTxtName === "string" ? selectedTxtName : null);

      if ("needs_txt_selection" in zipResult) {
        return {
          needs_txt_selection: true,
          source_type: "whatsapp_zip_upload",
          lead_id: typeof leadId === "string" && leadId ? leadId : undefined,
          broker_display_language: brokerDisplayLanguage,
          save_original_chat_text: saveOriginal,
          txt_candidates: zipResult.txt_candidates
        };
      }

      return {
        source_type: "whatsapp_zip_upload" as const,
        text: zipResult.text,
        lead_id: typeof leadId === "string" && leadId ? leadId : undefined,
        broker_display_language: brokerDisplayLanguage,
        save_original_chat_text: saveOriginal
      };
    }

    if (!fileName.endsWith(".txt")) {
      throw new Error("Please upload a WhatsApp .txt export or .zip export.");
    }

    return {
      source_type: "whatsapp_txt_upload" as const,
      text: await readTxtFile(file),
      lead_id: typeof leadId === "string" && leadId ? leadId : undefined,
      broker_display_language: brokerDisplayLanguage,
      save_original_chat_text: saveOriginal
    };
  }

  const body = await request.json();
  const parsed = jsonImportSchema.safeParse(body);

  if (!parsed.success) {
    throw new Error("Invalid WhatsApp chat import payload.");
  }

  return parsed.data;
}

function resolveImportedChatLead(
  leads: LeadListItem[],
  query: string,
  detectedName: string | null,
  detectedPhone: string | null
) {
  const matchQuery = [detectedPhone, detectedName].filter(Boolean).join(" ") || query.slice(0, 1000);
  const scoredLeads = leads
    .map((lead) => ({ lead, score: scoreLead(matchQuery, lead) }))
    .filter((item) => item.score >= 8)
    .sort((left, right) => right.score - left.score);
  const [best, second] = scoredLeads;

  if (!best) {
    return {
      resolution_status: "no_match" as const,
      matched_lead: null,
      candidate_leads: []
    };
  }

  if (second && (best.score === second.score || best.score - second.score < 5)) {
    return {
      resolution_status: "ambiguous" as const,
      matched_lead: null,
      candidate_leads: scoredLeads.slice(0, 5).map((item) => item.lead)
    };
  }

  return {
    resolution_status: "matched" as const,
    matched_lead: best.lead,
    candidate_leads: []
  };
}

export async function POST(request: Request) {
  try {
    const { supabase, broker } = await requireCurrentBroker();
    const parsed = await parseRequest(request);
    if ("needs_txt_selection" in parsed) {
      return NextResponse.json({
        needs_txt_selection: true,
        source_type: parsed.source_type,
        txt_candidates: parsed.txt_candidates
      });
    }

    const cleanedText = normalizeWhatsAppChatText(parsed.text);

    if (!cleanedText.trim()) {
      return NextResponse.json({ error: "No readable WhatsApp chat text found." }, { status: 400 });
    }

    const selectedLeadResult = parsed.lead_id
      ? await supabase
          .from("leads")
          .select(leadBaseSelect)
          .eq("id", parsed.lead_id)
          .eq("broker_id", broker.id)
          .maybeSingle()
      : { data: null };
    const selectedLead = selectedLeadResult.data as LeadRecord | null;
    const leads = await getRecentLeadsForBroker(supabase, broker.id, 100, { includeClosed: true });
    const selectedLeadListItem = selectedLead
      ? leads.find((lead) => lead.id === selectedLead.id) ?? null
      : null;
    const summary = await generateChatFollowUpSummary({
      text: cleanedText,
      lead: selectedLeadListItem,
      displayLanguage: parsed.broker_display_language
    });
    const resolution = selectedLeadListItem
      ? {
          resolution_status: "matched" as const,
          matched_lead: selectedLeadListItem,
          candidate_leads: []
        }
      : resolveImportedChatLead(leads, cleanedText, summary.detected_customer_name, summary.detected_phone);

    return NextResponse.json({
      source_type: parsed.source_type,
      save_original_chat_text: parsed.save_original_chat_text,
      original_chat_text: parsed.save_original_chat_text ? cleanedText : null,
      ...resolution,
      ...summary,
      preview_card_payload: {
        source_type: parsed.source_type,
        save_original_chat_text: parsed.save_original_chat_text,
        original_chat_text: parsed.save_original_chat_text ? cleanedText : null,
        ...resolution,
        ...summary
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message === "Unauthorized" ? 401 : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
