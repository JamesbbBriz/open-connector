import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";
import type { ProviderActionHandlers, ProviderRuntimeHandler } from "../provider-runtime.ts";

import { optionalInteger, optionalRecord, optionalString, requiredRecord, requiredString } from "../../core/cast.ts";
import { assertPublicHttpUrl, isPrivateNetworkAccessAllowed } from "../../core/request.ts";
import {
  createProviderFetch,
  defineProviderExecutors,
  providerInputError,
  ProviderRequestError,
  providerUserAgent,
  requireApiKeyCredential,
} from "../provider-runtime.ts";

const service = "strapi";
const pathSegmentPattern = /^[A-Za-z0-9][A-Za-z0-9_-]*$/u;

interface StrapiContext {
  apiKey: string;
  baseUrl: string;
  fetcher: typeof fetch;
  signal?: AbortSignal;
}

type StrapiActionHandler = ProviderRuntimeHandler<StrapiContext>;

export function normalizeBaseUrl(value: unknown): string {
  const text = requiredString(value, "baseUrl", providerInputError);
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw providerInputError("baseUrl must be a valid http(s) URL");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.pathname !== "/") {
    throw providerInputError("baseUrl must be the Strapi instance root URL without a path");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw providerInputError("baseUrl must not include credentials, query parameters, or a fragment");
  }
  assertPublicHttpUrl(url.toString(), {
    fieldName: "baseUrl",
    createError: providerInputError,
    allowPrivateNetwork: isPrivateNetworkAccessAllowed(),
  });
  return url.origin;
}

function pathSegment(value: unknown, fieldName: string): string {
  const text = requiredString(value, fieldName, providerInputError);
  if (!pathSegmentPattern.test(text)) throw providerInputError(`${fieldName} contains unsupported characters`);
  return text;
}

function locale(value: unknown): string {
  return pathSegment(value, "locale");
}

async function request(
  context: StrapiContext,
  path: string,
  options: {
    method?: "POST" | "PUT";
    query: Record<string, string | number | undefined>;
    body?: Record<string, unknown>;
  },
): Promise<Record<string, unknown>> {
  const url = new URL(path, `${context.baseUrl}/`);
  for (const [key, value] of Object.entries(options.query)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  const response = await context.fetcher(url, {
    method: options.method ?? "GET",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${context.apiKey}`,
      "user-agent": providerUserAgent,
      ...(options.body ? { "content-type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: context.signal,
  });
  const text = await response.text();
  let payload: unknown;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { message: text };
  }
  if (!response.ok) {
    const error = optionalRecord(optionalRecord(payload)?.error);
    throw new ProviderRequestError(
      response.status,
      optionalString(error?.message) ?? `Strapi request failed with status ${response.status}`,
      payload,
    );
  }
  return requiredRecord(payload, "Strapi response", (message) => new ProviderRequestError(502, message, payload));
}

function target(input: Record<string, unknown>): { collection: string; documentId?: string; locale: string } {
  return {
    collection: pathSegment(input.collection, "collection"),
    documentId: input.documentId === undefined ? undefined : pathSegment(input.documentId, "documentId"),
    locale: locale(input.locale),
  };
}

function writeData(input: Record<string, unknown>): Record<string, unknown> {
  return requiredRecord(input.data, "data", providerInputError);
}

export const strapiActionHandlers: ProviderActionHandlers<"strapi", StrapiActionHandler> = {
  list_entries(input: Record<string, unknown>, context: StrapiContext) {
    const item = target(input);
    const status = requiredString(input.status, "status", providerInputError);
    if (status !== "draft" && status !== "published") throw providerInputError("status must be draft or published");
    return request(context, `/api/${item.collection}`, {
      query: {
        locale: item.locale,
        status,
        "pagination[page]": optionalInteger(input.page),
        "pagination[pageSize]": optionalInteger(input.pageSize),
      },
    });
  },
  get_entry(input: Record<string, unknown>, context: StrapiContext) {
    const item = target(input);
    const status = requiredString(input.status, "status", providerInputError);
    if (status !== "draft" && status !== "published") throw providerInputError("status must be draft or published");
    return request(context, `/api/${item.collection}/${item.documentId}`, {
      query: { locale: item.locale, status },
    });
  },
  create_draft(input: Record<string, unknown>, context: StrapiContext) {
    const item = target(input);
    return request(context, `/api/${item.collection}`, {
      method: "POST",
      query: { locale: item.locale, status: "draft" },
      body: { data: writeData(input) },
    });
  },
  update_draft(input: Record<string, unknown>, context: StrapiContext) {
    const item = target(input);
    return request(context, `/api/${item.collection}/${item.documentId}`, {
      method: "PUT",
      query: { locale: item.locale, status: "draft" },
      body: { data: writeData(input) },
    });
  },
  publish_entry(input: Record<string, unknown>, context: StrapiContext) {
    const item = target(input);
    return request(context, `/api/${item.collection}/${item.documentId}`, {
      method: "PUT",
      query: { locale: item.locale, status: "published" },
      body: { data: writeData(input) },
    });
  },
};

export const executors: ProviderExecutors = defineProviderExecutors<StrapiContext>({
  service,
  handlers: strapiActionHandlers,
  async createContext(context, fetcher) {
    const credential = await requireApiKeyCredential(context, service);
    return {
      apiKey: credential.apiKey,
      baseUrl: normalizeBaseUrl(credential.metadata.baseUrl ?? credential.values.baseUrl),
      fetcher,
      signal: context.signal,
    };
  },
  allowPrivateNetwork: isPrivateNetworkAccessAllowed,
});

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher, signal }) {
    const baseUrl = normalizeBaseUrl(input.values.baseUrl);
    const validationCollection = pathSegment(input.values.validationCollection, "validationCollection");
    const guardedFetcher = createProviderFetch({ fetch: fetcher, allowPrivateNetwork: isPrivateNetworkAccessAllowed });
    await request({ apiKey: input.apiKey, baseUrl, fetcher: guardedFetcher, signal }, `/api/${validationCollection}`, {
      query: { status: "draft", "pagination[pageSize]": 1 },
    });
    const host = new URL(baseUrl).host;
    return {
      profile: { accountId: `strapi:${host}`, displayName: `Strapi ${host}` },
      grantedScopes: [],
      metadata: { baseUrl, apiBaseUrl: `${baseUrl}/api`, validationCollection },
    };
  },
};
