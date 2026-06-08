import { NextResponse } from "next/server";
import { requireCurrentBroker } from "@/lib/auth/current-user";
import { normalizePakistanLocationTerms } from "@/lib/agent/location-normalization";
import { env, requireServerEnv } from "@/lib/env";
import { createServiceClient } from "@/lib/supabase/server";

const voiceBucketName = "voice-messages";
const maxAudioBytes = 24 * 1024 * 1024;

type TranscriptionResult = {
  transcript: string;
  language: string | null;
  confidence: number | null;
  provider: string;
};

function getSafeExtension(fileName: string, fallback: string) {
  const extension = fileName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
  return extension || fallback;
}

function getAudioContentType(file: File) {
  if (file.type.startsWith("audio/")) {
    return file.type;
  }

  if (file.name.endsWith(".webm")) {
    return "audio/webm";
  }

  return "";
}

async function transcribeWithOpenAI(file: File): Promise<TranscriptionResult> {
  const apiKey = requireServerEnv("openaiApiKey");
  const formData = new FormData();
  formData.append("file", file, file.name || "voice-note.webm");
  formData.append("model", env.openaiTranscriptionModel);
  formData.append("response_format", "verbose_json");
  formData.append("temperature", "0");
  formData.append(
    "prompt",
    "The speaker is a real estate broker in Pakistan. They may mix English, Urdu, and Roman Urdu while describing property listings, prices, areas, bedrooms, bathrooms, locations, or promotion instructions."
  );

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`
    },
    body: formData
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      typeof payload?.error?.message === "string"
        ? payload.error.message
        : "Voice transcription failed.";
    throw new Error(message);
  }

  const transcript = typeof payload?.text === "string" ? payload.text.trim() : "";

  if (!transcript) {
    throw new Error("Voice transcription returned empty text.");
  }

  return {
    transcript,
    language: typeof payload?.language === "string" ? payload.language : null,
    confidence: null,
    provider: "openai"
  };
}

function readDeepgramTranscript(payload: unknown) {
  const response = payload as {
    results?: {
      channels?: Array<{
        detected_language?: string;
        language_confidence?: number;
        alternatives?: Array<{
          transcript?: string;
          confidence?: number;
          words?: Array<{
            word?: string;
            punctuated_word?: string;
          }>;
          paragraphs?: {
            transcript?: string;
          };
        }>;
      }>;
    };
  };

  const channel = response.results?.channels?.[0];
  const alternative = channel?.alternatives?.[0];
  const transcript =
    typeof alternative?.transcript === "string" && alternative.transcript.trim()
      ? alternative.transcript.trim()
      : typeof alternative?.paragraphs?.transcript === "string" && alternative.paragraphs.transcript.trim()
        ? alternative.paragraphs.transcript.trim()
        : (alternative?.words ?? [])
            .map((word) => word.punctuated_word || word.word)
            .filter(Boolean)
            .join(" ")
            .trim();

  return {
    transcript,
    language: typeof channel?.detected_language === "string" ? channel.detected_language : null,
    confidence:
      typeof alternative?.confidence === "number"
        ? alternative.confidence
        : typeof channel?.language_confidence === "number"
          ? channel.language_confidence
          : null
  };
}

function getDeepgramAttemptParams(languageMode: string) {
  const params = new URLSearchParams({
    model: env.deepgramModel,
    smart_format: "true",
    numerals: "true",
    paragraphs: "true"
  });

  if (languageMode === "detect") {
    params.set("detect_language", "true");
  } else {
    params.set("language", languageMode);
  }

  return params;
}

function getDeepgramLanguageAttempts() {
  const configuredLanguage = env.deepgramLanguage || "multi";
  const attempts = [configuredLanguage, "detect", "ur", "en"];

  return attempts.filter((language, index) => attempts.indexOf(language) === index);
}

async function callDeepgram(fileBuffer: Buffer, contentType: string, languageMode: string) {
  const apiKey = requireServerEnv("deepgramApiKey");
  const params = getDeepgramAttemptParams(languageMode);

  const response = await fetch(`https://api.deepgram.com/v1/listen?${params.toString()}`, {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": contentType
    },
    body: new Uint8Array(fileBuffer)
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      typeof payload?.err_msg === "string"
        ? payload.err_msg
        : typeof payload?.message === "string"
          ? payload.message
          : "Deepgram transcription failed.";
    throw new Error(message);
  }

  return readDeepgramTranscript(payload);
}

async function transcribeWithDeepgram(fileBuffer: Buffer, contentType: string): Promise<TranscriptionResult> {
  let lastEmptyLanguage = env.deepgramLanguage;

  for (const languageMode of getDeepgramLanguageAttempts()) {
    const parsed = await callDeepgram(fileBuffer, contentType, languageMode);

    if (parsed.transcript) {
      return {
        transcript: parsed.transcript,
        language: parsed.language ?? (languageMode === "detect" ? null : languageMode),
        confidence: parsed.confidence,
        provider: "deepgram"
      };
    }

    lastEmptyLanguage = languageMode;
  }

  throw new Error(`Deepgram transcription returned empty text after retrying ${lastEmptyLanguage}.`);
}

async function transcribeVoice(file: File, fileBuffer: Buffer, contentType: string) {
  if (env.sttProvider === "openai") {
    return transcribeWithOpenAI(file);
  }

  if (env.sttProvider === "deepgram") {
    return transcribeWithDeepgram(fileBuffer, contentType);
  }

  throw new Error(`STT provider "${env.sttProvider}" is not wired yet. Use STT_PROVIDER=openai or deepgram.`);
}

async function trySaveVoiceAudio({
  brokerId,
  contentType,
  durationSeconds,
  fileBuffer,
  fileName,
  transcript,
  language,
  confidence
}: {
  brokerId: string;
  contentType: string;
  durationSeconds: number | null;
  fileBuffer: Buffer;
  fileName: string;
  transcript: string;
  language: string | null;
  confidence: number | null;
}) {
  const service = createServiceClient();
  const extension = getSafeExtension(fileName, "webm");
  const storagePath = `${brokerId}/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await service.storage.from(voiceBucketName).upload(storagePath, fileBuffer, {
    contentType,
    upsert: false
  });

  if (uploadError) {
    return { storagePath: null, voiceMessageId: null, storageError: uploadError.message };
  }

  const { data: voiceMessage, error: voiceMessageError } = await service
    .from("voice_messages")
    .insert({
      broker_id: brokerId,
      audio_url: storagePath,
      duration_seconds: durationSeconds,
      transcript,
      language,
      confidence
    })
    .select("id")
    .single();

  if (voiceMessageError || !voiceMessage) {
    await service.storage.from(voiceBucketName).remove([storagePath]);
    return {
      storagePath: null,
      voiceMessageId: null,
      storageError: voiceMessageError?.message ?? "Unable to save voice message."
    };
  }

  return { storagePath, voiceMessageId: voiceMessage.id as string, storageError: null };
}

export async function POST(request: Request) {
  try {
    const { supabase, broker } = await requireCurrentBroker();
    const formData = await request.formData();
    const file = formData.get("audio");
    const durationValue = formData.get("duration_seconds");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing audio file" }, { status: 400 });
    }

    const contentType = getAudioContentType(file);
    if (!contentType) {
      return NextResponse.json({ error: "Only audio uploads are supported" }, { status: 400 });
    }

    if (file.size > maxAudioBytes) {
      return NextResponse.json({ error: "Voice note is too large. Keep it under 24 MB." }, { status: 400 });
    }

    if (env.sttProvider === "openai" && !env.openaiApiKey) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY for voice transcription." },
        { status: 501 }
      );
    }

    if (env.sttProvider === "deepgram" && !env.deepgramApiKey) {
      return NextResponse.json(
        { error: "Missing DEEPGRAM_API_KEY for voice transcription." },
        { status: 501 }
      );
    }

    const durationSeconds =
      typeof durationValue === "string" && durationValue
        ? Math.max(1, Math.round(Number(durationValue)))
        : null;
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const transcription = await transcribeVoice(file, fileBuffer, contentType);
    const locationContext = await normalizePakistanLocationTerms(transcription.transcript);
    const storage = await trySaveVoiceAudio({
      brokerId: broker.id,
      contentType,
      durationSeconds,
      fileBuffer,
      fileName: file.name || "voice-note.webm",
      transcript: transcription.transcript,
      language: transcription.language,
      confidence: transcription.confidence
    });

    await supabase.from("audit_logs").insert({
      broker_id: broker.id,
      actor_type: "agent",
      action: "transcribe_voice",
      entity_type: storage.voiceMessageId ? "voice_message" : "voice_transcription",
      entity_id: storage.voiceMessageId,
      after_payload: {
        transcript: transcription.transcript,
        language: transcription.language,
        provider: transcription.provider,
        location_context: locationContext,
        storage_path: storage.storagePath,
        storage_error: storage.storageError
      },
      metadata: {
        duration_seconds: durationSeconds,
        file_size: file.size,
        content_type: contentType
      }
    });

    return NextResponse.json({
      transcript: transcription.transcript,
      language: transcription.language,
      confidence: transcription.confidence,
      provider: transcription.provider,
      location_context: locationContext,
      voice_message_id: storage.voiceMessageId,
      storage_saved: Boolean(storage.voiceMessageId),
      storage_error: storage.storageError
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}
