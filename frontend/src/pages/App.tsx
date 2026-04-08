import { useState, useRef } from "react";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, setDate } from "date-fns";
import {
  FileUp, Users, BarChart3, Eye, FileDown,
  CheckCircle2, AlertCircle, Loader2, Trash2
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

// ── tiny UI helpers ──────────────────────────────────────────────────────────
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-gray-200 p-6 ${className}`}>
      {children}
    </div>
  );
}

function StepHeader({
  step, title, color, icon: Icon,
}: {
  step: number; title: string; color: string; icon: React.ElementType;
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={`w-8 h-8 rounded-full ${color} text-white flex items-center justify-center text-sm font-bold flex-shrink-0`}>
        {step}
      </div>
      <Icon className={`w-5 h-5 ${color.replace("bg-", "text-")}`} />
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
    </div>
  );
}

function FilePickerButton({
  label, accept, onFile, file, disabled = false,
}: {
  label: string; accept: string; onFile: (f: File) => void;
  file: File | null; disabled?: boolean;
}) {
  return (
    <label className={`flex items-center gap-3 border-2 border-dashed rounded-xl px-4 py-3 cursor-pointer transition
      ${disabled ? "opacity-50 cursor-not-allowed border-gray-200" : "border-gray-300 hover:border-blue-400 hover:bg-blue-50"}`}>
      <FileUp className="w-5 h-5 text-gray-400" />
      <span className="text-sm text-gray-600 truncate">
        {file ? file.name : label}
      </span>
      <input
        type="file" accept={accept} className="sr-only" disabled={disabled}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }}
      />
    </label>
  );
}

function Btn({
  onClick, disabled, loading, children, variant = "primary", className = "",
}: {
  onClick: () => void; disabled?: boolean; loading?: boolean;
  children: React.ReactNode; variant?: "primary" | "secondary" | "danger";
  className?: string;
}) {
  const base = "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700",
    secondary: "bg-gray-100 text-gray-700 hover:bg-gray-200",
    danger: "bg-red-50 text-red-600 hover:bg-red-100",
  };
  return (
    <button onClick={onClick} disabled={disabled || loading} className={`${base} ${variants[variant]} ${className}`}>
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────────
function formatDateDMY(d: Date) { return format(d, "dd/MM/yyyy"); }

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
        className="border rounded-lg px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
      {open && (
        <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-40 overflow-y-auto">
          {results.map(r => (
            <button
              key={r.lonnstakernr}
              onMouseDown={() => select(r)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex justify-between items-center gap-2"
            >
              <span className="text-gray-700 truncate">{r.normalized_name}</span>
              <span className="text-xs text-gray-400 flex-shrink-0">{r.lonnstakernr}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── main component ───────────────────────────────────────────────────────────
export default function App() {
  // Step 1
  const [employerFile, setEmployerFile] = useState<File | null>(null);
  const [employerUploaded, setEmployerUploaded] = useState(false);
  const [uploadingEmployer, setUploadingEmployer] = useState(false);

  // Step 2
  const [quinyxFile, setQuinyxFile] = useState<File | null>(null);
  const [employeeType, setEmployeeType] = useState<"driver" | "warehouse">("driver");

  // Step 3
  const [aggregating, setAggregating] = useState(false);
  const [workerData, setWorkerData] = useState<WorkerSummary[] | null>(null);
  const [unmappedNames, setUnmappedNames] = useState<string[]>([]);
  const [manualMappings, setManualMappings] = useState<Record<string, string>>({});
  const [savingManual, setSavingManual] = useState(false);

  // Step 4
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);

  // Step 5
  const [fradato, setFradato] = useState(() => formatDateDMY(startOfMonth(new Date())));
  const [tildato, setTildato] = useState(() => formatDateDMY(setDate(new Date(), 15)));
  const [downloading, setDownloading] = useState(false);

  // ── handlers ──────────────────────────────────────────────────────────────

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
        toast.warning(`${res.unmapped_names.length} ansatte ble ikke matchet. Legg til manuelt nedenfor.`);
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

      const url = URL.createObjectURL(blob);
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

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">ShiftSync</h1>
          <p className="text-gray-500 mt-1">Quinyx → Tripletex lønnsimport</p>
          <div className="flex justify-center gap-2 mt-4">
            <a href="/mappings" className="px-4 py-1.5 rounded-xl text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition">
              Lønnstype-mapping
            </a>
            <a href="/logg" className="px-4 py-1.5 rounded-xl text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition">
              Kjøringslogg
            </a>
          </div>
        </div>

        {/* Step 1 */}
        <Card>
          <StepHeader step={1} title="Last opp employer-fil" color="bg-orange-500" icon={Users} />
          <p className="text-sm text-gray-500 mb-4">
            Excel/CSV med Lønnstakernr (kolonne B), Fornavn (kolonne F), Etternavn (kolonne G). Data fra rad 3.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <FilePickerButton
              label="Velg employer-fil (.xlsx / .csv)"
              accept=".xlsx,.csv"
              onFile={setEmployerFile}
              file={employerFile}
            />
            <Btn onClick={handleUploadEmployer} disabled={!employerFile} loading={uploadingEmployer}>
              {employerUploaded ? <><CheckCircle2 className="w-4 h-4 text-green-500" /> Lastet opp</> : "Last opp"}
            </Btn>
            {employerUploaded && (
              <Btn onClick={handleClearEmployer} variant="danger">
                <Trash2 className="w-4 h-4" /> Slett
              </Btn>
            )}
          </div>
          {employerUploaded && (
            <p className="mt-2 text-xs text-green-600 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Employer-mappinger er lagret i databasen.
            </p>
          )}
        </Card>

        {/* Step 2 */}
        <Card>
          <StepHeader step={2} title="Last opp Quinyx-fil" color="bg-blue-500" icon={FileUp} />
          <div className="space-y-4">
            <FilePickerButton
              label="Velg Quinyx-eksport (.xlsx)"
              accept=".xlsx"
              onFile={(f) => { setQuinyxFile(f); setWorkerData(null); setPreview(null); }}
              file={quinyxFile}
            />
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Ansatttype:</p>
              <div className="flex gap-4">
                {(["driver", "warehouse"] as const).map((t) => (
                  <label key={t} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio" name="emptype" value={t}
                      checked={employeeType === t}
                      onChange={() => { setEmployeeType(t); setWorkerData(null); setPreview(null); }}
                      className="accent-blue-600"
                    />
                    <span className="text-sm capitalize">{t === "driver" ? "Sjåfør" : "Lager"}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Step 3 */}
        <Card>
          <StepHeader step={3} title="Aggreger timer" color="bg-purple-500" icon={BarChart3} />
          <p className="text-sm text-gray-500 mb-4">
            Parser Quinyx-filen og summerer timer per ansatt og lønnstype.
          </p>
          <Btn onClick={handleAggregate} disabled={!quinyxFile} loading={aggregating} className="w-full justify-center">
            Generer timeoversikt
          </Btn>

          {workerData && (
            <div className="mt-4 max-h-72 overflow-y-auto space-y-2">
              {workerData.map((w, i) => (
                <div key={i} className="flex justify-between items-start border rounded-xl px-4 py-3 bg-gray-50">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{w.full_name}</p>
                    <p className="text-xs text-gray-400">
                      {w.salary_type_summary.map(s => `${s.salary_type}: ${s.total_hours}t`).join(" · ")}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${w.lonnstakernr ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                    {w.lonnstakernr ?? "Ikke matchet"}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Manual mappings for unmapped employees */}
          {unmappedNames.length > 0 && (
            <div className="mt-4 border border-red-200 rounded-xl p-4 bg-red-50">
              <p className="text-sm font-medium text-red-700 mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {unmappedNames.length} ansatte uten mapping -- legg til Lønnstakernr manuelt:
              </p>
              <div className="space-y-2">
                {unmappedNames.map((name) => (
                  <div key={name} className="flex items-center gap-3">
                    <span className="text-sm text-gray-700 w-48 truncate">{name}</span>
                    <EmployeeSearchInput
                      value={manualMappings[name] ?? ""}
                      onChange={(val) => setManualMappings(p => ({ ...p, [name]: val }))}
                    />
                  </div>
                ))}
              </div>
              <Btn onClick={handleSaveManual} loading={savingManual} className="mt-3">
                Lagre og regenerer
              </Btn>
            </div>
          )}
        </Card>

        {/* Step 4 */}
        <Card>
          <StepHeader step={4} title="Forhåndsvis lønnsdata" color="bg-indigo-500" icon={Eye} />
          <p className="text-sm text-gray-500 mb-4">
            Slår opp lønnsart og sats fra mappingtabellen og viser hva CSV-en vil inneholde.
          </p>
          <Btn onClick={handlePreview} disabled={!quinyxFile || !workerData} loading={previewing} className="w-full justify-center">
            Generer forhåndsvisning
          </Btn>

          {preview && (
            <div className="mt-4">
              <div className="flex gap-4 text-sm mb-3">
                <span className="text-gray-500">Linjer: <strong>{preview.items.length}</strong></span>
                <span className="text-gray-500">Timer totalt: <strong>{preview.total_hours}</strong></span>
                {preview.missing_employee_mappings > 0 && (
                  <span className="text-red-600">Mangler {preview.missing_employee_mappings} emp.</span>
                )}
                {preview.missing_salary_type_mappings > 0 && (
                  <span className="text-orange-600">Mangler {preview.missing_salary_type_mappings} lønnstype-mapping.</span>
                )}
              </div>
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-xs">
                  <thead className="bg-gray-100 text-gray-600">
                    <tr>
                      {["Lønnstakernr", "Navn", "Quinyx-kode", "Lønnsart", "Timer", "Sats"].map(h => (
                        <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.items.slice(0, 50).map((item, i) => (
                      <tr key={i} className="border-t hover:bg-gray-50">
                        <td className="px-3 py-2">{item.lonnstakernr}</td>
                        <td className="px-3 py-2 truncate max-w-[120px]">{item.employee_name}</td>
                        <td className="px-3 py-2">{item.quinyx_code}</td>
                        <td className="px-3 py-2">{item.loennsart}</td>
                        <td className="px-3 py-2">{item.hours.toFixed(2)}</td>
                        <td className="px-3 py-2">{item.rate?.toFixed(2) ?? "–"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.items.length > 50 && (
                  <p className="text-center text-xs text-gray-400 py-2">
                    Viser 50 av {preview.items.length} linjer
                  </p>
                )}
              </div>
            </div>
          )}
        </Card>

        {/* Step 5 */}
        <Card>
          <StepHeader step={5} title="Last ned CSV" color="bg-teal-500" icon={FileDown} />
          <p className="text-sm text-gray-500 mb-4">
            Velg periode og last ned Tripletex-importfilen.
          </p>

          <div className="flex flex-wrap gap-2 mb-4">
            <Btn variant="secondary" onClick={() => {
              const now = new Date();
              setFradato(formatDateDMY(startOfMonth(now)));
              setTildato(formatDateDMY(setDate(now, 15)));
            }}>01–15 denne mnd.</Btn>
            <Btn variant="secondary" onClick={() => {
              const now = new Date();
              setFradato(formatDateDMY(setDate(now, 16)));
              setTildato(formatDateDMY(endOfMonth(now)));
            }}>16–slutt denne mnd.</Btn>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { label: "Fra dato", value: fradato, set: setFradato },
              { label: "Til dato", value: tildato, set: setTildato },
            ].map(({ label, value, set }) => (
              <div key={label}>
                <label className="text-xs text-gray-500 mb-1 block">{label} (DD/MM/ÅÅÅÅ)</label>
                <input
                  type="text" value={value} onChange={(e) => set(e.target.value)}
                  placeholder="01/04/2026"
                  className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
              </div>
            ))}
          </div>

          <Btn
            onClick={handleDownload}
            disabled={!quinyxFile || !fradato || !tildato || !preview}
            loading={downloading}
            className="w-full justify-center bg-teal-600 hover:bg-teal-700 text-white"
          >
            <FileDown className="w-4 h-4" /> Last ned Tripletex CSV
          </Btn>
          {!preview && (
            <p className="text-xs text-center text-gray-400 mt-2">Generer forhåndsvisning i steg 4 først.</p>
          )}
        </Card>

        <p className="text-center text-xs text-gray-400 pb-6">
          ShiftSync v2 · Quinyx → Tripletex
        </p>
      </div>
    </div>
  );
}
