/** When the data-use notice must be shown: first visit, or after 24 hours away. */
export const ACK_KEY = "lanka-academia-last-visit-v2";
export const ACK_WINDOW_MS = 24 * 60 * 60 * 1000;

type Store = Pick<Storage, "getItem" | "setItem">;
const local = (): Store | null => {
  try {
    return localStorage;
  } catch {
    return null;
  }
};

/** Last recorded visit in ms, or null when missing, invalid, in the future or storage is blocked. */
export function lastVisit(now = Date.now(), store: Store | null = local()): number | null {
  try {
    const raw = store?.getItem(ACK_KEY);
    if (!raw || !/^\d{1,15}$/.test(raw)) return null;
    const t = Number(raw);
    return t > 0 && t <= now ? t : null;
  } catch {
    return null;
  }
}

/** True when the visitor still has to accept the notice. */
export function ackRequired(now = Date.now(), store: Store | null = local()): boolean {
  const t = lastVisit(now, store);
  return t === null || now - t >= ACK_WINDOW_MS;
}

/** Record this moment as the latest visit (call on arrival, resume and leaving; never on a timer). */
export function recordVisit(now = Date.now(), store: Store | null = local()): void {
  try {
    store?.setItem(ACK_KEY, String(now));
  } catch {
    /* the notice simply shows again next visit */
  }
}

/**
 * Decide on arrival or resume. Within 24 hours the visit is refreshed and no notice is shown.
 * Accepting refreshes the timestamp, so one session is never asked twice unless it sat idle for 24 hours.
 */
export function needsNoticeOnArrival(now = Date.now()): boolean {
  if (ackRequired(now)) return true;
  recordVisit(now);
  return false;
}
