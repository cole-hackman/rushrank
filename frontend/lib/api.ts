export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

// Support both NEXT_PUBLIC_API_BASE_URL and NEXT_PUBLIC_API_URL for backwards compatibility
// If URL doesn't end with /api, append it
function getApiBase(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL;
  if (envUrl) {
    // Remove any trailing slashes first
    const cleanUrl = envUrl.replace(/\/+$/, '');
    // If it already ends with /api, use as-is, otherwise append /api
    return cleanUrl.endsWith('/api') ? cleanUrl : `${cleanUrl}/api`;
  }
  return "http://localhost:8000/api";
}

export const API_BASE = getApiBase();

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

const CHAPTER_ID_CACHE_KEY = "rushapp_chapter_id";
const CHAPTER_ID_CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Get cached chapter ID from localStorage
 */
export function getCachedChapterId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const cached = localStorage.getItem(CHAPTER_ID_CACHE_KEY);
    if (!cached) return null;
    
    const { chapterId, timestamp } = JSON.parse(cached);
    const now = Date.now();
    
    // Check if cache is expired
    if (now - timestamp > CHAPTER_ID_CACHE_EXPIRY) {
      localStorage.removeItem(CHAPTER_ID_CACHE_KEY);
      return null;
    }
    
    return chapterId;
  } catch {
    return null;
  }
}

/**
 * Cache chapter ID in localStorage
 */
export function setCachedChapterId(chapterId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CHAPTER_ID_CACHE_KEY, JSON.stringify({
      chapterId,
      timestamp: Date.now()
    }));
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Clear cached chapter ID
 */
export function clearCachedChapterId(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CHAPTER_ID_CACHE_KEY);
  console.log("[ChapterID] Cache cleared");
}

/**
 * Debug function to check chapter ID cache status
 */
export function debugChapterIdCache(): { cached: string | null; valid: boolean } {
  const cached = getCachedChapterId();
  return {
    cached,
    valid: cached !== null
  };
}

/**
 * Get chapter ID - uses cache first, falls back to API call
 * @param forceRefresh - If true, bypass cache and fetch fresh from API
 */
export async function getChapterId(forceRefresh: boolean = false): Promise<string | null> {
  // Try cache first (unless forcing refresh)
  if (!forceRefresh) {
    const cached = getCachedChapterId();
    if (cached) {
      console.log("[ChapterID] Using cached chapter ID:", cached);
      return cached;
    }
  } else {
    console.log("[ChapterID] Force refresh - clearing cache");
    clearCachedChapterId();
  }
  
  // Fetch from API
  try {
    console.log("[ChapterID] Fetching chapters from API...");
    const chapters = await api<{ id: string; name: string }[]>("/chapters", { timeout: 15000 });
    console.log("[ChapterID] API returned chapters:", chapters);
    
    if (!chapters || chapters.length === 0) {
      console.warn("[ChapterID] No chapters returned from API");
      return null;
    }
    
    const chapterId = chapters[0]?.id || null;
    if (chapterId) {
      console.log("[ChapterID] Caching chapter ID:", chapterId, "for chapter:", chapters[0]?.name);
      setCachedChapterId(chapterId);
    } else {
      console.warn("[ChapterID] Chapter ID is null");
    }
    return chapterId;
  } catch (e: any) {
    console.error("[ChapterID] Failed to fetch chapter ID:", e);
    console.error("[ChapterID] Error details:", e?.message || e);
    return null;
  }
}

/**
 * Check if backend server is reachable
 */
export async function checkBackendHealth(): Promise<{ reachable: boolean; error?: string }> {
  try {
    // Health endpoint is at root level, not under /api
    const baseUrl = API_BASE.replace('/api', '');
    const healthUrl = `${baseUrl}/health`;
    const res = await fetch(healthUrl, { 
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    });
    return { reachable: res.ok };
  } catch (error: any) {
    return { 
      reachable: false, 
      error: error.message || 'Backend server not reachable' 
    };
  }
}

export async function api<T>(path: string, opts?: { method?: HttpMethod; body?: any; headers?: Record<string, string>; timeout?: number }): Promise<T> {
  const url = `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  const token = getToken();
  const timeout = opts?.timeout || 20000; // 20 second default timeout (increased for Render free tier)
  
  // Debug: log the URL being called (always log API_BASE in production for debugging)
  if (typeof window !== "undefined") {
    if (process.env.NODE_ENV === "development") {
      console.log(`[API] ${opts?.method || "GET"} ${url}`);
    } else {
      // In production, log API_BASE on first call to help debug
      if (!(window as any).__API_BASE_LOGGED) {
        console.log(`[API] Using backend URL: ${API_BASE}`);
        console.log(`[API] Env vars - NEXT_PUBLIC_API_BASE_URL: ${process.env.NEXT_PUBLIC_API_BASE_URL || 'not set'}, NEXT_PUBLIC_API_URL: ${process.env.NEXT_PUBLIC_API_URL || 'not set'}`);
        (window as any).__API_BASE_LOGGED = true;
      }
    }
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
      let errorMessage = text || `Request failed: ${res.status}`;
      
      // Handle specific HTTP status codes
      if (res.status === 401) {
        // Authentication error - token might be invalid or expired
        errorMessage = `Authentication failed (401). Your session may have expired. Please try logging out and back in.`;
      } else if (res.status === 403) {
        errorMessage = `Access forbidden (403). You may not have permission to access this resource.`;
      } else if (res.status === 404) {
        errorMessage = `Resource not found (404). The requested endpoint does not exist.`;
      } else if (res.status >= 500) {
        errorMessage = `Server error (${res.status}). The backend server encountered an error.`;
      }
      
      const error = new Error(errorMessage);
      (error as any).status = res.status;
      throw error;
    }
    const ct = res.headers.get("content-type");
    if (ct && ct.includes("application/json")) return (await res.json()) as T;
    return (await res.text()) as T;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeout}ms. Is the backend server running at ${API_BASE}?`);
    }
    
    // Handle network errors (connection refused, CORS, etc.)
    if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
      const isProduction = typeof window !== 'undefined' && window.location.hostname !== 'localhost';
      const envVarName = process.env.NEXT_PUBLIC_API_BASE_URL ? 'NEXT_PUBLIC_API_BASE_URL' : 
                        (process.env.NEXT_PUBLIC_API_URL ? 'NEXT_PUBLIC_API_URL' : 'NEXT_PUBLIC_API_BASE_URL');
      
      let errorMsg = `Cannot connect to backend server at ${API_BASE}. `;
      
      if (isProduction) {
        errorMsg += `\n\nThis appears to be a production deployment issue. Please check:\n`;
        errorMsg += `1. Is your Render backend service running and healthy?\n`;
        errorMsg += `2. Is ${envVarName} set correctly in Vercel environment variables?\n`;
        errorMsg += `3. Is ALLOWED_ORIGINS set correctly in Render to include your Vercel domain?\n`;
        errorMsg += `4. Check Render logs for any errors.\n`;
        errorMsg += `\nCurrent API URL: ${API_BASE}`;
      } else {
        errorMsg += `\n\nPlease check:\n`;
        errorMsg += `1. Is the backend server running locally?\n`;
        errorMsg += `2. Is ${envVarName} set correctly in .env.local?\n`;
        errorMsg += `3. Are there any CORS issues?\n`;
        errorMsg += `4. Check browser console for more details\n`;
        errorMsg += `\nCurrent API URL: ${API_BASE}`;
      }
      
      throw new Error(errorMsg);
    }
    
    // Re-throw with original message if it exists
    throw error;
  }
}

// ── Chapter theme & fraternity colors ───────────────────────────
export interface ChapterTheme {
  enabled: boolean;
  accent_hex: string | null;
  source: "auto" | "manual";
}

export interface FraternityColor {
  key: string;
  name: string;
  hex_primary: string;
}

export async function getChapterTheme(): Promise<ChapterTheme> {
  return api<ChapterTheme>("/chapters/me/theme");
}

export async function updateChapterTheme(patch: ChapterTheme): Promise<ChapterTheme> {
  return api<ChapterTheme>("/chapters/me/theme", { method: "PATCH", body: patch });
}

export async function getFraternityColors(): Promise<FraternityColor[]> {
  return api<FraternityColor[]>("/fraternity-colors");
}

// ── PPTX Export ────────────────────────────────────────────────────
export interface PnmExportFilters {
  search?: string;
  tags?: string[];
}

export async function exportPnmsPptx(
  filters: PnmExportFilters,
  sort?: string,
): Promise<{ blob: Blob; filename: string }> {
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
  const res = await fetch(`${API_BASE}/pnms/export/pptx`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ filters, sort: sort ?? null }),
  });
  if (!res.ok) {
    let detail = `Export failed (${res.status})`;
    try {
      const j = await res.json();
      if (j?.detail) detail = j.detail;
    } catch {}
    throw new Error(detail);
  }
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match?.[1] || "pnms.pptx";
  const blob = await res.blob();
  return { blob, filename };
}

export function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
