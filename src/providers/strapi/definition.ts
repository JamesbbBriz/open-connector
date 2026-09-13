import type { ProviderDefinition } from "../../core/types.ts";

import { strapiActions } from "./actions.ts";

export const provider: ProviderDefinition = {
  service: "strapi",
  displayName: "Strapi v5",
  categories: ["Developer Tools", "Marketing"],
  authTypes: ["api_key"],
  auth: [
    {
      type: "api_key",
      label: "API Token",
      placeholder: "Your Strapi API token",
      description: "A Strapi v5 API token sent as a Bearer token.",
      extraFields: [
        {
          key: "baseUrl",
          label: "Instance URL",
          inputType: "text",
          required: true,
          secret: false,
          placeholder: "https://cms.example.com",
          description: "The root URL of the Strapi instance.",
        },
        {
          key: "validationCollection",
          label: "Validation collection",
          inputType: "text",
          required: true,
          secret: false,
          placeholder: "articles",
          description: "A collection API ID the token can read in draft status.",
        },
      ],
    },
  ],
  homepageUrl: "https://strapi.io",
  actions: strapiActions,
};
