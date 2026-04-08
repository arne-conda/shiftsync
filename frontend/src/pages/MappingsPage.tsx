import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Save, Loader2, Map, ArrowLeft, History } from "lucide-react";
import { getSalaryTypeMappings, saveSalaryTypeMappings, type SalaryTypeMapping } from "@/lib/api";

type Row = SalaryTypeMapping & { id: string };

function newRow(): Row {
  return { id: crypto.randomUUID(), source_code: "", target_loennsart: "", rate: "", comment: "" };
}

export default function MappingsPage() {
  const [tab, setTab] = useState<"driver" | "warehouse">("driver");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchMappings(tab);
  }, [tab]);

  async function fetchMappings(type: string) {
    setLoading(true);
    try {
      const res = await getSalaryTypeMappings(type);
      setRows(res.mappings.map(m => ({ ...m, id: String(m.id) })));
    } catch (e: any) {
      toast.error(e.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    const valid = rows.filter(r => r.source_code && r.target_loennsart);
    if (!valid.length) { toast.error("Ingen gyldige rader å lagre."); return; }
    setSaving(true);
    try {
      await saveSalaryTypeMappings(tab, valid.map(({ source_code, target_loennsart, rate, comment }) => ({
        source_code, target_loennsart, rate: rate || undefined, comment: comment || undefined,
      })));
      toast.success("Mappinger lagret.");
      fetchMappings(tab);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  function update(id: string, field: keyof SalaryTypeMapping, value: string) {
    setRows(r => r.map(row => row.id === id ? { ...row, [field]: value } : row));
  }

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Navbar */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition">
              <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold">S</span>
              </div>
              <span className="font-semibold text-slate-900 text-sm">ShiftSync</span>
            </a>
            <span className="text-slate-300">/</span>
            <div className="flex items-center gap-1.5 text-sm text-slate-500">
              <Map className="w-3.5 h-3.5" /> Lønnstype-mapping
            </div>
          </div>
          <nav className="flex items-center gap-0.5">
            <a href="/" className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition">
              <ArrowLeft className="w-3.5 h-3.5" /> Tilbake
            </a>
            <a href="/logg" className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition">
              <History className="w-3.5 h-3.5" /> Kjøringslogg
            </a>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 pt-10 pb-16">

        <div className="mb-8">
          <h1 className="text-xl font-semibold text-slate-900">Lønnstype-mapping</h1>
          <p className="text-sm text-slate-400 mt-0.5">Koble Quinyx-koder til Tripletex lønnsarter og satser.</p>
        </div>

        {/* Tab toggle */}
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit mb-6">
          {(["driver", "warehouse"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-1.5 rounded-lg text-sm font-medium transition ${
                tab === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {t === "driver" ? "Sjåfører" : "Lager"}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Laster...
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      {["Quinyx-kode", "Tripletex lønnsart", "Sats", "Kommentar", ""].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {rows.map(row => (
                      <tr key={row.id} className="hover:bg-slate-50 group">
                        {(["source_code", "target_loennsart", "rate", "comment"] as const).map(field => (
                          <td key={field} className="px-4 py-2">
                            <input
                              value={row[field] ?? ""}
                              onChange={e => update(row.id, field, e.target.value)}
                              placeholder={field === "source_code" ? "1234" : field === "target_loennsart" ? "5678" : ""}
                              className="w-full bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 py-0.5 text-slate-700 placeholder:text-slate-300"
                            />
                          </td>
                        ))}
                        <td className="px-4 py-2">
                          <button
                            onClick={() => setRows(r => r.filter(x => x.id !== row.id))}
                            className="text-slate-200 hover:text-red-400 transition opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center py-14 text-slate-300 text-sm">
                          Ingen mappinger enda.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
                <button
                  onClick={() => setRows(r => [...r, newRow()])}
                  className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium transition"
                >
                  <Plus className="w-4 h-4" /> Legg til rad
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition shadow-sm"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Lagre mappinger
                </button>
              </div>
            </>
          )}
        </div>

      </main>
    </div>
  );
}
