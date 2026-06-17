import { useState } from 'react';

/** Client-side pagination for box grids. */
export function usePaged<T>(items: T[], size = 9) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(items.length / size));
  const p = Math.min(page, totalPages - 1);
  return {
    pageItems: items.slice(p * size, p * size + size),
    page: p,
    setPage,
    totalPages,
    total: items.length,
  };
}
