import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

function readLocalEnv() {
  return Object.fromEntries(
    fs
      .readFileSync(".env.local", "utf8")
      .split("\n")
      .filter(Boolean)
      .filter((line) => !line.startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      })
  );
}

const env = readLocalEnv();
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const tables = [
  "broker_profiles",
  "conversations",
  "chat_messages",
  "voice_messages",
  "listings",
  "listing_media",
  "campaign_links",
  "click_events",
  "leads",
  "tool_calls",
  "audit_logs"
];

const tableChecks = [];

for (const table of tables) {
  const { error } = await supabase.from(table).select("*", { count: "exact", head: true });
  tableChecks.push({ table, ok: !error, error: error?.message });
}

const bucketChecks = [];

for (const bucket of ["listing-media", "voice-messages"]) {
  const { error } = await supabase.storage.createBucket(bucket, { public: false });
  bucketChecks.push({
    bucket,
    ok: !error || error.message.includes("already exists"),
    error: error?.message
  });
}

console.log(JSON.stringify({ tables: tableChecks, buckets: bucketChecks }, null, 2));
