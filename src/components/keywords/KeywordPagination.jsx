export default function KeywordPagination({ page, setPage, totalPages, total, pageSize = 20 }) {
  if (total <= pageSize) return null;
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, start + 4);
  const pages = Array.from({ length: end - start + 1 }, (_, index) => start + index);
  return (
    <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] px-5 py-3 text-xs text-white/45">
      <span>{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}</span>
      <div className="flex items-center gap-1">
        <button className="ui-button gke-secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
        {pages.map((number) => <button key={number} className={`ui-button ${number === page ? "ui-button-primary" : "gke-secondary"}`} onClick={() => setPage(number)}>{number}</button>)}
        <button className="ui-button gke-secondary" disabled={page === totalPages} onClick={() => setPage(page + 1)}>Next</button>
      </div>
    </div>
  );
}
