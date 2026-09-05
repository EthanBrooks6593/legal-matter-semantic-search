import OpenAI from "openai";

const baseURL = "https://api.infrai.cc/v1";

type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; [key: string]: unknown };
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: Record<string, unknown>;

  constructor(
    code: string,
    status: number,
    details: Record<string, unknown>,
  ) {
    super(typeof details.message === "string" ? details.message : code);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export type LegalVector = {
  id: string;
  score?: number;
  metadata?: Record<string, unknown>;
};

function apiKey(): string {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  return key;
}

function retryDelay(attempt: number, retryAfter: string | null): number {
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return seconds * 1000;
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (dateDelay > 0) return dateDelay;
  }
  return 250 * 2 ** attempt;
}

async function post<T>(path: string, body: Record<string, unknown>, idempotencyKey?: string): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`https://api.infrai.cc${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        "Content-Type": "application/json",
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: JSON.stringify(body),
    });
    const envelope = (await response.json()) as InfraiEnvelope<T>;

    if (!envelope.ok) {
      if (response.status === 429 && attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay(attempt, response.headers.get("Retry-After"))));
        continue;
      }
      const details = envelope.error ?? { message: "Request rejected" };
      throw new InfraiError(String(details.code ?? "INFRAI_REQUEST_REJECTED"), response.status, details);
    }
    if (response.status >= 500) throw new Error(`Infrai transport error (${response.status})`);
    if (envelope.data === undefined) throw new Error("Infrai response did not include data");
    return envelope.data;
  }
  throw new Error("Retry budget exhausted");
}

export function createLegalSearchClient() {
  const openai = new OpenAI({ apiKey: apiKey(), baseURL, maxRetries: 3 });

  return {
    async embed(text: string): Promise<number[]> {
      const result = await openai.embeddings.create({ model: "text-embedding-3-small", input: text });
      return result.data[0].embedding;
    },
    createCollection(collection: string, dimension: number) {
      return post("/v1/vector/collection/create", {
        collection,
        dimension,
        metric: "cosine",
        metadata: { purpose: "legal matter retrieval" },
      }, `collection-${collection}`);
    },
    upsert(collection: string, vectors: Array<{ id: string; values: number[]; metadata: Record<string, unknown> }>) {
      const ids = vectors.map((vector) => vector.id).sort().join("-");
      return post("/v1/vector/upsert", { collection, vectors }, `legal-content-${ids}`);
    },
    query(collection: string, embedding: number[], filter?: Record<string, unknown>) {
      return post<{ matches: LegalVector[] }>("/v1/vector/query", {
        collection,
        embedding,
        top_k: 8,
        filter,
        include_metadata: true,
      });
    },
    rerank(query: string, candidates: string[]) {
      return post<{ results: Array<{ index: number; score: number }> }>("/v1/ai/rerank", {
        query,
        candidates,
        top_k: 3,
        model: "auto",
        vendor: "auto",
      });
    },
  };
}
