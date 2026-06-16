import { describe, expect, it } from "vitest";
import {
  buildAgentResolutionFailureUi,
  formatAgentResolutionFailureMessage
} from "../../components/agent/agent-resolution-ui";

describe("agent resolution UI contract", () => {
  it("standardizes no-match copy and fallback actions", () => {
    const ui = buildAgentResolutionFailureUi(
      { status: "no_match", target_type: "lead" },
      { requestedLabel: "Ahmed", targetType: "lead" }
    );

    expect(ui).toEqual({
      status: "no_match",
      message: {
        headline: "Couldn't find this lead",
        detail: 'No saved lead matches "Ahmed". Check the buyer name or phone number.'
      },
      actions: [
        { label: "Show recent leads", type: "fallback_list" },
        { label: "Try again", type: "retry_input" }
      ]
    });
    expect(formatAgentResolutionFailureMessage(ui!)).toBe(
      'Couldn\'t find this lead No saved lead matches "Ahmed". Check the buyer name or phone number.'
    );
  });

  it("standardizes ambiguous candidates", () => {
    const ui = buildAgentResolutionFailureUi({
      status: "ambiguous",
      target_type: "lead",
      candidates: [
        {
          id: "11111111-1111-1111-1111-111111111111",
          label: "Ahmed Raza",
          phone: "+92 300 1111111",
          listing_title: "DHA Villa"
        },
        {
          id: "22222222-2222-2222-2222-222222222222",
          label: "Ahmed Khan"
        }
      ]
    });

    expect(ui).toMatchObject({
      status: "ambiguous",
      message: {
        headline: "Choose the right lead",
        detail: "I found 2 possible leads."
      },
      actions: [{ label: "Select lead", type: "select_candidate" }]
    });
    expect(ui?.candidates).toEqual([
      {
        id: "11111111-1111-1111-1111-111111111111",
        displayLabel: "Ahmed Raza · +92 300 1111111 · DHA Villa"
      },
      {
        id: "22222222-2222-2222-2222-222222222222",
        displayLabel: "Ahmed Khan"
      }
    ]);
  });

  it("standardizes clarification copy by target type", () => {
    expect(
      buildAgentResolutionFailureUi({ status: "needs_clarification", target_type: "listing" })?.message
    ).toEqual({
      headline: "I need one more detail",
      detail: "Add the listing title, area, size, or open a listing card before I continue."
    });
  });
});
