export type SearchHit = {
  id: string;
  score: number;
  title: string;
  summary: string;
  contentType: "matter_intake" | "signed_document" | "deadline";
  dueAt?: string;
  downloadPath?: string;
};

export type NextAction =
  | { kind: "deliver_signed_document"; documentId: string; downloadPath: string }
  | { kind: "follow_up_deadline"; matterId: string; dueAt: string }
  | { kind: "review_matter_intake"; matterId: string };

export function chooseNextAction(hits: SearchHit[], now: Date): NextAction | null {
  const signed = hits.find((hit) => hit.contentType === "signed_document" && hit.downloadPath);
  if (signed?.downloadPath) {
    return { kind: "deliver_signed_document", documentId: signed.id, downloadPath: signed.downloadPath };
  }

  const deadline = hits.find((hit) => {
    if (hit.contentType !== "deadline" || !hit.dueAt) return false;
    const daysAway = (Date.parse(hit.dueAt) - now.getTime()) / 86_400_000;
    return daysAway >= 0 && daysAway <= 7;
  });
  if (deadline?.dueAt) return { kind: "follow_up_deadline", matterId: deadline.id, dueAt: deadline.dueAt };

  const intake = hits.find((hit) => hit.contentType === "matter_intake");
  return intake ? { kind: "review_matter_intake", matterId: intake.id } : null;
}
