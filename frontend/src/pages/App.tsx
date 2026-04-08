import { useState, useRef } from "react";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, setDate } from "date-fns";
import {
  FileUp, Users, BarChart3, Eye, FileDown,
  CheckCircle2, AlertCircle, Loader2, Trash2, Check, Map, History,
} from "lucide-react";
import {
  uploadEmployerFile,
  aggregateQuinyx,
  previewSalary,
  downloadCsv,
  saveManualMapping,
  clearEmployerMappings,
  saveRun,
  searchEmployers,
  type WorkerSummary,
  type PreviewResponse,
} from "@/lib/api";

// ── helpers ──────────────────────────────────────────────────────────────────
function formatDateDMY(d: Date) { return format(d, "dd/MM/yyyy"); }

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100">
      <Icon className="w-4 h-4 text-slate-400" />
      <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
    </div>
  );
}

function Btn({
  onClick, disabled, loading, children, variant = "primary", className = "",
}: {
  onClick: () => void; disabled?: boolean; loading?: boolean;
  children: React.ReactNode; variant?: "primary" | "secondary" | "danger" | "teal";
  className?: string;
}) {
  const base = "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 shadow-sm",
    secondary: "bg-slate-100 text-slate-700 hover:bg-slate-200",
    danger: "bg-red-50 text-red-600 hover:bg-red-100",
    teal: "bg-teal-600 text-white hover:bg-teal-700 shadow-sm",
  };
  return (
    <button onClick={onClick} disabled={disabled || loading} className={`${base} ${variants[variant]} ${className}`}>
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}

function FilePickerButton({
  label, accept, onFile, file, disabled = false,
}: {
  label: string; accept: string; onFile: (f: File) => void;
  file: File | null; disabled?: boolean;
}) {
  return (
    <label className={`flex flex-col items-center gap-2 border-2 border-dashed rounded-xl px-4 py-6 cursor-pointer transition text-center
      ${disabled ? "opacity-40 cursor-not-allowed border-slate-100" : file ? "border-blue-300 bg-blue-50/40" : "border-slate-200 hover:border-blue-300 hover:bg-blue-50/30"}`}>
      <FileUp className={`w-5 h-5 ${file ? "text-blue-500" : "text-slate-300"}`} />
      <span className={`text-sm ${file ? "text-blue-700 font-medium" : "text-slate-400"}`}>
        {file ? file.name : label}
      </span>
      <input
        type="file" accept={accept} className="sr-only" disabled={disabled}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }}
      />
    </label>
  );
}

function TypeToggle({
  value, onChange,
}: { value: "driver" | "warehouse"; onChange: (v: "driver" | "warehouse") => void }) {
  return (
    <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
      {(["driver", "warehouse"] as const).map(t => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={`px-5 py-1.5 rounded-lg text-sm font-medium transition ${
            value === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {t === "driver" ? "Sjåfører" : "Lager"}
        </button>
      ))}
    </div>
  );
}

function StepCircle({ n, done }: { n: number; done: boolean }) {
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 transition-colors ${
      done ? "bg-emerald-500 text-white" : "bg-slate-900 text-white"
    }`}>
      {done ? <Check className="w-4 h-4" /> : n}
    </div>
  );
}

function EmployeeSearchInput({
  value, onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<{ normalized_name: string; lonnstakernr: string }[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleInput(q: string) {
    setQuery(q);
    onChange(q);
    if (timer.current) clearTimeout(timer.current);
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    timer.current = setTimeout(async () => {
      try {
        const res = await searchEmployers(q);
        setResults(res);
        setOpen(res.length > 0);
      } catch {}
    }, 300);
  }

  function select(item: { normalized_name: string; lonnstakernr: string }) {
    setQuery(item.lonnstakernr);
    onChange(item.lonnstakernr);
    setOpen(false);
  }

  return (
    <div className="relative flex-1">
      <input
        type="text"
        placeholder="Søk navn eller skriv lønnstakernr"
        value={query}
        onChange={e => handleInput(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
      />
      {open && (
        <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-40 overflow-y-auto">
          {results.map(r => (
            <button
              key={r.lonnstakernr}
              onMouseDown={() => select(r)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex justify-between items-center gap-2"
            >
              <span className="text-slate-700 truncate">{r.normalized_name}</span>
              <span className="text-xs text-slate-400 flex-shrink-0">{r.lonnstakernr}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── main component ───────────────────────────────────────────────────────────
export default function App() {
  const [employerFile, setEmployerFile] = useState<File | null>(null);
  const [employerUploaded, setEmployerUploaded] = useState(false);
  const [uploadingEmployer, setUploadingEmployer] = useState(false);

  const [quinyxFile, setQuinyxFile] = useState<File | null>(null);
  const [employeeType, setEmployeeType] = useState<"driver" | "warehouse">("driver");

  const [aggregating, setAggregating] = useState(false);
  const [workerData, setWorkerData] = useState<WorkerSummary[] | null>(null);
  const [unmappedNames, setUnmappedNames] = useState<string[]>([]);
  const [manualMappings, setManualMappings] = useState<Record<string, string>>({});
  const [savingManual, setSavingManual] = useState(false);

  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);

  const [fradato, setFradato] = useState(() => formatDateDMY(startOfMonth(new Date())));
  const [tildato, setTildato] = useState(() => formatDateDMY(setDate(new Date(), 15)));
  const [downloading, setDownloading] = useState(false);

  async function handleUploadEmployer() {
    if (!employerFile) return;
    setUploadingEmployer(true);
    try {
      const res = await uploadEmployerFile(employerFile);
      toast.success(`${res.mappings_count} employer mappings lagret.`);
      setEmployerUploaded(true);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploadingEmployer(false);
    }
  }

  async function handleAggregate() {
    if (!quinyxFile) return;
    setAggregating(true);
    setWorkerData(null);
    setUnmappedNames([]);
    setPreview(null);
    try {
      const res = await aggregateQuinyx(quinyxFile, employeeType);
      setWorkerData(res.data);
      setUnmappedNames(res.unmapped_names);
      if (res.unmapped_names.length > 0) {
        toast.warning(`${res.unmapped_names.length} ansatte ble ikke matchet.`);
      } else {
        toast.success(res.message);
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setAggregating(false);
    }
  }

  async function handleSaveManual() {
    const toSave = Object.entries(manualMappings).filter(([, v]) => v.trim());
    if (!toSave.length) { toast.error("Ingen mappinger å lagre."); return; }
    setSavingManual(true);
    try {
      await Promise.all(toSave.map(([name, lnr]) => saveManualMapping(name, lnr.trim())));
      toast.success(`${toSave.length} manuelle mappinger lagret. Genererer på nytt...`);
      setManualMappings({});
      await handleAggregate();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingManual(false);
    }
  }

  async function handlePreview() {
    if (!quinyxFile) return;
    setPreviewing(true);
    setPreview(null);
    try {
      const res = await previewSalary(quinyxFile, employeeType);
      setPreview(res);
      if (res.missing_employee_mappings > 0 || res.missing_salary_type_mappings > 0) {
        toast.warning(res.message);
      } else {
        toast.success(res.message);
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setPreviewing(false);
    }
  }

  async function handleDownload() {
    if (!quinyxFile || !fradato || !tildato) return;
    setDownloading(true);
    try {
      const blob = await downloadCsv(quinyxFile, employeeType, fradato, tildato);
      const csvContent = await blob.text();
      const url = URL.createObjectURL(new Blob([csvContent], { type: "text/csv" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `importlonn_tripletex_${fradato.replace(/\//g, "-")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      if (preview) {
        const employeeCount = new Set(preview.items.map(i => i.lonnstakernr)).size;
        const rowCount = csvContent.split("\n").filter(l => l.trim()).length - 1;
        saveRun(employeeType, fradato, tildato, employeeCount, rowCount, csvContent).catch(() => {});
      }
      toast.success("CSV lastet ned.");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDownloading(false);
    }
  }

  async function handleClearEmployer() {
    try {
      await clearEmployerMappings();
      setEmployerUploaded(false);
      toast.success("Employer mappinger slettet.");
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Navbar */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">S</span>
            </div>
            <span className="font-semibold text-slate-900 text-sm">ShiftSync</span>
          </div>
          <nav className="flex items-center gap-0.5">
            <a href="/mappings" className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition">
              <Map className="w-3.5 h-3.5" /> Lønnstype-mapping
            </a>
            <a href="/logg" className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition">
              <History className="w-3.5 h-3.5" /> Kjøringslogg
            </a>
          </nav>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-10 pb-20">

        <div className="mb-10">
          <h1 className="text-xl font-semibold text-slate-900">Lønnsimport</h1>
          <p className="text-sm text-slate-400 mt-0.5">Quinyx → Tripletex · Følg stegene nedenfor</p>
        </div>

        {/* Step 1 */}
        <div className="flex gap-5">
          <div className="flex flex-col items-center">
            <StepCircle n={1} done={employerUploaded} />
            <div className="w-px flex-1 min-h-8 bg-slate-200 mt-2" />
          </div>
          <div className="flex-1 pb-8">
            <Card>
              <SectionTitle icon={Users} title="Employer-fil" />
              <div className="p-5 space-y-4">
                <p className="text-xs text-slate-400 leading-relaxed">
                  Excel/CSV: Lønnstakernr (kol. B), Fornavn (kol. F), Etternavn (kol. G). Data fra rad 3.
                </p>
                <FilePickerButton
                  label="Velg employer-fil (.xlsx / .csv)"
                  accept=".xlsx,.csv"
                  onFile={setEmployerFile}
                  file={employerFile}
                />
                <div className="flex gap-2">
                  <Btn onClick={handleUploadEmployer} disabled={!employerFile} loading={uploadingEmployer}>
                    {employerUploaded ? <><CheckCircle2 className="w-4 h-4" /> Oppdatert</> : "Last opp"}
                  </Btn>
                  {employerUploaded && (
                    <Btn onClick={handleClearEmployer} variant="danger">
                      <Trash2 className="w-4 h-4" /> Slett
                    </Btn>
                  )}
                </div>
                {employerUploaded && (
                  <p className="text-xs text-emerald-600 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Mappinger lagret i databasen.
                  </p>
                )}
              </div>
            </Card>
          </div>
        </div>

        {/* Step 2 */}
        <div className="flex gap-5">
          <div className="flex flex-col items-center">
            <StepCircle n={2} done={!!(quinyxFile && workerData)} />
            <div className="w-px flex-1 min-h-8 bg-slate-200 mt-2" />
          </div>
          <div className="flex-1 pb-8">
            <Card>
              <SectionTitle icon={FileUp} title="Quinyx-fil" />
              <div className="p-5 space-y-4">
                <FilePickerButton
                  label="Velg Quinyx-eksport (.xlsx)"
                  accept=".xlsx"
                  onFile={(f) => { setQuinyxFile(f); setWorkerData(null); setPreview(null); }}
                  file={quinyxFile}
                />
                <div>
                  <p className="text-xs text-slate-400 mb-2">Ansatttype</p>
                  <TypeToggle
                    value={employeeType}
                    onChange={(t) => { setEmployeeType(t); setWorkerData(null); setPreview(null); }}
                  />
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Step 3 */}
        <div className="flex gap-5">
          <div className="flex flex-col items-center">
            <StepCircle n={3} done={!!(workerData && unmappedNames.length === 0)} />
            <div className="w-px flex-1 min-h-8 bg-slate-200 mt-2" />
          </div>
          <div className="flex-1 pb-8">
            <Card>
              <SectionTitle icon={BarChart3} title="Aggreger timer" />
              <div className="p-5 space-y-4">
                <p className="text-xs text-slate-400">Parser Quinyx-filen og summerer timer per ansatt og lønnstype.</p>
                <Btn onClick={handleAggregate} disabled={!quinyxFile} loading={aggregating} className="w-full justify-center">
                  Generer timeoversikt
                </Btn>

                {workerData && (
                  <div className="rounded-xl border border-slate-100 divide-y divide-slate-50 max-h-64 overflow-y-auto">
                    {workerData.map((w, i) => (
                      <div key={i} className="flex justify-between items-center px-4 py-2.5 hover:bg-slate-50">
                        <div>
                          <p className="text-sm font-medium text-slate-800">{w.full_name}</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {w.salary_type_summary.map(s => `${s.salary_type}: ${s.total_hours}t`).join(" · ")}
                          </p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ml-3 ${
                          w.lonnstakernr ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
                        }`}>
                          {w.lonnstakernr ?? "Ikke matchet"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {unmappedNames.length > 0 && (
                  <div className="rounded-xl border border-red-100 overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border-b border-red-100">
                      <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      <p className="text-sm font-medium text-red-700">
                        {unmappedNames.length} ansatte uten mapping
                      </p>
                    </div>
                    <div className="p-4 space-y-2.5 bg-white">
                      {unmappedNames.map((name) => (
                        <div key={name} className="flex items-center gap-3">
                          <span className="text-sm text-slate-700 w-44 truncate flex-shrink-0">{name}</span>
                          <EmployeeSearchInput
                            value={manualMappings[name] ?? ""}
                            onChange={(val) => setManualMappings(p => ({ ...p, [name]: val }))}
                          />
                        </div>
                      ))}
                      <Btn onClick={handleSaveManual} loading={savingManual} className="mt-1">
                        Lagre og regenerer
                      </Btn>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>

        {/* Step 4 */}
        <div className="flex gap-5">
          <div className="flex flex-col items-center">
            <StepCircle n={4} done={!!preview} />
            <div className="w-px flex-1 min-h-8 bg-slate-200 mt-2" />
          </div>
          <div className="flex-1 pb-8">
            <Card>
              <SectionTitle icon={Eye} title="Forhåndsvisning" />
              <div className="p-5 space-y-4">
                <p className="text-xs text-slate-400">Slår opp lønnsart og sats og viser hva CSV-en vil inneholde.</p>
                <Btn onClick={handlePreview} disabled={!quinyxFile || !workerData} loading={previewing} className="w-full justify-center">
                  Generer forhåndsvisning
                </Btn>

                {preview && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="px-2.5 py-1 bg-slate-100 rounded-lg text-slate-600">
                        <strong className="text-slate-800">{preview.items.length}</strong> linjer
                      </span>
                      <span className="px-2.5 py-1 bg-slate-100 rounded-lg text-slate-600">
                        <strong className="text-slate-800">{preview.total_hours}</strong> timer totalt
                      </span>
                      {preview.missing_employee_mappings > 0 && (
                        <span className="px-2.5 py-1 bg-red-50 rounded-lg text-red-600">
                          {preview.missing_employee_mappings} ansatte mangler
                        </span>
                      )}
                      {preview.missing_salary_type_mappings > 0 && (
                        <span className="px-2.5 py-1 bg-orange-50 rounded-lg text-orange-600">
                          {preview.missing_salary_type_mappings} lønnstype mangler
                        </span>
                      )}
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-slate-100">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 border-b border-slate-100">
                          <tr>
                            {["Nr.", "Navn", "Kode", "Lønnsart", "Timer", "Sats"].map(h => (
                              <th key={h} className="px-3 py-2.5 text-left font-medium text-slate-500">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {preview.items.slice(0, 50).map((item, i) => (
                            <tr key={i} className="border-t border-slate-50 hover:bg-slate-50">
                              <td className="px-3 py-2 text-slate-500">{item.lonnstakernr}</td>
                              <td className="px-3 py-2 text-slate-700 max-w-[110px] truncate">{item.employee_name}</td>
                              <td className="px-3 py-2 text-slate-400">{item.quinyx_code}</td>
                              <td className="px-3 py-2 text-slate-600">{item.loennsart}</td>
                              <td className="px-3 py-2 font-medium text-slate-800">{item.hours.toFixed(2)}</td>
                              <td className="px-3 py-2 text-slate-400">{item.rate?.toFixed(2) ?? "–"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {preview.items.length > 50 && (
                        <p className="text-center text-xs text-slate-400 py-2 border-t border-slate-50">
                          Viser 50 av {preview.items.length} linjer
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>

        {/* Step 5 — last, no connector */}
        <div className="flex gap-5">
          <div className="flex flex-col items-center">
            <StepCircle n={5} done={false} />
          </div>
          <div className="flex-1">
            <Card>
              <SectionTitle icon={FileDown} title="Last ned CSV" />
              <div className="p-5 space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Btn variant="secondary" onClick={() => {
                    const now = new Date();
                    setFradato(formatDateDMY(startOfMonth(now)));
                    setTildato(formatDateDMY(setDate(now, 15)));
                  }}>1.–15. denne mnd.</Btn>
                  <Btn variant="secondary" onClick={() => {
                    const now = new Date();
                    setFradato(formatDateDMY(setDate(now, 16)));
                    setTildato(formatDateDMY(endOfMonth(now)));
                  }}>16.–slutt denne mnd.</Btn>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Fra dato", value: fradato, set: setFradato },
                    { label: "Til dato", value: tildato, set: setTildato },
                  ].map(({ label, value, set }) => (
                    <div key={label}>
                      <label className="text-xs text-slate-400 mb-1.5 block">{label} (DD/MM/ÅÅÅÅ)</label>
                      <input
                        type="text" value={value} onChange={(e) => set(e.target.value)}
                        placeholder="01/04/2026"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>
                  ))}
                </div>

                <Btn
                  onClick={handleDownload}
                  disabled={!quinyxFile || !fradato || !tildato || !preview}
                  loading={downloading}
                  variant="teal"
                  className="w-full justify-center"
                >
                  <FileDown className="w-4 h-4" /> Last ned Tripletex CSV
                </Btn>
                {!preview && (
                  <p className="text-xs text-center text-slate-400">Generer forhåndsvisning i steg 4 først.</p>
                )}
              </div>
            </Card>
          </div>
        </div>

      </main>
    </div>
  );
}
