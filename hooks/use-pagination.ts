import { useState, useMemo } from 'react';

export function usePagination<T>(items: T[], itemsPerPage: number = 10) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(items.length / itemsPerPage);

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return items.slice(start, start + itemsPerPage);
  }, [items, currentPage, itemsPerPage]);

  // Reset to page 1 if current page is out of bounds (e.g. after filtering/deletion)
  if (currentPage > totalPages && totalPages > 0) {
    setCurrentPage(1);
  }

  return {
    paginatedItems,
    currentPage,
    totalPages,
    setCurrentPage,
  };
}
