import type { AuthErrorDetail } from "@/types/AuthTypes";

/**
 * The single response envelope every `/auth/*` endpoint uses. `/health` is the
 * only exception and is not called from here.
 */
export type ApiSuccessEnvelope<TData> = {
  success: true;
  data: TData;
};

export type ApiErrorEnvelope = {
  success: false;
  error: {
    code: string;
    message: string;
    /** Present only when non-empty. Never assume it exists. */
    details?: AuthErrorDetail[];
  };
};

export type ApiEnvelope<TData> = ApiSuccessEnvelope<TData> | ApiErrorEnvelope;

export type AuthRequestMethod = "GET" | "POST";

export type AuthRequestOptions = {
  method?: AuthRequestMethod;
  /** Serialised as JSON. Omit for requests without a body. */
  body?: unknown;
  /** Sent as `Authorization: Bearer <token>`. Omit for unauthenticated routes. */
  token?: string | null;
};