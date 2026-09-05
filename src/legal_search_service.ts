import express from "express";
import { z } from "zod";
import { createLegalSearchClient, InfraiError, type LegalVector } from "./infrai_legal_search.js";
import { chooseNextAction, type SearchHit } from "./matter_next_action.js";

const SearchRequest = z.object({
  query: z.string().trim().min(3).max(500),
  matterType: z.enum(["employment", "commercial", "privacy"]).optional(),
});

function toHit(match: LegalVector): SearchHit | null {
  const metadata = match.metadata ?? {};
  const contentType = metadata.content_type;
  if (contentType !== "matter_intake" && contentType !== "signed_document" && contentType !== "deadline") return null;
  if (typeof metadata.title !== "string" || typeof metadata.summary !== "string") return null;
  return {
    id: match.id,
    score: match.score ?? 0,
    title: metadata.title,
    summary: metadata.summary,
    contentType,
    ...(typeof metadata.due_at === "string" ? { dueAt: metadata.due_at } : {}),
    ...(typeof metadata.download_path === "string" ? { downloadPath: metadata.download_path } : {}),
  };
}

const app = express();
app.use(express.json({ limit: "16kb" }));

app.post("/search", async (request, response) => {
  const parsed = SearchRequest.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: "Invalid search request", issues: parsed.error.issues });

  try {
    const infrai = createLegalSearchClient();
    const embedding = await infrai.embed(parsed.data.query);
    const filter = parsed.data.matterType ? { matter_type: parsed.data.matterType } : undefined;
    const vectorResult = await infrai.query("legal-content", embedding, filter);
    const hits = vectorResult.matches.map(toHit).filter((hit): hit is SearchHit => hit !== null);
    const reranked = hits.length
      ? await infrai.rerank(parsed.data.query, hits.map((hit) => `${hit.title}: ${hit.summary}`))
      : { results: [] };
    const ordered = reranked.results.map((result) => hits[result.index]).filter((hit): hit is SearchHit => Boolean(hit));

    return response.json({ matches: ordered, nextAction: chooseNextAction(ordered, new Date()) });
  } catch (error) {
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      return response.status(status).json({ error: error.code, message: error.message });
    }
    return response.status(502).json({ error: "SEARCH_DEPENDENCY_ERROR" });
  }
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`Legal search listening on http://localhost:${port}`));
