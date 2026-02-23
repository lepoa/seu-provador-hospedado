type LogLevel = "info" | "warn" | "error";

type TraceMetadata = Record<string, unknown>;

interface RuntimeLogEntry {
  seq: number;
  ts: string;
  session: string;
  level: LogLevel;
  scope: string;
  action: string;
  details: unknown;
}

interface RuntimeTraceState {
  installed: boolean;
  sessionId: string;
  sequence: number;
  entries: RuntimeLogEntry[];
}

declare global {
  interface Window {
    __SAAS_TRACE__?: RuntimeTraceState;
  }
}

const TRACE_PREFIX = "[SAAS-TRACE]";
const TRACE_STORAGE_KEY = "saas_trace_entries";
const CHUNK_RELOAD_KEY = "saas_chunk_reload_once";
const TRACE_MAX_ENTRIES = 5000;
const TRACE_MAX_STRING = 1200;
const TRACE_MAX_KEYS = 40;
const TRACE_MAX_ARRAY_ITEMS = 50;
const TRACE_MAX_DEPTH = 5;

let traceState: RuntimeTraceState | null = null;

function generateSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getTraceState(): RuntimeTraceState {
  if (traceState) return traceState;

  const existing = typeof window !== "undefined" ? window.__SAAS_TRACE__ : undefined;
  if (existing) {
    traceState = existing;
    return traceState;
  }

  traceState = {
    installed: false,
    sessionId: generateSessionId(),
    sequence: 0,
    entries: [],
  };

  if (typeof window !== "undefined") {
    window.__SAAS_TRACE__ = traceState;
  }

  return traceState;
}

function limitString(value: string): string {
  if (value.length <= TRACE_MAX_STRING) return value;
  return `${value.slice(0, TRACE_MAX_STRING)}...<truncated>`;
}

function sanitizeForLog(input: unknown, depth = 0): unknown {
  if (depth >= TRACE_MAX_DEPTH) return "<max-depth>";
  if (input === null || input === undefined) return input;

  const inputType = typeof input;

  if (inputType === "string") return limitString(input as string);
  if (inputType === "number" || inputType === "boolean") return input;
  if (inputType === "bigint") return String(input);
  if (inputType === "function") return "<function>";

  if (Array.isArray(input)) {
    return input.slice(0, TRACE_MAX_ARRAY_ITEMS).map((value) => sanitizeForLog(value, depth + 1));
  }

  if (input instanceof Error) {
    return {
      name: input.name,
      message: limitString(input.message),
      stack: limitString(input.stack || ""),
    };
  }

  if (input instanceof URL) {
    return input.toString();
  }

  if (input instanceof URLSearchParams) {
    return limitString(input.toString());
  }

  if (input instanceof FormData) {
    const keys: string[] = [];
    for (const [key] of input.entries()) {
      keys.push(key);
      if (keys.length >= TRACE_MAX_ARRAY_ITEMS) break;
    }
    return { formDataKeys: keys };
  }

  if (input instanceof Blob) {
    return { blob: { size: input.size, type: input.type } };
  }

  if (inputType === "object") {
    const rawObject = input as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    const keys = Object.keys(rawObject).slice(0, TRACE_MAX_KEYS);
    for (const key of keys) {
      result[key] = sanitizeForLog(rawObject[key], depth + 1);
    }
    if (Object.keys(rawObject).length > TRACE_MAX_KEYS) {
      result.__truncated_keys = Object.keys(rawObject).length - TRACE_MAX_KEYS;
    }
    return result;
  }

  return "<unsupported>";
}

function persistTraceEntries(entries: RuntimeLogEntry[]): void {
  try {
    localStorage.setItem(TRACE_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Best-effort persistence for diagnostics.
  }
}

function normalizeFetchBody(body: BodyInit | null | undefined): unknown {
  if (!body) return null;

  if (typeof body === "string") return limitString(body);
  if (body instanceof URLSearchParams) return limitString(body.toString());
  if (body instanceof FormData) return sanitizeForLog(body);
  if (body instanceof Blob) return sanitizeForLog(body);

  return `<body:${Object.prototype.toString.call(body)}>`;
}

function describeElement(element: Element | null): TraceMetadata {
  if (!element || !(element instanceof HTMLElement)) return { tag: "unknown" };

  return {
    tag: element.tagName.toLowerCase(),
    id: element.id || null,
    name: element.getAttribute("name"),
    type: element.getAttribute("type"),
    text: limitString((element.textContent || "").trim()),
    className: limitString(element.className || ""),
  };
}

function extractChunkErrorMessage(reason: unknown): string {
  if (!reason) return "";
  if (typeof reason === "string") return reason;
  if (reason instanceof Error) return `${reason.name}: ${reason.message}`;
  if (typeof reason === "object" && reason !== null && "message" in reason) {
    const maybeMessage = (reason as Record<string, unknown>).message;
    if (typeof maybeMessage === "string") return maybeMessage;
  }
  return String(reason);
}

function shouldRecoverChunkError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("failed to fetch dynamically imported module") ||
    normalized.includes("importing a module script failed")
  );
}

function buildReloadUrlWithCacheBust(): string {
  const url = new URL(window.location.href);
  url.searchParams.set("_chunk_retry", Date.now().toString());
  return url.toString();
}

function attemptChunkErrorRecovery(reason: unknown): void {
  if (typeof window === "undefined") return;

  const message = extractChunkErrorMessage(reason);
  if (!shouldRecoverChunkError(message)) return;

  const currentKey = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const previousKey = sessionStorage.getItem(CHUNK_RELOAD_KEY);

  if (previousKey === currentKey) {
    runtimeLog(
      "runtime",
      "chunk-load:recover:skipped",
      { key: currentKey, message },
      "error",
    );
    return;
  }

  sessionStorage.setItem(CHUNK_RELOAD_KEY, currentKey);
  const reloadUrl = buildReloadUrlWithCacheBust();
  runtimeLog(
    "runtime",
    "chunk-load:recover:reload",
    { key: currentKey, reloadUrl, message },
    "warn",
  );
  window.location.replace(reloadUrl);
}

export function runtimeLog(scope: string, action: string, details: unknown = {}, level: LogLevel = "info"): RuntimeLogEntry {
  const state = getTraceState();
  state.sequence += 1;

  const entry: RuntimeLogEntry = {
    seq: state.sequence,
    ts: new Date().toISOString(),
    session: state.sessionId,
    level,
    scope,
    action,
    details: sanitizeForLog(details),
  };

  state.entries.push(entry);
  if (state.entries.length > TRACE_MAX_ENTRIES) {
    state.entries.splice(0, state.entries.length - TRACE_MAX_ENTRIES);
  }

  persistTraceEntries(state.entries);

  const payload = JSON.stringify(entry);
  if (level === "error") {
    console.error(TRACE_PREFIX, payload);
  } else if (level === "warn") {
    console.warn(TRACE_PREFIX, payload);
  } else {
    console.log(TRACE_PREFIX, payload);
  }

  return entry;
}

export function getRuntimeLogs(): RuntimeLogEntry[] {
  return [...getTraceState().entries];
}

export function installRuntimeDiagnostics(): void {
  if (typeof window === "undefined") return;

  const state = getTraceState();
  if (state.installed) return;

  state.installed = true;
  window.__SAAS_TRACE__ = state;

  runtimeLog("diagnostics", "install", {
    href: window.location.href,
    userAgent: navigator.userAgent,
  });

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const method = init?.method || (input instanceof Request ? input.method : "GET");
    const url = input instanceof Request ? input.url : input.toString();
    const startedAt = performance.now();

    runtimeLog("network", "request:start", {
      requestId,
      method,
      url,
      body: normalizeFetchBody(init?.body || (input instanceof Request ? input.body : null)),
    });

    try {
      const response = await originalFetch(input, init);
      const durationMs = Number((performance.now() - startedAt).toFixed(2));
      let responseBody: string | null = null;

      if (!response.ok) {
        try {
          responseBody = limitString(await response.clone().text());
        } catch {
          responseBody = "<unreadable>";
        }
      }

      runtimeLog(
        "network",
        "request:done",
        {
          requestId,
          method,
          url,
          status: response.status,
          ok: response.ok,
          durationMs,
          responseBody,
        },
        response.ok ? "info" : "warn",
      );

      return response;
    } catch (error) {
      const durationMs = Number((performance.now() - startedAt).toFixed(2));
      runtimeLog(
        "network",
        "request:error",
        {
          requestId,
          method,
          url,
          durationMs,
          error,
        },
        "error",
      );
      throw error;
    }
  };

  window.addEventListener("error", (event) => {
    runtimeLog(
      "runtime",
      "window:error",
      {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error,
      },
      "error",
    );

    attemptChunkErrorRecovery(event.error || event.message);
  });

  window.addEventListener("unhandledrejection", (event) => {
    runtimeLog("runtime", "window:unhandledrejection", { reason: event.reason }, "error");
    attemptChunkErrorRecovery(event.reason);
  });

  document.addEventListener(
    "click",
    (event) => {
      const target = event.target as Element | null;
      const clickable = target?.closest("button, a, [role='button'], input[type='submit']");
      if (!clickable) return;

      runtimeLog("ui", "click", {
        location: window.location.pathname,
        element: describeElement(clickable),
      });
    },
    true,
  );

  document.addEventListener(
    "submit",
    (event) => {
      const target = event.target as Element | null;
      runtimeLog("ui", "submit", {
        location: window.location.pathname,
        element: describeElement(target),
      });
    },
    true,
  );

  const logNavigation = (source: string) => {
    runtimeLog("navigation", source, {
      href: window.location.href,
      pathname: window.location.pathname,
      search: window.location.search,
    });
  };

  window.addEventListener("popstate", () => logNavigation("popstate"));
  window.addEventListener("hashchange", () => logNavigation("hashchange"));
}
