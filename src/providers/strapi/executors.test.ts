import { describe, expect, it } from "vitest";
import { strapiActionHandlers } from "./executors.ts";

function context(fetcher: typeof fetch) {
  return { apiKey: "token", baseUrl: "https://cms.example.com", fetcher };
}

describe("Strapi v5 safe writes", () => {
  it("pins draft and published status and rejects path traversal", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fetcher = async (url: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: url.toString(), init });
      return Response.json({ data: { documentId: "doc1" }, meta: {} });
    };
    const input = { collection: "knowledge-articles", documentId: "doc1", locale: "en", data: { title: "Safe" } };

    await strapiActionHandlers.update_draft(input, context(fetcher));
    await strapiActionHandlers.publish_entry(input, context(fetcher));

    expect(requests.map(({ url }) => url)).toEqual([
      "https://cms.example.com/api/knowledge-articles/doc1?locale=en&status=draft",
      "https://cms.example.com/api/knowledge-articles/doc1?locale=en&status=published",
    ]);
    expect(requests[0]?.init?.body).toBe(JSON.stringify({ data: { title: "Safe" } }));
    expect(() =>
      strapiActionHandlers.get_entry(
        { collection: "../admin", documentId: "doc1", locale: "en", status: "draft" },
        context(fetcher),
      ),
    ).toThrow("collection contains unsupported characters");
  });
});
