import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const targetUrl = "https://pislaka-agent.vercel.app";
const envText = readFileSync(".env.local", "utf8");
const values = new Map();

for (const line of envText.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    continue;
  }

  const index = line.indexOf("=");
  if (index <= 0) {
    continue;
  }

  values.set(line.slice(0, index), line.slice(index + 1));
}

values.set("NEXT_PUBLIC_APP_URL", targetUrl);

const names = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DEEPSEEK_API_KEY",
  "DEEPSEEK_BASE_URL",
  "DEEPSEEK_MODEL",
  "STT_PROVIDER",
  "OPENAI_API_KEY",
  "OPENAI_TRANSCRIPTION_MODEL",
  "DEEPGRAM_API_KEY",
  "DEEPGRAM_MODEL",
  "DEEPGRAM_LANGUAGE",
  "GOOGLE_STT_API_KEY",
  "NEXT_PUBLIC_APP_URL"
];

const childEnv = { ...process.env };
delete childEnv.VERCEL_TOKEN;

for (const name of names) {
  const value = values.get(name) || "";

  if (!value) {
    console.log(`skip ${name}: empty`);
    continue;
  }

  const result = spawnSync(
    "npx",
    ["vercel", "env", "add", name, "production", "--yes", "--force"],
    {
      input: value,
      encoding: "utf8",
      env: childEnv,
      stdio: ["pipe", "pipe", "pipe"]
    }
  );

  if (result.status !== 0) {
    console.error(`failed ${name}`);
    console.error(
      `${result.stdout || ""}${result.stderr || ""}`
        .split(/\r?\n/)
        .filter((line) => line && !line.includes(value))
        .join("\n")
    );
    process.exit(result.status || 1);
  }

  console.log(`set ${name}`);
}
