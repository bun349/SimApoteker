import { useMemo, useState } from "react";
import {
  Check,
  Clock,
  Copy,
  Download,
  MessageSquare,
  Search,
  ShieldAlert,
  X,
} from "lucide-react";
import type {
  ClinicalCriterionItem,
  CriticalErrorItem,
  PactCriterionItem,
  RaporTranscriptRow,
} from "@/api/evaluation";
import { formatMmSs } from "@/hooks/useSimulationSession";
import { cn } from "@/lib/utils";

type DrawerFilter = "semua" | "bukti" | "kesalahan";

interface TranscriptDrawerProps {
  open: boolean;
  onClose: () => void;
  sessionCode: string;
  durationSec: number;
  transcript: RaporTranscriptRow[];
  clinicalItems: ClinicalCriterionItem[];
  pactCriteria: PactCriterionItem[];
  criticalErrors: CriticalErrorItem[];
  studentSpeakerLabel?: string;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderHighlightedText(text: string, highlights: string[]) {
  const valid = highlights.map((h) => h.trim()).filter((h) => h.length >= 4);
  if (valid.length === 0) return text;
  const pattern = new RegExp(`(${valid.map(escapeRegExp).join("|")})`, "gi");
  const parts = text.split(pattern);
  return parts.map((part, idx) =>
    valid.some((v) => v.toLowerCase() === part.toLowerCase()) ? (
      <mark key={idx} className="rounded bg-gold-100 px-1 py-0.5 text-ink">
        {part}
      </mark>
    ) : (
      <span key={idx}>{part}</span>
    ),
  );
}

export function TranscriptDrawer({
  open,
  onClose,
  sessionCode,
  durationSec,
  transcript,
  clinicalItems,
  pactCriteria,
  criticalErrors,
  studentSpeakerLabel = "Anda",
}: TranscriptDrawerProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<DrawerFilter>("semua");
  const [fontSize, setFontSize] = useState(14);
  const [copied, setCopied] = useState(false);

  const enriched = useMemo(() => {
    return transcript.map((row, idx) => {
      const isStudent = row.pembicara.toLowerCase() === "mahasiswa";
      const num = row.nomor_giliran_pembicara || idx + 1;
      const kode = row.kode_giliran || `${isStudent ? "MHS" : "PSN"}-${String(num).padStart(2, "0")}`;
      const shortBadge = isStudent ? `M${num}` : `P${num}`;
      const lowerText = (row.teks || "").toLowerCase();

      const matchedErrors = isStudent
        ? criticalErrors.filter(
            (kk) =>
              (kk.kode_giliran_terjadi && kk.kode_giliran_terjadi === kode) ||
              (kk.kutipan && kk.kutipan.length >= 4 && lowerText.includes(kk.kutipan.toLowerCase())),
          )
        : [];

      const matchedEvidence: Array<{ label: string; quote: string }> = [];
      if (isStudent) {
        for (const c of clinicalItems) {
          if (
            c.berlaku !== false &&
            (c.skor ?? 0) > 0 &&
            ((c.kode_giliran && c.kode_giliran === kode) ||
              (c.kutipan && c.kutipan.length >= 4 && lowerText.includes(c.kutipan.toLowerCase())))
          ) {
            matchedEvidence.push({
              label: `${c.kode} · ${c.parameter}`,
              quote: c.kutipan || "",
            });
          }
        }
        for (const p of pactCriteria) {
          if (
            p.skor_poin > 0 &&
            ((p.kode_giliran && p.kode_giliran === kode) ||
              (p.kutipan && p.kutipan.length >= 4 && lowerText.includes(p.kutipan.toLowerCase())))
          ) {
            matchedEvidence.push({
              label: `${p.kode} · ${p.parameter}`,
              quote: p.kutipan || "",
            });
          }
        }
      }

      return {
        row,
        isStudent,
        kode,
        shortBadge,
        matchedErrors,
        matchedEvidence,
      };
    });
  }, [transcript, clinicalItems, pactCriteria, criticalErrors]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return enriched.filter((item) => {
      if (filter === "bukti" && item.matchedEvidence.length === 0) return false;
      if (filter === "kesalahan" && item.matchedErrors.length === 0) return false;
      if (q && !item.row.teks.toLowerCase().includes(q) && !item.kode.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [enriched, filter, query]);

  if (!open) return null;

  const plainText = enriched
    .map(
      (item) =>
        `[${item.kode} | ${formatMmSs(item.row.waktu_mulai_detik || 0)}] ${
          item.isStudent ? `${studentSpeakerLabel} (Apoteker)` : "Pasien"
        }: ${item.row.teks}`,
    )
    .join("\n\n");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(plainText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Abaikan jika clipboard diblokir browser
    }
  };

  const handleExportTxt = () => {
    const blob = new Blob([plainText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transkrip-${sessionCode || "sesi"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/35 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-label="Transkrip Sesi"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex h-full w-full max-w-2xl flex-col bg-cream shadow-xl">
        {/* Header Tenang & Ringkas */}
        <div className="border-b border-line bg-white px-6 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-[11px] font-medium text-muted">
                Sesi {sessionCode}
              </p>
              <h2 className="mt-0.5 text-lg font-bold text-navy-900">Transkrip Percakapan</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-line bg-white p-1.5 text-muted transition hover:bg-slate-50 hover:text-ink"
              aria-label="Tutup Transkrip"
            >
              <X size={17} />
            </button>
          </div>

          {/* Search, Filter & Ukuran Teks */}
          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari kata atau kode giliran (mis. MHS-03)..."
                className="w-full rounded-xl border border-line bg-cream py-1.5 pl-8 pr-3 text-xs text-ink placeholder:text-muted/70 outline-none transition focus:border-navy-900 focus:bg-white"
              />
            </div>

            <div className="flex items-center gap-0.5 rounded-xl bg-slate-100 p-1 text-[11px] font-semibold">
              {(
                [
                  { id: "semua", label: "Semua" },
                  { id: "bukti", label: "Bukti" },
                  { id: "kesalahan", label: "Kesalahan" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  className={cn(
                    "rounded-lg px-2.5 py-1 transition",
                    filter === tab.id
                      ? "bg-navy-900 text-white"
                      : "text-muted hover:text-ink",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex items-center rounded-xl border border-line bg-white text-[11px] font-semibold text-muted">
              <button
                type="button"
                onClick={() => setFontSize((s) => Math.max(12, s - 1))}
                className="px-2 py-1 transition hover:text-ink"
                aria-label="Perkecil teks"
              >
                A-
              </button>
              <span className="h-3 w-px bg-line" />
              <button
                type="button"
                onClick={() => setFontSize((s) => Math.min(18, s + 1))}
                className="px-2 py-1 transition hover:text-ink"
                aria-label="Perbesar teks"
              >
                A+
              </button>
            </div>
          </div>
        </div>

        {/* Sub-header metadata + legenda posisi chat */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-cream/90 px-6 py-2.5 text-xs text-muted">
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <Clock size={13} /> {formatMmSs(durationSec)}
            </span>
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <MessageSquare size={13} /> {transcript.length} giliran
            </span>
          </div>

          <div className="flex items-center gap-3 text-[11px]">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full border border-line bg-white" />
              Pasien (Kiri)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full border border-navy-900/20 bg-[#EBF1F6]" />
              {studentSpeakerLabel} (Kanan)
            </span>
          </div>
        </div>

        {/* Body Chat Bubbles */}
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line bg-white p-8 text-center text-xs text-muted">
              Tidak ada giliran transkrip yang cocok dengan filter atau kata kunci saat ini.
            </div>
          ) : (
            filtered.map((item, idx) => {
              const hasError = item.matchedErrors.length > 0;
              const highlights = [
                ...(query.trim() ? [query.trim()] : []),
                ...item.matchedErrors.map((e) => e.kutipan || ""),
                ...item.matchedEvidence.map((e) => e.quote),
              ];

              return (
                <div
                  key={item.row.id || `${item.kode}-${idx}`}
                  className={cn(
                    "flex flex-col gap-1",
                    item.isStudent ? "items-end" : "items-start",
                  )}
                >
                  {/* Meta pembicara */}
                  <div
                    className={cn(
                      "flex items-center gap-2 px-1 text-[11px] text-muted",
                      item.isStudent && "flex-row-reverse",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 font-mono text-[10px] font-semibold",
                        item.isStudent
                          ? hasError
                            ? "bg-red-100 text-red-700"
                            : "bg-navy-900/10 text-navy-900"
                          : "bg-slate-200/80 text-slate-600",
                      )}
                    >
                      {item.shortBadge}
                    </span>
                    <span className="font-semibold text-ink">
                      {item.isStudent ? studentSpeakerLabel : "Pasien"}
                    </span>
                    <span className="font-mono text-[10px]">
                      {formatMmSs(item.row.waktu_mulai_detik || 0)}
                    </span>
                    <span className="font-mono text-[10px] text-muted/75">{item.kode}</span>
                  </div>

                  {/* Bubble chat berbeda bentuk & warna lembut */}
                  <div
                    style={{ fontSize: `${fontSize}px` }}
                    className={cn(
                      "max-w-[85%] px-4 py-3 leading-relaxed",
                      item.isStudent
                        ? hasError
                          ? "rounded-2xl rounded-tr-sm border border-red-200 bg-red-50/60 text-ink"
                          : "rounded-2xl rounded-tr-sm border border-navy-900/12 bg-[#EBF1F6] text-ink"
                        : "rounded-2xl rounded-tl-sm border border-line bg-white text-ink",
                    )}
                  >
                    <p className="whitespace-pre-wrap">
                      {renderHighlightedText(item.row.teks, highlights)}
                    </p>

                    {(item.matchedEvidence.length > 0 || item.matchedErrors.length > 0) && (
                      <div
                        className={cn(
                          "mt-2.5 flex flex-wrap gap-1.5 border-t pt-2.5",
                          hasError ? "border-red-200/70" : "border-navy-900/10",
                        )}
                      >
                        {item.matchedErrors.map((err) => (
                          <span
                            key={err.id}
                            className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-2 py-0.5 text-[11px] font-medium text-red-700"
                          >
                            <ShieldAlert size={11} className="shrink-0" />
                            {err.id} · {err.judul}
                          </span>
                        ))}
                        {item.matchedEvidence.map((ev, eIdx) => (
                          <span
                            key={eIdx}
                            className="inline-flex items-center gap-1 rounded-md border border-olive-600/20 bg-white/90 px-2 py-0.5 text-[11px] font-medium text-olive-700"
                          >
                            <Check size={11} className="shrink-0" />
                            {ev.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-white px-6 py-3.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportTxt}
              className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-3 py-2 text-xs font-medium text-ink transition hover:bg-slate-50"
            >
              <Download size={13} /> Unduh .TXT
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-3 py-2 text-xs font-medium text-ink transition hover:bg-slate-50"
            >
              {copied ? <Check size={13} className="text-olive-600" /> : <Copy size={13} />}
              {copied ? "Tersalin" : "Salin Teks"}
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-navy-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-navy-800"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
