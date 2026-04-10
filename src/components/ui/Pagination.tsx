interface PaginationProps {
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
}

export default function Pagination({ hasMore, loading, onLoadMore }: PaginationProps) {
  if (!hasMore && !loading) return null;
  return (
    <div className="mt-4 flex justify-center">
      <button
        onClick={onLoadMore}
        disabled={loading || !hasMore}
        className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Loading…' : 'Load more'}
      </button>
    </div>
  );
}
