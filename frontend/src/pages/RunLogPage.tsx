import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Download, Loader2, History, ArrowLeft, Map } from "lucide-react";
import { getRunLog, downloadPreviousRun, type RunLogEntry } from "@/lib/api";

export default function RunLogPage() {
  const [entries, setEntries] = useState<RunLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<number | null>(null);

  useEffect(() => {
    getRunLog()
      .then(setEntries)
      .catch((e: any) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleDownload(entry: RunLogEntry) {
    setDownloading(entry.id);
    try {
      const blob = await downloadPreviousRun(entry.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `importlonn_${entry.fradato}-${entry.tildato}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDownloading(null);
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString("no-NO", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
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
              <History className="w-3.5 h-3.5" /> Kjøringslogg
            </div>
          </div>
          <nav className="flex items-center gap-0.5">
            <a href="/" className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition">
              <ArrowLeft className="w-3.5 h-3.5" /> Tilbake
            </a>
            <a href="/mappings" className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition">
              <Map className="w-3.5 h-3.5" /> Lønnstype-mapping
            </a>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 pt-10 pb-16">

        <div className="mb-8">
          <h1 className="text-xl font-semibold text-slate-900">Kjøringslogg</h1>
          <p className="text-sm text-slate-400 mt-0.5">Tidligere genererte Tripletex-filer.</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Laster...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    {["Dato", "Type", "Periode", "Ansatte", "Linjer", ""].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {entries.map(entry => (
                    <tr key={entry.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap text-xs">{formatDate(entry.created_at)}</td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          entry.employee_type === "driver"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-amber-50 text-amber-700"
                        }`}>
                          {entry.employee_type === "driver" ? "Sjåfører" : "Lager"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-700 whitespace-nowrap text-sm">{entry.fradato} – {entry.tildato}</td>
                      <td className="px-4 py-3.5 text-slate-600 text-sm">{entry.employee_count}</td>
                      <td className="px-4 py-3.5 text-slate-600 text-sm">{entry.row_count}</td>
                      <td className="px-4 py-3.5">
                        <button
                          onClick={() => handleDownload(entry)}
                          disabled={downloading === entry.id}
                          className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 disabled:opacity-40 font-medium transition"
                        >
                          {downloading === entry.id
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <Download className="w-4 h-4" />}
                          Last ned
                        </button>
                      </td>
                    </tr>
                  ))}
                  {entries.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-16 text-slate-300 text-sm">
                        Ingen kjøringer enda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
