import { useState, useEffect, useCallback, useRef } from 'react';

interface PaginationMeta {
  next_cursor: string | null;
  has_more: boolean;
  limit: number;
}

interface UseCursorListOptions<F> {
  fetcher: (cursor: string | null, filters: F) => Promise<{ items: unknown[]; pagination: PaginationMeta }>;
  filters: F;
  debounceMs?: number;
}

export function useCursorList<T, F>({ fetcher, filters, debounceMs = 400 }: UseCursorListOptions<F>) {
  const [items, setItems] = useState<T[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isFirstLoadRef = useRef(true);

  // Keep latest fetcher and filters in refs — no re-renders, no new load reference
  const fetcherRef = useRef(fetcher);
  const filtersRef = useRef(filters);
  fetcherRef.current = fetcher;
  filtersRef.current = filters;

  // load is now stable — never changes identity
  const load = useCallback(async (cursor: string | null, reset: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcherRef.current(cursor, filtersRef.current);
      if (reset) {
        setItems(result.items as T[]);
      } else {
        setItems(prev => [...prev, ...(result.items as T[])]);
      }
      setNextCursor(result.pagination.next_cursor);
      setHasMore(result.pagination.has_more);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []); // stable — no deps needed

  useEffect(() => {
    if (isFirstLoadRef.current) {
      isFirstLoadRef.current = false;
      load(null, true);
      return;
    }

    const timer = setTimeout(() => {
      load(null, true);
    }, debounceMs);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters), debounceMs]);

  const loadMore = useCallback(() => {
    if (hasMore && !loading && nextCursor) load(nextCursor, false);
  }, [hasMore, loading, nextCursor, load]);

  const refresh = useCallback(() => load(null, true), [load]);

  return { items, hasMore, loading, error, loadMore, refresh };
}
