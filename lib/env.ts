function readEnv(name: string) {
  return process.env[name] ?? "";
}

export const env = {
  supabaseUrl: readEnv("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  supabaseServiceRoleKey: readEnv("SUPABASE_SERVICE_ROLE_KEY"),
  deepseekApiKey: readEnv("DEEPSEEK_API_KEY"),
  deepseekBaseUrl: readEnv("DEEPSEEK_BASE_URL") || "https://api.deepseek.com",
  deepseekModel: readEnv("DEEPSEEK_MODEL") || "deepseek-v4-flash",
  sttProvider: readEnv("STT_PROVIDER") || "openai",
  openaiApiKey: readEnv("OPENAI_API_KEY"),
  openaiTranscriptionModel: readEnv("OPENAI_TRANSCRIPTION_MODEL") || "whisper-1",
  aliyunBailianApiKey: readEnv("ALIYUN_BAILIAN_API_KEY"),
  aliyunBailianBaseUrl: readEnv("ALIYUN_BAILIAN_BASE_URL") || "https://dashscope.aliyuncs.com/compatible-mode/v1",
  aliyunVisionModel: readEnv("ALIYUN_VISION_MODEL") || "qwen-vl-plus",
  deepgramApiKey: readEnv("DEEPGRAM_API_KEY"),
  deepgramModel: readEnv("DEEPGRAM_MODEL") || "nova-3-general",
  deepgramLanguage: readEnv("DEEPGRAM_LANGUAGE") || "multi",
  googleSttApiKey: readEnv("GOOGLE_STT_API_KEY"),
  pakistanHierarchyCheckUrl: readEnv("PAKISTAN_HIERARCHY_CHECK_URL"),
  pakistanHierarchyCheckTimeoutMs: readEnv("PAKISTAN_HIERARCHY_CHECK_TIMEOUT_MS") || "900",
  appUrl: readEnv("NEXT_PUBLIC_APP_URL") || "http://localhost:3000"
};

export function requireServerEnv(name: keyof typeof env) {
  const value = env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}
