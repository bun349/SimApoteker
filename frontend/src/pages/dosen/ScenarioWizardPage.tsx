import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { createDraft, fetchDraft, updateDraft, type Draft, type DraftPatch, arsipkanVersiLama, fetchVersiRilis } from "@/api/wizard";
import { useAuthStore } from "@/store/authStore";
import { useKodeAvailability } from "@/hooks/useKodeAvailability";
import { STATUS_GROUPS, jenisMeta } from "@/lib/skenario";
import { formatShortDate } from "@/lib/utils";
import { buildKlinis, getKlinisConfig, parseKlinisTambahan, parseStep3, step3Checks, type Step3Form } from "@/lib/klinis";
import { StepKlinis } from "@/components/dosen/wizard/StepKlinis";
import { buildPemicu, parseStep4, step4Checks, type Step4Form } from "@/lib/pemicu";
import { StepPemicu } from "@/components/dosen/wizard/StepPemicu";
import { buildKamus, parseStep5, step5Checks, type Step5Form } from "@/lib/kamus";
import { StepKamus } from "@/components/dosen/wizard/StepKamus";
import { buildKunci, parseStep6, step6Checks, type Step6Form } from "@/lib/rubrik";
import { buildKesalahan, parseStep7, step7Checks, type Step7Form } from "@/lib/penalti";
import { StepPenalti } from "@/components/dosen/wizard/StepPenalti";
import { StepRubrik } from "@/components/dosen/wizard/StepRubrik";
import { klinisOf, parseStep8, step8Checks, targetVersi, type Step8Form } from "@/lib/finalisasi";
import { StepFinal } from "@/components/dosen/wizard/StepFinal";
import {
  JUDUL_MAX, JUDUL_MIN, STEPS, TOTAL_STEPS, buildProfil, completedCount, parseStep2, step2Checks,
  type Step1Form, type Step2Form,
} from "@/lib/wizard";
import { WizardStepper } from "@/components/dosen/wizard/WizardStepper";
import { StepIdentitas } from "@/components/dosen/wizard/StepIdentitas";
import { StepProfil } from "@/components/dosen/wizard/StepProfil";
import { WizardSidePanel, type Msg } from "@/components/dosen/wizard/WizardSidePanel";

const isEditable = (d: Draft) => STATUS_GROUPS.draf.includes(d.status) && !d.beku;

const Notice = ({ children }: { children: React.ReactNode }) => (
  <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 text-center text-sm shadow-sm">
    {children}
    <p className="mt-4">
      <Link to="/dosen/kasus" className="font-semibold text-navy-900 underline">Kembali ke Bank Kasus</Link>
    </p>
  </div>
);

export default function ScenarioWizardPage() {
  const { id } = useParams();
  const profile = useAuthStore((s) => s.profile);
  const ownerId = profile?.id;

  const q = useQuery({
    queryKey: ["skenario", "draft", id],
    queryFn: () => fetchDraft(id!, ownerId!),
    enabled: !!id && !!ownerId,
  });

  if (!id) return <WizardBody key="new" draft={null} />;
  if (q.isLoading) return <div className="animate-pulse text-muted">Memuat draf skenario...</div>;
  if (q.isError) return <Notice>Gagal memuat skenario.</Notice>;
  if (!q.data) return <Notice>Skenario tidak ditemukan atau bukan milik Anda.</Notice>;
  if (!isEditable(q.data as Draft))
    return <Notice>Skenario ini sudah dirilis, diarsipkan, atau dibekukan sehingga tidak dapat diubah dari wizard.</Notice>;

  return <WizardBody key={q.data.id} draft={q.data as Draft & { profil: any; kalimat: string }} />;
}

function WizardBody({ draft }: { draft: (Draft & { profil: any; kalimat: string }) | null }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [sp, setSp] = useSearchParams();

  const profile = useAuthStore((s) => s.profile);
  const ownerId = profile?.id;

  const [form, setForm] = useState<Step1Form>({
    kode: draft?.kode ?? "",
    jenis: draft?.jenis ?? "",
    judul: draft?.judul ?? "",
  });

  const [p2, setP2] = useState<Step2Form>(() =>
    parseStep2(draft?.profil ?? {}, draft?.kalimat ?? "", draft?.klinis ?? {}, {
      riwayatAlergi: draft?.riwayatAlergi ?? "",
      kondisiPenyerta: draft?.kondisiPenyerta ?? "",
    }),
  );

  const initialTambahan = parseKlinisTambahan({
    obatLainSuplemen: draft?.obatLainSuplemen,
    interaksiDitanam: draft?.interaksiDitanam,
    memuatDdi: draft?.memuatDdi,
    klinis: draft?.klinis,
  });
  const [obatLainSuplemen, setObatLainSuplemen] = useState<string[]>(initialTambahan.obatLainSuplemen);
  const [interaksiDitanam, setInteraksiDitanam] = useState<string>(initialTambahan.interaksiDitanam);
  const [memuatDdi, setMemuatDdi] = useState<boolean>(initialTambahan.memuatDdi);

  const [p3, setP3] = useState<Record<string, Step3Form>>({});
  const jenis = form.jenis || draft?.jenis || "";
  const cfg = getKlinisConfig(jenis);
  const cur3: Step3Form | null = cfg
    ? (p3[jenis] ?? parseStep3(cfg, draft?.klinis ?? {}, draft?.butir ?? [], draft?.jenis === jenis))
    : null;

  const patch3 = (fn: (f: Step3Form) => Step3Form) => {
    if (!cfg || !cur3) return;
    setP3((s) => ({ ...s, [jenis]: fn(s[jenis] ?? cur3) }));
  };
  const [p4, setP4] = useState<Step4Form>(() => parseStep4(draft?.pemicu ?? {}));
  const [p5, setP5] = useState<Step5Form>(() => parseStep5(draft?.kamus));
  const [p6, setP6] = useState<Step6Form>(() => parseStep6(draft?.kunci ?? {}));
  const [p7, setP7] = useState<Step7Form>(() => parseStep7(draft?.kesalahan ?? {}));
  const [p8, setP8] = useState<Step8Form>(() => parseStep8(draft?.bobotKomunikasi ?? 20, draft?.modeRilis ?? []));
  const isRevision = !!draft && !draft.beku && !/^0\./.test(draft.versi);
  const [arsipLama, setArsipLama] = useState(true);
  const prev = useQuery({
    queryKey: ["skenario", "prev", draft?.kode, draft?.id],
    queryFn: () => fetchVersiRilis(draft!.kode, ownerId!, draft!.id),
    enabled: isRevision && !!ownerId,
  });
  const versiLama = (prev.data ?? []).map((v) => v.versi);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<Msg | null>(null);

  // ===== Aturan navigasi: tidak boleh melewati progres_langkah =====
  const maxStep = draft?.progres ?? 1;
  const urlStep = Number(sp.get("langkah"));
  const requested = Number.isInteger(urlStep) && urlStep > 0 ? urlStep : maxStep;
  const step = Math.min(requested, maxStep);
  const meta = STEPS[step - 1];

  // ===== Validasi per langkah =====
  const kodeStatus = useKodeAvailability(form.kode, draft?.id);
  const judulLen = form.judul.trim().length;
  const checks1 = [
    { label: "Kode Skenario Unik", ok: kodeStatus === "ok" },
    { label: "Jenis Kasus Terpilih", ok: !!form.jenis },
    { label: "Judul Memuat Faktor Kunci", ok: judulLen >= JUDUL_MIN && judulLen <= JUDUL_MAX },
    { label: "Identitas Asesor Sah", ok: !!ownerId && profile?.peran === "dosen" },
  ];

  const checks2 = step2Checks(p2, jenis);

  const checks3 = cfg && cur3 ? step3Checks(cfg, cur3) : [{ label: "Jenis kasus memiliki formulir klinis", ok: false }];
  const checks4 = step4Checks(p4);
  const checks5 = step5Checks(p5);
  const checks6 = step6Checks(p6);
  const checks7 = step7Checks(p7);
  const stepOkList = [checks1, checks2, checks3, checks4, checks5, checks6, checks7].map((c) => c.every((x) => x.ok));
  const incomplete = STEPS.slice(0, 7).filter((_, i) => !stepOkList[i]).map((s) => `${s.n}. ${s.label}`);
  const allStepsOk = incomplete.length === 0;
  const checks8 = step8Checks(p8, allStepsOk);
  const stepChecks =
    step === 1 ? checks1 : step === 2 ? checks2 : step === 3 ? checks3 :
    step === 4 ? checks4 : step === 5 ? checks5 : step === 6 ? checks6 :
    step === 7 ? checks7 : step === 8 ? checks8 : [];
  const allOk = stepChecks.every((c) => c.ok);
  const stepValid = stepChecks.length === 0 || allOk;
  const completed = isRevision
    ? stepOkList.filter(Boolean).length + (checks8[0].ok ? 1 : 0)
    : completedCount(maxStep, step, stepValid);

  // ===== Simpan =====
  async function persist(advanceFrom?: number, finalize = false): Promise<Draft | null> {
    if (!ownerId) return null;
    const judul = form.judul.trim();
    const progres = advanceFrom ? Math.min(advanceFrom + 1, TOTAL_STEPS) : undefined;

    setSaving(true);
    setMsg(null);

    try {
      let saved: Draft;
      if (!draft) {
        if (kodeStatus !== "ok" || !form.jenis || !judul)
          throw new Error("Isi kode yang valid, jenis, dan judul terlebih dahulu untuk membuat draf.");
        saved = await createDraft(ownerId, { kode: form.kode, jenis: form.jenis, judul, progres: progres ?? 1 });
      } else {
        const patch: DraftPatch = { judul };
        if (form.jenis) patch.jenis = form.jenis;

        if (kodeStatus === "ok" || form.kode === draft.kode) patch.kode = form.kode;

        if (isRevision || step >= 2) {
          patch.profil = buildProfil(draft.profil, p2);
          patch.kalimat = p2.kalimat.trim();
          patch.riwayatAlergi = p2.riwayatAlergi;
          patch.kondisiPenyerta = p2.kondisiPenyerta;

          if (form.jenis === "resep_kronis" || form.jenis === "RESEP KRONIS") {
            const currentKlinis = draft.klinis || {};
            const currentResepKronis = (currentKlinis.resep_kronis as Record<string, unknown>) || {};
            patch.klinis = {
              ...currentKlinis,
              resep_kronis: {
                ...currentResepKronis,
                unit_layanan: p2.unitLayanan,
                status_resep: p2.statusKunjungan,
              },
            };
          }
        }
        if ((isRevision || step >= 3) && cfg && cur3) {
          const baseKlinis = patch.klinis ?? draft.klinis;
          patch.klinis = buildKlinis(baseKlinis, cfg, cur3);
          patch.butir = cur3.butir;
          patch.obatLainSuplemen = obatLainSuplemen;
          patch.interaksiDitanam = interaksiDitanam;
          patch.memuatDdi = interaksiDitanam.trim().length > 0 ? true : memuatDdi;
        }
        if (isRevision || step >= 4) {
          patch.pemicu = buildPemicu(draft.pemicu, p4);
        }
        if (isRevision || step >= 5) {
          patch.kamus = buildKamus(p5);
        }
        if (isRevision || step >= 6) {
          patch.kunci = buildKunci(draft.kunci, p6);
        }
        if (isRevision || step >= 7) {
          patch.kesalahan = buildKesalahan(draft.kesalahan, p7);
        }
        if (isRevision || step >= 8) {
          patch.bobotKomunikasi = p8.kom;
          patch.bobotKonten = klinisOf(p8.kom);
          patch.modeRilis = p8.modes;
        }
        if (finalize) patch.finalize = { versi: targetVersi(draft.versi) };
        if (progres) patch.progres = Math.max(draft.progres, progres);

        saved = await updateDraft(draft.id, ownerId, patch);
      }

      qc.setQueryData(["skenario", "draft", saved.id], saved);
      void qc.invalidateQueries({ queryKey: ["skenario", "list"] });
      void qc.invalidateQueries({ queryKey: ["skenario", "counts"] });
      const jam = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
      setMsg({ type: "ok", text: `Draf tersimpan pukul ${jam}` });
      return saved;
    } catch (e: any) {
      console.error("❌ GAGAL MENYIMPAN KE SUPABASE:", e);
      setMsg({ type: "error", text: (e as Error).message });
      return null;
    } finally {
      setSaving(false);
    }
  }

  const afterCreate = (saved: Draft, langkah: number) =>
    navigate(`/dosen/kasus/${saved.id}/susun?langkah=${langkah}`, { replace: true });

  const onSave = async () => {
    const saved = await persist();
    if (saved && !draft) afterCreate(saved, 1);
  };

  const onNext = async () => {
    if (!stepValid) return setMsg({ type: "error", text: "Lengkapi butir yang belum terpenuhi sebelum melanjutkan." });
    const saved = await persist(step);
    if (!saved) return;
    if (!draft) afterCreate(saved, step + 1);
    else setSp({ langkah: String(step + 1) });
  };

  const goTo = async (n: number) => {
    if (n === step || n > maxStep) return;
    if (draft && !(await persist())) return;
    setSp({ langkah: String(n) });
  };

  const onFinalize = async () => {
    if (!draft || !stepChecks.every((c) => c.ok)) return;
    const arsip = isRevision && arsipLama && versiLama.length > 0;
    const ok = window.confirm(
      `Terbitkan ${draft.kode} sebagai v${targetVersi(draft.versi)}? Setelah diterbitkan, skenario dibekukan dan tidak dapat diubah.` +
        (arsip ? `\n\nVersi v${versiLama.join(", v")} akan otomatis diarsipkan.` : ""),
    );
    if (!ok) return;

    const saved = await persist(undefined, true);
    if (!saved) return;

    if (arsip && ownerId) {
      try {
        await arsipkanVersiLama(draft.kode, ownerId, draft.id);
      } catch {
        window.alert("Versi baru sudah terbit, tetapi versi lama gagal diarsipkan. Arsipkan manual dari Bank Kasus.");
      }
      void qc.invalidateQueries({ queryKey: ["skenario"] });
    }
    navigate("/dosen/kasus", { replace: true });
  };

  // Ctrl+S
  const saveRef = useRef(onSave);
  useEffect(() => { saveRef.current = onSave; });
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveRef.current();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const missing = stepChecks.filter((c) => !c.ok).length;
  const statusText =
    stepChecks.length === 0
      ? "Status: Belum ada validasi untuk langkah ini"
      : allOk
        ? step === TOTAL_STEPS
          ? "Status: Siap Diterbitkan ke Bank Kasus"
          : `Status: Siap lanjut ke Langkah ${Math.min(step + 1, TOTAL_STEPS)}`
        : `Status: Lengkapi ${missing} butir lagi`;

  const header = (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-md bg-sky-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-navy-800">
          Langkah {step} dari {TOTAL_STEPS}
        </span>
        {step === 1 && allOk && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-lime-800">
            <CheckCircle2 size={13} /> Validasi Awal
          </span>
        )}
      </div>
      <h1 className="mt-4 font-serif text-3xl font-bold leading-tight">
        {step === 3 && cfg ? `${meta.title}: ${jenisMeta(jenis).label}` : meta.title}
      </h1>
      <p className="mt-1 text-sm text-muted">{meta.desc}</p>
    </>
  );

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4">
      <Link to="/dosen/kasus" className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink">
        <ArrowLeft size={15} /> Kembali ke Bank Kasus & Studio
      </Link>

      {draft && (
        <header className="rounded-2xl border border-line bg-white px-5 py-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted">{draft.kode}</span>
            <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold text-navy-800">
              v{draft.versi}
            </span>
            <span className="rounded-full bg-gold-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
              {isRevision ? "Draf Revisi" : "Draf"}{allStepsOk && " • Siap Rilis"}
            </span>
            <span className="truncate text-sm font-medium">{form.judul}</span>
          </div>
          {isRevision && (
            <p className="mt-2 text-xs text-muted">
              {versiLama.length > 0 ? `Revisi dari v${versiLama[0]}. ` : ""}
              Seluruh isian sudah terisi dari versi sebelumnya. Anda bisa membuka langkah mana pun dan
              mengubah hanya bagian yang perlu direvisi.
            </p>
          )}
        </header>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-[250px_minmax(0,1fr)_260px]">
        <WizardStepper current={step} maxStep={maxStep} completed={completed} busy={saving} onGo={goTo} allDone={isRevision} />

        <div className="min-w-0 space-y-5">
          {step === 1 ? (
            <section className="rounded-2xl border border-line bg-white p-6 shadow-sm sm:p-8">
              {header}
              <div className="mt-7">
                <StepIdentitas
                  form={form}
                  onChange={(p) => setForm((f) => ({ ...f, ...p }))}
                  kodeStatus={kodeStatus}
                  versi={draft?.versi ?? "0.1"}
                  beku={draft?.beku ?? false}
                  author={profile?.nama_lengkap ?? "-"}
                  dateLabel={formatShortDate(draft?.createdAt ?? new Date().toISOString())}
                  isLocked={!!draft}
                />
              </div>
            </section>
          ) : (
            <>
              <section className="rounded-2xl border border-line bg-white p-6 shadow-sm">{header}</section>
              {step === 2 ? (
                <StepProfil
                  form={p2}
                  onChange={(p) => setP2((f) => ({ ...f, ...p }))}
                  jenisSkenario={jenis}
                />
              ) : step === 3 ? (
                cfg && cur3 ? (
                  <StepKlinis
                    cfg={cfg}
                    form={cur3}
                    onValue={(k, v) => patch3((f) => ({ ...f, values: { ...f.values, [k]: v } }))}
                    onButir={(b) => patch3((f) => ({ ...f, butir: b }))}
                    obatLainSuplemen={obatLainSuplemen}
                    interaksiDitanam={interaksiDitanam}
                    memuatDdi={memuatDdi}
                    onInteraksiChange={(patch) => {
                      if (patch.obatLainSuplemen !== undefined) setObatLainSuplemen(patch.obatLainSuplemen);
                      if (patch.interaksiDitanam !== undefined) setInteraksiDitanam(patch.interaksiDitanam);
                      if (patch.memuatDdi !== undefined) setMemuatDdi(patch.memuatDdi);
                    }}
                  />
                ) : (
                  <div className="rounded-2xl border border-dashed border-line bg-cream p-10 text-center text-sm text-muted">
                    Jenis kasus <b className="text-ink">{jenis || "-"}</b> belum memiliki formulir klinis.
                    Pilih jenis di Langkah 1.
                  </div>
                )
              ) : step === 4 ? (
                <StepPemicu form={p4} onChange={setP4} />
              ) : step === 5 ? (
                <StepKamus form={p5} onChange={setP5} />
              ) : step === 6 ? (
                <StepRubrik form={p6} onChange={setP6} />
              ) : step === 7 ? (
                <StepPenalti form={p7} onChange={setP7} />
              ) : step === 8 ? (
                <StepFinal
                  form={p8}
                  onChange={setP8}
                  rubrik={p6.rows}
                  penalti={p7.rows}
                  excluded={cur3?.butir ?? []}
                  versiTarget={targetVersi(draft?.versi ?? "0.1")}
                  author={profile?.nama_lengkap ?? "-"}
                  incomplete={incomplete}
                  canFinalize={!!draft && allOk}
                  saving={saving}
                  onFinalize={onFinalize}
                  versiLama={isRevision ? versiLama : []}
                  arsipLama={arsipLama}
                  onArsipLama={setArsipLama}
                />
              ) : null}
            </>
          )}
        </div>

        <WizardSidePanel
          checks={stepChecks}
          statusText={statusText}
          ready={stepValid}
          nextLabel={step < TOTAL_STEPS ? "Selanjutnya" : "Finalisasi"}
          nextDisabled={step === TOTAL_STEPS || !stepValid || saving}
          onNext={onNext}
          onSave={onSave}
          saving={saving}
          msg={msg}
          onPrev={step > 1 ? () => void goTo(step - 1) : undefined}
          prevDisabled={saving}
          hideNext={step === TOTAL_STEPS}
        />
      </div>
    </div>
  );
}