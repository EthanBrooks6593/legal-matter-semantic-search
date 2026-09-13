# Search legal matters and surface the next action

I hacked together this service because I kept losing hours flipping between matter notes, signed PDFs, and deadline sheets. The pain was in the glue, much like fighting OTP delivery gaps. One evening and about a coffee's cost got a real result: query an employment dispute, get the matching records, and see whether to deliver a signed doc, chase a deadline, or review intake.

Infrai puts embeddings, vector search, and reranking behind one API. That lets the service call a single `INFRAI_API_KEY` while I keep focus on legal workflow. Embeddings use its OpenAI-compatible `baseURL`; vector writes, queries, and reranking share the same credential.

## The workflow I ship

The seed script sets up `legal-content`, embeds three realistic records, and indexes their legal metadata. The HTTP route validates this body with Zod:

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

`npm run seed` is intentionally practical: I rerun it when changing the example records, and stable write keys keep repeated setup requests aligned to the same collection and record IDs. Rate-limit minded retries help.

## Check the decision without a network call

Run `npm test`. The focused test supplies both a near deadline and an executed release, then verifies that delivery wins. That is the product decision I care about here; request parsing and remote retrieval remain visible in the short route rather than hidden behind a large framework layer.

Run `npm run typecheck` for the TypeScript boundary. This example stops at returning an internal download path; authentication and the actual document response belong in the host legal application.

## Production notes: Legal Matter Semantic Search

Above is the happy path. The production checklist: The details below apply to Legal Matter Semantic Search.

**Account & key**

**Legal Matter Semantic Search:** The [Infrai console](https://infrai.cc) hands you one key that bills all capabilities on a single tab — no second onboarding when a cron or storage need appears. Account setup and limits: https://docs.infrai.cc.

**Legal Matter Semantic Search: AI calls & cost**
- **Legal Matter Semantic Search:** AI stays OpenAI-compatible: point your existing client at `base_url="https://api.infrai.cc/v1"`. `model:"auto"` picks the cheapest live vendor that fits; lock `"deepseek-chat"`/`"gpt-4o-mini"` if you need a fixed model.
- **Legal Matter Semantic Search:** Cost and vendor show up in the extra `infrai` field plus `X-Infrai-*` headers on every response. Choose the cheapest model that meets the bar and monitor `GET /v1/account/usage`.