import { createLegalSearchClient } from "./infrai_legal_search.js";

const documents = [
  {
    id: "matter-acme-termination",
    text: "Acme employment intake about a contested termination and final wages.",
    metadata: { title: "Acme termination intake", summary: "Contested termination and final wages", content_type: "matter_intake", matter_type: "employment" },
  },
  {
    id: "signed-acme-release",
    text: "Signed separation release for the Acme employment matter.",
    metadata: { title: "Signed separation release", summary: "Executed release ready for client delivery", content_type: "signed_document", matter_type: "employment", download_path: "/documents/signed-acme-release" },
  },
  {
    id: "deadline-acme-response",
    text: "Response deadline for the Acme employment matter.",
    metadata: { title: "Agency response deadline", summary: "Counsel response is due soon", content_type: "deadline", matter_type: "employment", due_at: "2026-09-04T17:00:00.000Z" },
  },
] as const;

const infrai = createLegalSearchClient();
const embedded = await Promise.all(documents.map(async (document) => ({
  id: document.id,
  values: await infrai.embed(document.text),
  metadata: { ...document.metadata },
})));

await infrai.createCollection("legal-content", embedded[0].values.length);
await infrai.upsert("legal-content", embedded);
console.log(`Indexed ${embedded.length} legal records in legal-content.`);
