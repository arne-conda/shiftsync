import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Save, Loader2 } from "lucide-react";
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
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Lønnstype-mapping</h1>
          <p className="text-gray-500 text-sm mt-1">
            Koble Quinyx-koder til Tripletex lønnsarter og satser.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {(["driver", "warehouse"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-xl text-sm font-medium transition ${
                tab === t ? "bg-blue-600 text-white" : "bg-white text-gray-600 border hover:bg-gray-50"
              }`}
            >
              {t === "driver" ? "Sjåfører" : "Lager"}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin mr-2" /> Laster...
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {["Quinyx-kode", "Tripletex lønnsart", "Sats", "Kommentar", ""].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.map(row => (
                      <tr key={row.id} className="hover:bg-gray-50">
                        {(["source_code", "target_loennsart", "rate", "comment"] as const).map(field => (
                          <td key={field} className="px-4 py-2">
                            <input
                              value={row[field] ?? ""}
                              onChange={e => update(row.id, field, e.target.value)}
                              placeholder={field === "source_code" ? "1234" : field === "target_loennsart" ? "5678" : ""}
                              className="w-full border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 py-0.5"
                            />
                          </td>
                        ))}
                        <td className="px-4 py-2">
                          <button onClick={() => setRows(r => r.filter(x => x.id !== row.id))}
                            className="text-gray-300 hover:text-red-400 transition">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {rows.length === 0 && (
                      <tr><td colSpan={5} className="text-center py-10 text-gray-400">Ingen mappinger enda.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
                <button onClick={() => setRows(r => [...r, newRow()])}
                  className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800">
                  <Plus className="w-4 h-4" /> Legg til rad
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm hover:bg-blue-700 disabled:opacity-50">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Lagre mappinger
                </button>
              </div>
            </>
          )}
        </div>

        <div className="mt-4 text-center">
          <a href="/" className="text-sm text-gray-400 hover:text-gray-600">← Tilbake til hovedflyt</a>
        </div>
      </div>
    </div>
  );
}
