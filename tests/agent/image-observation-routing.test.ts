import { describe, expect, it } from "vitest";
import { routeAgentMessage } from "../../lib/agent/deepseek";

describe("image observation routing", () => {
  it("answers a map/location image without forcing a workflow card", async () => {
    const action = await routeAgentMessage(
      [
        "where",
        "",
        "Uploaded image evidence (internal).",
        "Image 1:",
        "- type: map_or_location_screenshot",
        "- summary: Map showing Johar Town L Block with a pin marking a specific location.",
        "- customer request: Location details for Johar Town L Block.",
        "- location: Johar Town L Block, Lahore",
        "- suggested intent: general_reply"
      ].join("\n")
    );

    expect(action.intent).toBe("general_reply");
    expect(action.requires_confirmation).toBe(false);
    expect(action.response).toContain("I can see:");
    expect(action.response).toContain("You likely want to identify the place");
    expect(action.response).toContain("Do you want me to use this location");
  });

  it("asks for the next step when only a property image is uploaded", async () => {
    const action = await routeAgentMessage(
      [
        "Attached 1 listing media file.",
        "",
        "Uploaded image evidence (internal).",
        "Image 1:",
        "- type: property_listing_screenshot",
        "- summary: Floor plan of a 903 sqft apartment with 2 bedrooms, 2 bathrooms, and 1 balcony.",
        "- property type: apartment",
        "- size: 903 sqft",
        "- suggested intent: general_reply"
      ].join("\n")
    );

    expect(action.intent).toBe("general_reply");
    expect(action.requires_confirmation).toBe(false);
    expect(action.response).toContain("Floor plan");
    expect(action.response).toContain("This may be material for a listing draft");
    expect(action.response).toContain("Should I draft a listing");
  });

  it("uses the previous image observation when the broker answers the follow-up", async () => {
    const action = await routeAgentMessage("draft a listing from it for Facebook", {
      recentMessages: [
        {
          role: "user",
          content: "Attached 1 listing media file."
        },
        {
          role: "assistant",
          content:
            "I can see: Floor plan for property E, 850 sqft, 2 bedrooms, 2 bathrooms, 1 balcony, featuring TV lounge, dining, kitchen, and laundry. Property details: 850 sqft, apartment, sale. This may be material for a listing draft or listing media. Should I draft a listing from it, attach it as media, or check what details are missing?"
        }
      ]
    });

    expect(action.intent).toBe("create_listing_draft");
    expect(action.requires_confirmation).toBe(false);
    expect(action.response).toContain("previous image");
    expect(action.response).toContain("Facebook promotion");
    expect(action.payload).toMatchObject({
      property_type: "apartment",
      listing_type: "sale",
      area_value: 850,
      area_unit: "sqft",
      bedrooms: 2,
      bathrooms: 2
    });
  });

  it("generates social copy from uploaded image evidence without creating links", async () => {
    const action = await routeAgentMessage(
      [
        "write Facebook post",
        "",
        "Uploaded image evidence (internal).",
        "Image 1:",
        "- type: property_listing_screenshot",
        "- summary: Floor plan for property E, 850 sqft, 2 bedrooms, 2 bathrooms, 1 balcony, with TV lounge, dining, kitchen, and laundry.",
        "- property type: apartment",
        "- listing type: sale",
        "- size: 850 sqft",
        "- bedrooms: 2",
        "- bathrooms: 2",
        "- suggested intent: general_reply"
      ].join("\n")
    );

    expect(action.intent).toBe("generate_social_copy");
    expect(action.requires_confirmation).toBe(false);
    expect(action.response).toContain("copy options");
    expect(action.payload).toMatchObject({
      channels: ["facebook"]
    });
    const promotion = action.payload.promotion as { cards: Array<Record<string, unknown>>; summary: string };
    expect(promotion.summary).toContain("tracking links");
    const cards = promotion.cards;
    expect(cards).toHaveLength(3);
    expect(cards[0]).toMatchObject({ channel: "facebook", title: "Direct buyer Facebook draft" });
    expect(cards[0]).not.toHaveProperty("landing_url");
  });

  it("uses recent image analysis context for follow-up social copy requests", async () => {
    const action = await routeAgentMessage("Help me write a Facebook promotion copy for this real estate property.", {
      recentMessages: [
        {
          role: "user",
          content: "Attached 2 listing media files."
        },
        {
          role: "assistant",
          content:
            "I can see: Map showing Johar Town L Block in Lahore, highlighting phases and nearby areas like Wafaqi Colony and PIA Housing Society. Floor plan for property E, 850 sqft, 2 bedrooms, 2 bathrooms, 1 balcony, featuring TV lounge, dining, kitchen, and laundry. Location: Johar Town L Block, Phase 1, Lahore. Property details: 850 sqft, apartment, for_sale. This looks like a location check. Do you want me to search around this area, attach it to a listing, or just identify the address?"
        }
      ]
    });

    expect(action.intent).toBe("generate_social_copy");
    const cards = (action.payload.promotion as { cards: Array<Record<string, string>> }).cards;
    expect(cards[0].body).toContain("Johar Town L Block");
    expect(cards[0].body).toContain("850 sqft");
    expect(cards[0].body.toLowerCase()).toContain("apartment");
    expect(cards[0].body).not.toContain("Help me write");
    expect(cards[0].body).not.toContain("Known details");
    expect(cards[0].body).not.toContain("Map showing");
    expect(cards[0].body).not.toContain("Property details:");
  });
});
