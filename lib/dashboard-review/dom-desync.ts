// A DOM desync: the page's DOM no longer matches what React rendered.
//
// The usual cause is a browser's machine translation (Chrome, Edge), which
// replaces text nodes with elements of its own; an extension can do the same.
// React then fails to remove or insert a node that is no longer where it put
// it, and the browser throws a DOMException named NotFoundError from
// removeChild / insertBefore. That is not a data or server failure, and the
// error screen must not present it as one. The panels avoid it by replacing,
// not patching, their content (Fresh in components/dashboard-review/
// pillar-b-panels.tsx); this module lets the error boundary recognise any case
// that remains and reload once.
//
// PURE apart from the storage passed in, so it is tested without a browser.

/** The "node is not here" clauses of Chromium's and Firefox's messages for these failures. */
const DESYNC_MESSAGE = /node to be removed is not a child of this node|before which the new node is to be inserted is not a child of this node/i;

/** DOMException's legacy code for NotFoundError (stable across browsers and jsdom). */
const NOT_FOUND_ERR = 8;

/**
 * True for the DOMException itself (named NotFoundError with its legacy code,
 * or carrying the Chromium / Firefox wording), never for an error a server
 * component sent (it carries a digest). Through a Next.js error boundary React
 * delivers the raw DOMException; `errors` and `cause` are also searched, as a
 * defence, because React's development-only act() aggregates such errors.
 */
export function isDomDesync(error: unknown, depth = 0): boolean {
  if (typeof error !== "object" || error === null || depth > 3) return false;
  const e = error as { name?: unknown; code?: unknown; message?: unknown; digest?: unknown; errors?: unknown; cause?: unknown };
  if (e.digest !== undefined) return false;
  if (e.name === "NotFoundError" && (e.code === NOT_FOUND_ERR || (typeof e.message === "string" && DESYNC_MESSAGE.test(e.message)))) return true;
  if (typeof e.message === "string" && DESYNC_MESSAGE.test(e.message)) return true;
  if (Array.isArray(e.errors) && e.errors.some((inner) => isDomDesync(inner, depth + 1))) return true;
  return e.cause !== undefined && isDomDesync(e.cause, depth + 1);
}

/** The storage key and how close to a reload a document must start to be that reload's product. */
export const DESYNC_RELOAD_KEY = "vis:dom-desync-reload";
export const DESYNC_RELOAD_WINDOW_MS = 5_000;

type Store = Pick<Storage, "getItem" | "setItem">;

/** sessionStorage, or null where the browser refuses it (the getter itself can throw). */
export function sessionStore(): Store | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * True unless THIS document is the product of a desync reload: a document
 * whose navigation started within a few seconds of the stored mark. The guard
 * is the document, not the clock, because this page takes 10–40 s to stream:
 * a wall-clock window would expire before the reloaded page could even be
 * used, and a recurring desync would reload forever. Without storage there is
 * no way to tell, so no automatic reload.
 */
export function shouldReloadAfterDesync(store: Store | null, documentStart: number): boolean {
  if (store === null) return false;
  try {
    const last = Number(store.getItem(DESYNC_RELOAD_KEY) ?? 0);
    if (!Number.isFinite(last) || last <= 0) return true;
    const sinceMark = documentStart - last;
    return !(sinceMark >= -1_000 && sinceMark < DESYNC_RELOAD_WINDOW_MS);
  } catch {
    return false;
  }
}

export function markDesyncReload(store: Store | null, now: number): void {
  try {
    store?.setItem(DESYNC_RELOAD_KEY, String(now));
  } catch {
    // Storage refused: the reload still happens once, from this mount.
  }
}
