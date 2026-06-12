import { SeedFollowUpControls } from "@/app/dev/seed-followup-test-data/SeedFollowUpControls";

export default function SeedFollowUpTestDataPage() {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_TEST_SEED !== "true") {
    return (
      <main style={{ padding: 32 }}>
        <h1>Seed follow-up test data</h1>
        <p>This page is disabled in production.</p>
      </main>
    );
  }

  return (
    <main style={{ display: "grid", gap: 18, maxWidth: 760, padding: 32 }}>
      <h1 style={{ margin: 0 }}>Seed follow-up test data</h1>
      <p style={{ margin: 0, color: "#64748b", lineHeight: 1.5 }}>
        Use this while signed in locally. It deletes and recreates only records tagged with
        {" "}
        <code>[seed:followup-test]</code>
        {" "}
        for the current broker.
      </p>
      <SeedFollowUpControls />
    </main>
  );
}
