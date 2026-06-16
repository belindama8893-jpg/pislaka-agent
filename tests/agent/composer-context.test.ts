import { describe, expect, it } from "vitest";
import { createAgentComposerContextPreviews } from "../../components/agent/agent-composer-context";

describe("agent composer context previews", () => {
  it("maps workspace context attachments to composer previews", () => {
    const previews = createAgentComposerContextPreviews([
      {
        id: "listing:11111111-1111-4111-8111-111111111111",
        type: "listing",
        entity_id: "11111111-1111-4111-8111-111111111111",
        label: "DHA Phase 5 villa",
        summary: "Lahore · 3 media files",
        media: [
          {
            id: "media-1",
            mediaType: "image",
            name: "front.jpg",
            previewUrl: "blob:http://localhost/front"
          }
        ],
        snapshot: {
          title: "DHA Phase 5 villa"
        }
      }
    ]);

    expect(previews).toEqual([
      {
        id: "listing:11111111-1111-4111-8111-111111111111",
        type: "listing",
        label: "DHA Phase 5 villa",
        summary: "Lahore · 3 media files",
        media: [
          {
            id: "media-1",
            mediaType: "image",
            name: "front.jpg",
            previewUrl: "blob:http://localhost/front"
          }
        ]
      }
    ]);
  });
});
