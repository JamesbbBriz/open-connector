import type { ActionDefinition } from "../../core/types.ts";

import { s } from "../../core/json-schema.ts";
import { defineProviderAction } from "../../core/provider-definition.ts";

const service = "strapi";
const collection = s.string("The Strapi collection API ID.", { minLength: 1, pattern: "^[A-Za-z0-9][A-Za-z0-9_-]*$" });
const documentId = s.string("The Strapi v5 document ID.", {
  minLength: 1,
  pattern: "^[A-Za-z0-9][A-Za-z0-9_-]*$",
});
const locale = s.string("The exact locale to read or write.", { minLength: 1, pattern: "^[A-Za-z0-9][A-Za-z0-9-]*$" });
const status = s.stringEnum("The Strapi document status to read.", ["draft", "published"]);
const data = s.looseObject("The Strapi document fields.");
const response = s.looseObject("The response returned by Strapi.");

export const strapiActions: ActionDefinition[] = [
  defineProviderAction(service, {
    name: "list_entries",
    description: "List entries from one Strapi v5 collection using an explicit locale and status.",
    requiredScopes: [],
    inputSchema: s.object(
      "The input for listing Strapi entries.",
      {
        collection,
        locale,
        status,
        page: s.positiveInteger("The page number to return."),
        pageSize: s.integer("The number of entries to return, up to 100.", { minimum: 1, maximum: 100 }),
      },
      { optional: ["page", "pageSize"] },
    ),
    outputSchema: response,
  }),
  defineProviderAction(service, {
    name: "get_entry",
    description: "Get one Strapi v5 entry using an explicit locale and status.",
    requiredScopes: [],
    inputSchema: s.object("The input for getting a Strapi entry.", { collection, documentId, locale, status }),
    outputSchema: response,
  }),
  defineProviderAction(service, {
    name: "create_draft",
    description: "Create a Strapi v5 draft. This action always sends status=draft.",
    requiredScopes: [],
    inputSchema: s.object("The input for creating a Strapi draft.", { collection, locale, data }),
    outputSchema: response,
  }),
  defineProviderAction(service, {
    name: "update_draft",
    description: "Update a Strapi v5 draft. This action always sends status=draft.",
    requiredScopes: [],
    inputSchema: s.object("The input for updating a Strapi draft.", { collection, documentId, locale, data }),
    outputSchema: response,
  }),
  defineProviderAction(service, {
    name: "publish_entry",
    description: "Publish fields for one Strapi v5 entry. This action always sends status=published.",
    requiredScopes: [],
    inputSchema: s.object("The input for publishing a Strapi entry.", { collection, documentId, locale, data }),
    outputSchema: response,
  }),
];
