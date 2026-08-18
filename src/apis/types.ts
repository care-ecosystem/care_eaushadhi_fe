export type options = {
  formdata?: boolean;
  external?: boolean;
  headers?: any;
  auth?: boolean;
};

export enum HttpMethod {
  GET = "GET",
  POST = "POST",
  PUT = "PUT",
  PATCH = "PATCH",
  DELETE = "DELETE",
}

// ---------------------------------------------------------------------------
// Super Batch Request (care_super_batch_be plugin)
// POST /api/super_batch_request/ — chained, atomic batch of sub-requests.
// ---------------------------------------------------------------------------

export type SuperBatchResourceType = "body" | "url";

export interface SuperBatchResourcePath {
  reference_id: string;
  path: string; // JSONPath, e.g. "$.id"
  type?: SuperBatchResourceType; // defaults to "body" on the server
}

export interface SuperBatchReplacement {
  source_path: SuperBatchResourcePath;
  value_path: SuperBatchResourcePath;
}

export interface SuperBatchSubRequest {
  reference_id: string;
  url: string;
  method: HttpMethod;
  body?: Record<string, unknown>;
  replacements?: SuperBatchReplacement[];
}

export interface SuperBatchRequestBody {
  requests: SuperBatchSubRequest[];
}

export interface SuperBatchResult<T = unknown> {
  reference_id: string;
  data: T;
  status_code: number;
}

export interface SuperBatchResponse<T = unknown> {
  results: SuperBatchResult<T>[];
}

export interface BatchSubRequest {
  reference_id: string;
  url: string;
  method: HttpMethod;
  body?: Record<string, unknown>;
}

export interface BatchRequestBody {
  requests: BatchSubRequest[];
}
