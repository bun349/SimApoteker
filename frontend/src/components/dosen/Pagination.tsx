import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

function pageWindow(cur: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [...new Set([1, total, cur - 1, cur, cur + 1])]
    .filter((n) => n >= 1 && n <= total)
    .sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  pages.forEach((p, i) => {
    if (i > 0 && p - pages[i - 1] > 1) out.push("…");
    out.push(p);
  });
  return out;
}

export function Pagination({
  page, totalPages, onChange,
}: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  const btn = "grid h-8 min-w-8 place-items-center rounded-md px-2 text-sm text-muted/80 hover:bg-black/5 hover:text-ink disabled:pointer-events-none disabled:opacity-40";

  return (
    <nav aria-label="Paginasi" className="flex items-center justify-center gap-1 pt-2">
      <button className={btn} disabled={page === 1} onClick={() => onChange(page - 1)} aria-label="Halaman sebelumnya">
        <ChevronLeft size={16} />
      </button>
      {pageWindow(page, totalPages).map((p, i) =>
        p === "…" ? (
          <span key={`gap-${i}`} className="px-1 text-sm text-muted/60">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            aria-current={p === page ? "page" : undefined}
            className={cn(btn, p === page && "bg-white font-semibold text-navy-900 shadow-sm ring-1 ring-line")}
          >
            {p}
          </button>
        ),
      )}
      <button className={btn} disabled={page === totalPages} onClick={() => onChange(page + 1)} aria-label="Halaman berikutnya">
        <ChevronRight size={16} />
      </button>
    </nav>
  );
}