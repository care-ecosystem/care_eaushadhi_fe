import { useMutation, UseMutationOptions } from "@tanstack/react-query";

import { apis } from "@/apis/index";
import {
  HttpMethod,
  options,
  SuperBatchRequestBody,
  SuperBatchResponse,
  SuperBatchResult,
} from "@/apis/types";

const CARE_ACCESS_TOKEN_LOCAL_STORAGE_KEY = "care_access_token";

export const request = async <T>(
  endpoint: string,
  method: HttpMethod = HttpMethod.GET,
  data: any = {},
  options: options = {},
): Promise<T> => {
  const CARE_BASE_URL = window.CARE_API_URL;

  const { formdata, external, headers, auth: isAuth } = options;

  let url = external ? endpoint : CARE_BASE_URL + endpoint;
  let payload: null | string = formdata ? data : JSON.stringify(data);

  if (method === HttpMethod.GET) {
    const requestParams = data
      ? `?${Object.keys(data)
          .filter((key) => data[key] !== null && data[key] !== undefined)
          .map(
            (key) =>
              `${encodeURIComponent(key)}=${encodeURIComponent(data[key])}`,
          )
          .join("&")}`
      : "";
    url += requestParams;
    payload = null;
  }

  const localToken = localStorage.getItem(CARE_ACCESS_TOKEN_LOCAL_STORAGE_KEY);

  const auth =
    isAuth === false || typeof localToken === "undefined" || localToken === null
      ? ""
      : "Bearer " + localToken;

  const response = await fetch(url, {
    method: method,
    headers: external
      ? { ...headers }
      : {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: auth,
          ...headers,
        },
    body: payload,
  });
  try {
    const txt = await response.clone().text();
    if (txt === "") {
      return {} as any;
    }
    const json = await response.clone().json();
    if (json && response.ok) {
      return json;
    } else {
      throw json;
    }
  } catch (error) {
    throw { error, status: response.status };
  }
};

// ---------------------------------------------------------------------------
// Super Batch Request mutation
// ---------------------------------------------------------------------------

export class SuperBatchError extends Error {
  results: SuperBatchResult[];
  failed: SuperBatchResult[];
  status?: number;

  constructor(
    message: string,
    info: {
      results: SuperBatchResult[];
      failed: SuperBatchResult[];
      status?: number;
    },
  ) {
    super(message);
    this.name = "SuperBatchError";
    this.results = info.results;
    this.failed = info.failed;
    this.status = info.status;
  }
}

function extractResultsFromError(err: any): SuperBatchResult[] {
  const body = err?.error ?? err;
  const results = body?.results ?? err?.results;
  return Array.isArray(results) ? results : [];
}

export function useSuperBatchRequest(
  mutationOptions?: Omit<
    UseMutationOptions<
      SuperBatchResult[],
      SuperBatchError,
      SuperBatchRequestBody
    >,
    "mutationFn"
  >,
) {
  return useMutation<
    SuperBatchResult[],
    SuperBatchError,
    SuperBatchRequestBody
  >({
    mutationFn: async (payload) => {
      let response: SuperBatchResponse;
      try {
        response = await apis.superBatchRequest(payload);
      } catch (err: any) {
        const results = extractResultsFromError(err);
        if (results.length) {
          throw new SuperBatchError("Batch rolled back", {
            results,
            failed: results.filter((r) => r.status_code > 299),
            status: err?.status,
          });
        }
        throw err;
      }

      const results = response.results ?? [];
      const failed = results.filter((r) => r.status_code > 299);
      if (failed.length) {
        throw new SuperBatchError("Batch rolled back", { results, failed });
      }
      return results;
    },
    ...mutationOptions,
  });
}
