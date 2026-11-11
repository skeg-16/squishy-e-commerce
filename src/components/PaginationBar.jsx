export default function PaginationBar({
  page = 1,
  totalPages = 1,
  totalItems = 0,
  pageSize = 6,
  onPageChange,
  pageSizeOptions = null,
  onPageSizeChange = null,
  itemLabel = 'items',
  compact = false,
}) {
  if (totalItems <= 0) return null;

  const safePage = Math.min(Math.max(1, page), Math.max(1, totalPages));
  const startItem = (safePage - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, safePage * pageSize);

  const pages = [];
  for (let i = 1; i <= totalPages; i += 1) {
    if (
      i === 1 ||
      i === totalPages ||
      Math.abs(i - safePage) <= 1
    ) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== '…') {
      pages.push('…');
    }
  }

  return (
    <nav
      className={`jelly-pagination${compact ? ' jelly-pagination--compact' : ''}`}
      aria-label="Pagination"
    >
      <div className="jelly-pagination__meta">
        <span className="jelly-pagination__summary">
          Showing <strong>{startItem}–{endItem}</strong> of{' '}
          <strong>{totalItems}</strong> {itemLabel}
        </span>

        {Array.isArray(pageSizeOptions) &&
          pageSizeOptions.length > 1 &&
          typeof onPageSizeChange === 'function' && (
            <div
              className="jelly-pagination__size"
              role="group"
              aria-label="Items per page"
            >
              {pageSizeOptions.map((size) => (
                <button
                  key={size}
                  type="button"
                  className={`jelly-pagination__size-btn${
                    pageSize === size ? ' is-active' : ''
                  }`}
                  aria-pressed={pageSize === size}
                  onClick={() => onPageSizeChange(size)}
                >
                  {size} / page
                </button>
              ))}
            </div>
          )}
      </div>

      {totalPages > 1 && (
        <div className="jelly-pagination__controls">
          <button
            type="button"
            className="jelly-pagination__nav"
            disabled={safePage <= 1}
            onClick={() => onPageChange(safePage - 1)}
            aria-label="Previous page"
          >
            ← Prev
          </button>

          <div className="jelly-pagination__pages" role="list">
            {pages.map((item, idx) =>
              item === '…' ? (
                <span
                  key={`ellipsis-${idx}`}
                  className="jelly-pagination__ellipsis"
                  aria-hidden="true"
                >
                  …
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  className={`jelly-pagination__page${
                    item === safePage ? ' is-active' : ''
                  }`}
                  aria-current={item === safePage ? 'page' : undefined}
                  onClick={() => onPageChange(item)}
                >
                  {item}
                </button>
              )
            )}
          </div>

          <button
            type="button"
            className="jelly-pagination__nav"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(safePage + 1)}
            aria-label="Next page"
          >
            Next →
          </button>
        </div>
      )}
    </nav>
  );
}

