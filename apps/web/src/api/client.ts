import type { ApiErrorBody } from "@assetflow/shared";
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
let csrfToken: string | null = null;
export const setCsrfToken = (token: string | null) => {
  csrfToken = token;
};
export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method: options.method ?? "GET",
      credentials: "same-origin",
      signal: options.signal,
      headers: {
        ...(options.body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
        ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
      },
      ...(options.body !== undefined
        ? { body: JSON.stringify(options.body) }
        : {}),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw error;
    throw new ApiError(
      0,
      "NETWORK_ERROR",
      "無法連線至伺服器，請檢查網路後重試。",
    );
  }
  if (!response.ok) {
    const data = (await response
      .json()
      .catch(() => null)) as ApiErrorBody | null;
    if (response.status === 401 && path !== "/auth/login") {
      setCsrfToken(null);
      window.dispatchEvent(new Event("session-expired"));
    }
    throw new ApiError(
      response.status,
      data?.error?.code ?? "HTTP_ERROR",
      data?.error?.message ?? "操作失敗，請稍後再試。",
    );
  }
  return response.json() as Promise<T>;
}
export function query(values: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values))
    if (value !== undefined && value !== "") params.set(key, String(value));
  return params.toString();
}
