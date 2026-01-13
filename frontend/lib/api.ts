export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api";

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

export async function api<T>(path: string, opts?: { method?: HttpMethod; body?: any; headers?: Record<string, string>; timeout?: number }): Promise<T> {
  const url = `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  const token = getToken();
  const timeout = opts?.timeout || 10000; // 10 second default timeout
  
  // Debug: log the URL being called (only in development)
  if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
    console.log(`[API] ${opts?.method || "GET"} ${url}`);
  }
  
  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const res = await fetch(url, {
      method: opts?.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(opts?.headers || {})
      },
      body: opts?.body ? JSON.stringify(opts.body) : undefined,
      cache: "no-store",
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Request failed: ${res.status}`);
    }
    const ct = res.headers.get("content-type");
    if (ct && ct.includes("application/json")) return (await res.json()) as T;
    return (await res.text()) as T;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeout}ms. Is the backend server running at ${API_BASE}?`);
    }
    throw error;
  }
}
