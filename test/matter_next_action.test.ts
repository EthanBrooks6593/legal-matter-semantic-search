import { describe, expect, it } from "vitest";
import { chooseNextAction, type SearchHit } from "../src/matter_next_action.js";

describe("chooseNextAction", () => {
  it("delivers an executed document before scheduling deadline follow-up", () => {
    const hits: SearchHit[] = [
      { id: "deadline-1", score: 0.95, title: "Response due", summary: "Due this week", contentType: "deadline", dueAt: "2026-09-04T17:00:00.000Z" },
      { id: "release-1", score: 0.92, title: "Signed release", summary: "Ready for delivery", contentType: "signed_document", downloadPath: "/documents/release-1" },
    ];

    expect(chooseNextAction(hits, new Date("2026-08-31T09:00:00.000Z"))).toEqual({
      kind: "deliver_signed_document",
      documentId: "release-1",
      downloadPath: "/documents/release-1",
    });
  });
});
