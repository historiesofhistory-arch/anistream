export class ApiError extends Error {
  status: number;
  statusText: string;
  data: unknown;
  constructor(response: Response, data: unknown, info: { method: string; url: string }) {
    super(`${info.method} ${info.url} → ${response.status} ${response.statusText}`);
    this.status = response.status;
    this.statusText = response.statusText;
    this.data = data;
  }
}

export async function customFetch<T = unknown>(
  input: RequestInfo | URL,
  options: RequestInit & { responseType?: "json" | "text" | "blob" | "auto" } = {},
): Promise<T> {
  const { responseType = "auto", ...init } = options;
  const response = await fetch(input, init);
  if (!response.ok) {
    let data: unknown;
    try { data = await response.json(); } catch { data = await response.text(); }
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    throw new ApiError(response, data, { method: init.method ?? "GET", url });
  }
  if (response.status === 204 || response.status === 205) return undefined as T;
  if (responseType === "text") return response.text() as T;
  if (responseType === "blob") return response.blob() as T;
  const ct = response.headers.get("content-type") ?? "";
  if (ct.includes("application/json") || ct.includes("+json")) return response.json() as T;
  return response.json() as T;
}
