import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function readProjectFile(path: string) {
  return readFileSync(join(root, path), "utf8");
}

describe("agent card system rules", () => {
  it("keeps listing candidate cards on the shared primitive", () => {
    const workspace = readProjectFile("components/agent/AgentWorkspace.tsx");
    const primitives = readProjectFile("components/agent/AgentCardPrimitives.tsx");
    const css = readProjectFile("app/globals.css");

    expect(workspace).not.toContain("listing-choice-card");
    expect(workspace).toContain("AgentCandidateList");
    expect(primitives).toContain("listing-update-list");
    expect(primitives).toContain("listing-update-row agent-card-candidate");
    expect(css).not.toContain("agent-card-candidate-avatar");
    expect(css).not.toContain("agent-card-candidate-pills");
  });

  it("keeps business card components on the shared shell", () => {
    const cardsDir = join(root, "components/agent/cards");
    const cardFiles = readdirSync(cardsDir)
      .filter((file) => file.endsWith(".tsx"))
      .filter((file) => file !== "card-contract.ts");

    expect(cardFiles.length).toBeGreaterThan(0);

    for (const file of cardFiles) {
      const source = readFileSync(join(cardsDir, file), "utf8");

      expect(source, `${file} must render through AgentOutputCard`).toContain("AgentOutputCard");
    }
  });

  it("keeps the card foundation centralized around tokens and primitives", () => {
    const primitives = readProjectFile("components/agent/AgentCardPrimitives.tsx");
    const mediaGallery = readProjectFile("components/agent/AgentMediaGallery.tsx");
    const contract = readProjectFile("components/agent/cards/card-contract.ts");
    const css = readProjectFile("app/globals.css");
    const showcase = readProjectFile("app/dev/agent-cards/page.tsx");

    expect(contract).toContain("AgentCardActionKind");
    expect(contract).toContain("AgentCardBadgeTone");
    expect(primitives).toContain("AgentCardButton");
    expect(primitives).toContain("AgentCardBadge");
    expect(primitives).toContain("AgentCardNotice");
    expect(primitives).toContain("AgentCardTextBlock");
    expect(primitives).toContain("AgentStepList");
    expect(mediaGallery).toContain("maxVisible = 4");
    expect(mediaGallery).toContain("moreCount");
    expect(mediaGallery).toContain("setIsExpanded(true)");
    expect(mediaGallery).toContain("agent-media-lightbox");
    expect(css).toContain("--agent-card-button-height");
    expect(css).toContain("--agent-card-title-size");
    expect(css).toContain(".agent-card-button-primary");
    expect(css).toContain(".agent-card-text-block");
    expect(css).toContain(".agent-card-step-list");
    expect(css).toContain(".agent-media-more-overlay");
    expect(css).toContain(".agent-media-lightbox");
    expect(showcase).toContain("FoundationBlock");
    expect(showcase).toContain("Base Components And Design Tokens");
    expect(showcase).toContain("--agent-card-width");
    expect(showcase).toContain("<AgentCardButton");
    expect(showcase).toContain("<AgentCardTextBlock");
    expect(showcase).toContain("<AgentStepList");
  });

  it("keeps the showcase away from legacy local card controls", () => {
    const showcase = readProjectFile("app/dev/agent-cards/page.tsx");
    const workspace = readProjectFile("components/agent/AgentWorkspace.tsx");
    const cardsDir = join(root, "components/agent/cards");
    const cardFiles = readdirSync(cardsDir)
      .filter((file) => file.endsWith(".tsx"))
      .filter((file) => file !== "card-contract.ts");

    expect(showcase).not.toContain("function ActionButton");
    expect(showcase).not.toContain("primary-button small");
    expect(showcase).not.toContain("outline-button small");
    expect(showcase).not.toContain("agent-card-inline-hint");
    expect(workspace).not.toContain("primary-button small");
    expect(workspace).not.toContain("outline-button small");
    expect(workspace).not.toContain("getLeadStatusClassName");
    expect(workspace).not.toContain("lead-status");
    expect(workspace).toContain("renderAgentLeadStatusBadge");

    for (const file of cardFiles) {
      const source = readFileSync(join(cardsDir, file), "utf8");

      expect(source, `${file} should use AgentCardNotice instead of legacy inline hints`).not.toContain("agent-card-inline-hint");
    }
  });
});
