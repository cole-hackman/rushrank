export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api";

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

export async function api<T>(path: string, opts?: { method?: HttpMethod; body?: any; headers?: Record<string, string> }): Promise<T> {
  const url = `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  const token = getToken();
  const res = await fetch(url, {
    method: opts?.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts?.headers || {})
    },
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
    cache: "no-store"
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  const ct = res.headers.get("content-type");
  if (ct && ct.includes("application/json")) return (await res.json()) as T;
  return (await res.text()) as T;
}

