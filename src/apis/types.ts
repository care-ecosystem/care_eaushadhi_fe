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
