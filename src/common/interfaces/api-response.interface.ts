/**
 * Standard API response envelope for all Terroir.ma endpoints.
 */
export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: ApiError | null;
  meta: ResponseMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ResponseMeta {
  correlationId: string;
  page?: number;
  limit?: number;
  total?: number;
}
