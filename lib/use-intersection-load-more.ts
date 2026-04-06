import { useEffect, useRef } from "react";

/** When `enabled` and the sentinel intersects the viewport, calls `loadMore`. Re-binds when `resetKey` changes so another page can load if the sentinel stays on screen. */
export function useIntersectionLoadMore(
  loadMore: () => void | Promise<void>,
  enabled: boolean,
  resetKey: number | string
) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef(loadMore);
  loadMoreRef.current = loadMore;

  useEffect(() => {
    if (!enabled) return;
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        void loadMoreRef.current();
      },
      { root: null, rootMargin: "400px 0px", threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [enabled, resetKey]);

  return sentinelRef;
}
