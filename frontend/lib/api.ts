import { getAccessToken, refreshAccessToken, SIGNED_OUT_EVENT } from "@/lib/auth";

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

export async function api<T>(
  path: string,
  opts?: {
    method?: HttpMethod;
    body?: any;
    headers?: Record<string, string>;
    timeout?: number;
    /** internal: set when this call is the post-refresh retry */
    __retried?: boolean;
  },
): Promise<T> {
  const url = `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  const token = await getAccessToken();
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
      if (res.status === 401 && !opts?.__retried) {
        // The cached session may simply be stale. Refresh once and retry before
        // surfacing anything to the user -- this is the path that used to force
        // a manual log out / log in every hour.
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          return api<T>(path, { ...opts, __retried: true } as typeof opts);
        }
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event(SIGNED_OUT_EVENT));
        }
        errorMessage = "Your session has expired. Please sign in again.";
      } else if (res.status === 401) {
        errorMessage = "Your session has expired. Please sign in again.";
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
  const token = await getAccessToken();
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

// ── Chapter Provisioning ────────────────────────────────────────────────────
export interface ProvisionRequest {
  fraternity_name: string;
  school: string;
  chapter_name: string;
  admin_name: string;
}

export async function provisionChapter(req: ProvisionRequest): Promise<{ chapter_id: string }> {
  return api<{ chapter_id: string }>("/chapters/provision", { method: "POST", body: req });
}

// ── Bid list ────────────────────────────────────────────────────────────────
// The backend for this has been complete and tested since May with no UI at
// all. Twelve routes, a 10-minute editor lock with takeover, and CSV + PDF
// export -- none of it reachable.

export type BidBucket = "bid" | "maybe" | "cut";

export interface BidListEntry {
  pnm_id: string;
  bucket: BidBucket;
  position: number;
  name: string;
  year: string;
  major: string;
  photo_url: string | null;
  vote_summary: { up: number; down: number; star: number };
}

export interface BidList {
  id: string;
  chapter_id: string;
  source_round_id: string | null;
  name: string;
  bid_cap: number | null;
  locked_by: string | null;
  locked_at: string | null;
  finalized_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BidListWithEntries {
  bid_list: BidList;
  entries: BidListEntry[];
}

/** 404 when the chapter has no bid list yet -- callers treat that as "empty". */
export async function getBidList(): Promise<BidListWithEntries> {
  return api<BidListWithEntries>("/chapters/me/bid-list");
}

export async function createBidList(body: {
  source_round_id: string;
  name: string;
  bid_cap?: number | null;
}): Promise<BidList> {
  return api<BidList>("/chapters/me/bid-list", { method: "POST", body });
}

export async function acquireBidListLock(): Promise<BidList> {
  return api<BidList>("/chapters/me/bid-list/lock", { method: "POST" });
}

export async function refreshBidListLock(): Promise<BidList> {
  return api<BidList>("/chapters/me/bid-list/lock/refresh", { method: "POST" });
}

export async function releaseBidListLock(): Promise<void> {
  await api("/chapters/me/bid-list/lock", { method: "DELETE" });
}

export async function updateBidListEntry(
  pnmId: string,
  body: { bucket: BidBucket; position: number },
): Promise<unknown> {
  return api(`/chapters/me/bid-list/entries/${pnmId}`, { method: "PATCH", body });
}

export async function finalizeBidList(): Promise<BidList> {
  return api<BidList>("/chapters/me/bid-list/finalize", { method: "POST" });
}

/** CSV and PDF come back as file bodies, so they bypass api()'s JSON handling. */
export async function downloadBidList(format: "csv" | "pdf"): Promise<{ blob: Blob; filename: string }> {
  const { getAccessToken } = await import("@/lib/auth");
  const token = await getAccessToken();
  const res = await fetch(`${API_BASE}/chapters/me/bid-list/export/${format}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Export failed (${res.status})`);
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="([^"]+)"/);
  return { blob: await res.blob(), filename: match?.[1] || `bid-list.${format}` };
}

// ── Roster import ───────────────────────────────────────────────────────────

export interface ImportIssue {
  row: number;
  message: string;
}

export interface ImportDuplicate {
  row: number;
  name: string;
  email: string | null;
  existing_id: string;
}

export interface ImportResult {
  columns: string[];
  /** csv column -> pnm field. Columns the server could not place are absent. */
  mapping: Record<string, string>;
  total: number;
  valid: number;
  skipped: number;
  errors: ImportIssue[];
  duplicates: ImportDuplicate[];
  preview: Array<Record<string, any>>;
  dry_run: boolean;
  imported: number;
  pnm_ids: string[];
}

export const IMPORT_FIELDS = [
  "name", "email", "phone", "major", "hometown", "year", "photo_url", "tags",
] as const;

/**
 * Upload a roster CSV. Parsing happens server-side, so the preview is produced
 * by the same code that will do the insert -- what you approve is what runs.
 *
 * Multipart, so this bypasses api()'s JSON body handling; the 401 refresh-retry
 * is not reproduced here because an import is an explicit user action that can
 * simply be retried.
 */
export async function importPnmsCsv(
  chapterId: string,
  file: File,
  opts: { dryRun: boolean; mapping?: Record<string, string> },
): Promise<ImportResult> {
  const { getAccessToken } = await import("@/lib/auth");
  const token = await getAccessToken();

  const params = new URLSearchParams({
    chapter_id: chapterId,
    dry_run: String(opts.dryRun),
  });
  if (opts.mapping) params.set("mapping", JSON.stringify(opts.mapping));

  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${API_BASE}/pnms/import?${params}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });

  if (!res.ok) {
    let detail = `Import failed (${res.status})`;
    try {
      const j = await res.json();
      if (j?.detail) detail = j.detail;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(detail);
  }
  return (await res.json()) as ImportResult;
}

// ── Round cutoffs ───────────────────────────────────────────────────────────

export type CutoffMode = "top_n" | "min_yes_pct";

export interface CutoffCandidate {
  id: string;
  name: string;
  yes_percentage: number;
  vote_count: number;
  favorite_count: number;
}

export interface CutoffResult {
  mode: CutoffMode;
  value: number;
  /** What was asked for, when it differs from advanced_count because of ties. */
  requested_count: number | null;
  advanced_count: number;
  cut_count: number;
  advanced: CutoffCandidate[];
  cut: CutoffCandidate[];
  dry_run: boolean;
  next_round_id: string | null;
  next_round_room_code?: string | null;
  archived_count: number;
}

export async function applyCutoff(
  roundId: string,
  body: {
    mode: CutoffMode;
    value: number;
    next_round_type?: "GENERAL" | "INVITE" | "BID";
    archive_cut?: boolean;
    dry_run: boolean;
  },
): Promise<CutoffResult> {
  return api<CutoffResult>(`/rounds/${roundId}/cutoff`, { method: "POST", body });
}

// ── Audit log ───────────────────────────────────────────────────────────────

export interface AuditEntry {
  id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  before: any;
  after: any;
  created_at: string;
  actor_user_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
}

export async function getAuditLog(
  chapterId: string,
  opts?: { limit?: number; before?: string; action?: string },
): Promise<{ entries: AuditEntry[]; next_before: string | null }> {
  const params = new URLSearchParams();
  if (opts?.limit) params.set("limit", String(opts.limit));
  if (opts?.before) params.set("before", opts.before);
  if (opts?.action) params.set("action", opts.action);
  const query = params.toString();
  return api(`/chapters/${chapterId}/audit-log${query ? `?${query}` : ""}`);
}

// ── Demo mode ───────────────────────────────────────────────────────────────

/**
 * Exchange nothing for a session on the seeded read-only demo chapter. The
 * credentials live on the server; a 404 means this deployment has no demo
 * configured, which callers treat as "hide the demo entry point".
 */
export async function startDemoSession(): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  return api("/public/demo-session", { method: "POST" });
}
