import { describe, expect, it, vi } from "vitest";

import { provider as googleAnalytics } from "./google_analytics/definition.ts";
import { credentialValidators as googleAnalyticsValidators } from "./google_analytics/executors.ts";
import { provider as googleSearchConsole } from "./google_search_console/definition.ts";
import { credentialValidators as googleSearchConsoleValidators } from "./google_search_console/executors.ts";

const credential = {
  authType: "oauth2" as const,
  accessToken: "token",
  tokenType: "Bearer",
  profile: { accountId: "google", displayName: "Google", grantedScopes: [] },
  metadata: {},
};

describe("Google OAuth providers", () => {
  it("use PKCE for desktop OAuth clients", () => {
    for (const provider of [googleSearchConsole, googleAnalytics]) {
      expect(provider.auth[0]).toMatchObject({ pkce: { method: "S256" } });
    }
  });

  it("validate readonly credentials through each product API", async () => {
    const urls: string[] = [];
    const fetcher = vi.fn(async (url: Parameters<typeof fetch>[0]) => {
      urls.push(String(url));
      return Response.json({ siteEntry: [], accountSummaries: [] });
    }) as typeof fetch;

    await googleSearchConsoleValidators.oauth2!(credential, { fetcher });
    await googleAnalyticsValidators.oauth2!(credential, { fetcher });

    expect(urls).toEqual([
      "https://www.googleapis.com/webmasters/v3/sites",
      "https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=1",
    ]);
  });
});
