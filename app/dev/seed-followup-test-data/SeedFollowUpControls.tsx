"use client";

import Link from "next/link";
import { useState } from "react";

type SeedScenario = "primary" | "reactivate";

type SeedResponse = {
  scenario?: SeedScenario;
  listings?: string[];
  leads?: string[];
  next_steps?: string[];
  error?: string;
};

export function SeedFollowUpControls() {
  const [isLoading, setIsLoading] = useState<SeedScenario | null>(null);
  const [result, setResult] = useState<SeedResponse | null>(null);

  async function seedScenario(scenario: SeedScenario) {
    setIsLoading(scenario);
    setResult(null);

    const response = await fetch("/api/dev/seed-followup-test-data", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ scenario })
    });
    const payload = (await response.json().catch(() => null)) as SeedResponse | null;

    if (response.ok) {
      window.localStorage.setItem("pislaka_followup_seed_mode", "followup-test");
      window.localStorage.setItem("pislaka_followup_seed_scenario", scenario);
    }

    setResult(payload ?? { error: response.ok ? "Seed completed, but no response was returned." : "Unable to seed test data." });
    setIsLoading(null);
  }

  function clearTestMode() {
    window.localStorage.removeItem("pislaka_followup_seed_mode");
    window.localStorage.removeItem("pislaka_followup_seed_scenario");
    setResult({
      next_steps: ["Test mode cleared. Agent Chat will use all broker leads again."]
    });
  }

  return (
    <>
      <section style={{ display: "grid", gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>Primary workflow</h2>
        <p style={{ margin: 0, color: "#64748b", lineHeight: 1.5 }}>
          Creates test listings plus first-reply and open-request leads. Optional check-in data is
          also seeded, but should not appear because primary work exists.
        </p>
        <button
          disabled={Boolean(isLoading)}
          onClick={() => void seedScenario("primary")}
          style={{ justifySelf: "start", padding: "10px 14px" }}
          type="button"
        >
          {isLoading === "primary" ? "Seeding..." : "Seed primary scenario"}
        </button>
      </section>
      <section style={{ display: "grid", gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>Reactivation fallback</h2>
        <p style={{ margin: 0, color: "#64748b", lineHeight: 1.5 }}>
          Replaces the seed data with only optional check-in leads, so you can verify the third
          lane appears only when the first two lanes are empty.
        </p>
        <button
          disabled={Boolean(isLoading)}
          onClick={() => void seedScenario("reactivate")}
          style={{ justifySelf: "start", padding: "10px 14px" }}
          type="button"
        >
          {isLoading === "reactivate" ? "Seeding..." : "Seed reactivation scenario"}
        </button>
      </section>
      <button
        disabled={Boolean(isLoading)}
        onClick={clearTestMode}
        style={{ justifySelf: "start", padding: "8px 12px" }}
        type="button"
      >
        Clear test mode
      </button>
      {result ? (
        <section
          style={{
            display: "grid",
            gap: 10,
            padding: 16,
            background: result.error ? "#fef2f2" : "#f8fafc",
            border: `1px solid ${result.error ? "#fecaca" : "#dbe5e7"}`,
            borderRadius: 8
          }}
        >
          <h2 style={{ margin: 0, fontSize: 20 }}>{result.error ? "Seed failed" : "Seed completed"}</h2>
          {result.error ? <p style={{ margin: 0 }}>{result.error}</p> : null}
          {result.leads?.length ? (
            <p style={{ margin: 0, color: "#475569", lineHeight: 1.5 }}>
              Leads: {result.leads.join(", ")}
            </p>
          ) : null}
          {result.next_steps?.length ? (
            <ol style={{ margin: 0, paddingLeft: 20, color: "#475569", lineHeight: 1.5 }}>
              {result.next_steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          ) : null}
          {!result.error ? (
            <div style={{ display: "grid", gap: 8 }}>
              <p style={{ margin: 0, color: "#475569", lineHeight: 1.5 }}>
                Test mode is on: Agent Chat will only use seeded follow-up data until you seed another
                scenario or clear browser storage.
              </p>
              <Link href="/" style={{ color: "#087f6f", fontWeight: 650 }}>
                Open Agent Chat
              </Link>
            </div>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
