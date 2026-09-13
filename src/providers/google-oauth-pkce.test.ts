import { describe, expect, it } from "vitest";

import { provider as googleAnalytics } from "./google_analytics/definition.ts";
import { provider as googleSearchConsole } from "./google_search_console/definition.ts";

describe("Google OAuth providers", () => {
  it("use PKCE for desktop OAuth clients", () => {
    for (const provider of [googleSearchConsole, googleAnalytics]) {
      expect(provider.auth[0]).toMatchObject({ pkce: { method: "S256" } });
    }
  });
});
