import { useEffect, useMemo, useState } from "react";

export function useClientPagination(rows, resetKey, pageSize = 20) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  useEffect(() => { setPage(1); }, [resetKey]);
  const safePage = Math.min(page, totalPages);
  const pageRows = useMemo(() => rows.slice((safePage - 1) * pageSize, safePage * pageSize), [rows, safePage, pageSize]);
  return { page: safePage, setPage, totalPages, pageRows, total: rows.length, pageSize };
}

