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


export function extractErrorMessage(data: unknown): string | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const obj = data as Record<string, unknown>;

  if (typeof obj.detail === "string") {
    return obj.detail;
  }

  if (Array.isArray(obj.errors) && obj.errors.length > 0) {
    const firstError = obj.errors[0] as Record<string, unknown>;

    if (
      firstError.ctx &&
      typeof firstError.ctx === "object" &&
      typeof (firstError.ctx as Record<string, unknown>).error === "string"
    ) {
      const errMsg = (firstError.ctx as Record<string, unknown>).error as string;
      return errMsg;
    }

    if (typeof firstError.msg === "string") {
      return firstError.msg;
    }

    if (firstError.msg && typeof firstError.msg === "object") {
      const value = Object.values(firstError.msg)[0];
      if (typeof value === "string") {
        return value;
      }
    }

    if (typeof firstError.error === "string") {
      return firstError.error;
    }
  }

  return null;
}

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
      const errorMessage = extractErrorMessage(json);
      throw {
        data: json,
        status: response.status,
        message: errorMessage || "An error occurred",
      };
    }
  } catch (error: any) {
    if (error?.message && error?.data) {
      throw error;
    }
    const errorMessage = extractErrorMessage(error);
    throw {
      error,
      status: response.status,
      message: errorMessage || "An error occurred",
    };
  }
};

// ---------------------------------------------------------------------------
// Super Batch Request mutation
// ---------------------------------------------------------------------------

export class SuperBatchError extends Error {
  results: SuperBatchResult[];
  failed: SuperBatchResult[];
  status?: number;
  errorMessages: string[];

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

    this.errorMessages = this.failed
      .map((result) => extractErrorMessage(result.data))
      .filter((msg): msg is string => msg !== null);
  }
}

function extractResultsFromError(err: any): SuperBatchResult[] {
  const results =
    err?.data?.results ?? err?.error?.results ?? err?.results;
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
