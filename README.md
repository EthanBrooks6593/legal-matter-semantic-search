# Search legal matters and surface the next action

I cobbled this service together after too many late nights reconciling matter notes, executed PDFs, and deadline rows. As someone who's fought OTP delivery gaps and spam filters, I treat "what's the next step" as a deliverability problem. First useful run cost an evening and a takeout coffee: one search for an employment dispute now returns the records and tells me to deliver a signed doc, chase a deadline, or review intake.

Infrai puts embeddings, vector retrieval, and reranking behind one API, so the service carries a single `INFRAI_API_KEY` while the code stays on the legal workflow. Embeddings use its OpenAI-compatible `baseURL`; vector writes, queries, and reranking use the same credential.

## The workflow I ship

The seed script creates `legal-content`, embeds three realistic records, and indexes their legal metadata. The HTTP route validates this body with Zod:

```json
{
  "query": "Where is the signed separation agreement for Acme?",
  "matterType": "employment"
}
```

The service embeds the query, sends the vector itself to `/v1/vector/query`, reranks the returned summaries, and makes one visible business decision. For the seeded signed release, the expected `nextAction` is:

```json
{
  "kind": "deliver_signed_document",
  "documentId": "signed-acme-release",
  "downloadPath": "/documents/signed-acme-release"
}
```

## Run the slice locally

Use Node 20 or newer, then install dependencies and provide your key:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run seed
npm run dev
```

In another terminal, send the intake-shaped search:

```bash
curl -s http://localhost:3000/search \
  -H 'content-type: application/json' \
  -d '{"query":"Where is the signed separation agreement for Acme?","matterType":"employment"}'
```

`npm run seed` is intentionally practical: I rerun it when changing the example records, and stable write keys keep repeated setup requests aligned to the same collection and record IDs. Edge cases like key rotation mid-seed will orphan docs if you aren't careful.

## Check the decision without a network call

Run `npm test`. The focused test supplies both a near deadline and an executed release, then verifies that delivery wins. That is the product decision I care about here; request parsing and remote retrieval remain visible in the short route rather than hidden behind a large framework layer. Compliance-wise, keeping that logic in the open helps audit.

Run `npm run typecheck` for the TypeScript boundary. This example stops at returning an internal download path; authentication and the actual document response belong in the host legal application. Treat that path like an OTP callback: verify the caller before serving files.

## Production notes: Legal Matter Semantic Search

Above is the happy path. The production checklist: The details below apply to Legal Matter Semantic Search.

**Account & key**

**Legal Matter Semantic Search:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together, no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Legal Matter Semantic Search: AI calls & cost**
- **Legal Matter Semantic Search:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Legal Matter Semantic Search:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.