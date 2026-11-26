import { AlertTriangle, Save, Trash2, X } from "lucide-react";

interface ForceFinishModalProps {
  open: boolean;
  isSubmitting: boolean;
  studentTurnCount?: number;
  missingItems?: string[];
  onCancel: () => void;
  onConfirmSaveAndFinish: () => void;
  onConfirmDiscardAndFinish: () => void;
}

export function ForceFinishModal({
  open,
  isSubmitting,
  studentTurnCount = 0,
  missingItems = [],
  onCancel,
  onConfirmSaveAndFinish,
  onConfirmDiscardAndFinish,
}: ForceFinishModalProps) {
  if (!open) return null;

  const isShortSession = studentTurnCount >= 1 && studentTurnCount <= 4;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="force-finish-modal-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3
                id="force-finish-modal-title"
                className="text-base font-semibold text-slate-900"
              >
                Akhiri Sesi Lebih Awal?
              </h3>
              <p className="text-xs text-slate-500">Mode Latihan Mandiri</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
            aria-label="Tutup modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-3 text-sm text-slate-600">
          {isShortSession ? (
            <p className="rounded-xl border border-sky-200 bg-sky-50/80 p-3 text-xs leading-relaxed text-sky-900">
              <strong>Sesi Pendek ({studentTurnCount} giliran bicara):</strong> Karena giliran
              bicara mahasiswa maksimal 4 giliran, Anda tetap dapat memilih{" "}
              <strong>Simpan Transkrip &amp; Akhiri</strong> agar transkrip tersimpan dengan status{" "}
              <strong>Tidak Cukup Data</strong>, atau hapus sesi jika tidak ingin menyimpannya.
            </p>
          ) : (
            <p className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs leading-relaxed text-amber-900">
              <strong>Perhatian:</strong> Syarat penyelesaian atau penggalian informasi belum
              lengkap. Anda dapat menyimpan transkrip sesi apa adanya atau menghapus sesi tanpa
              menyimpan data.
            </p>
          )}

          {missingItems.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-700">
                Bagian yang belum terpenuhi:
              </p>
              <ul className="max-h-36 space-y-1 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-xs text-slate-600">
                {missingItems.map((item, idx) => (
                  <li key={`${item}-${idx}`} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Lanjutkan Sesi
          </button>

          <button
            type="button"
            onClick={onConfirmDiscardAndFinish}
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {isSubmitting ? "Memproses..." : "Hapus Sesi"}
          </button>

          {studentTurnCount >= 1 && (
            <button
              type="button"
              onClick={onConfirmSaveAndFinish}
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-xl bg-navy-900 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-navy-800 disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              {isSubmitting ? "Menyimpan..." : "Simpan Transkrip & Akhiri"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}