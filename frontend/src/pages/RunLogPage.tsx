import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";
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
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <a href="/" className="text-sm text-gray-400 hover:text-gray-600">← Tilbake til hovedflyt</a>
          <h1 className="text-2xl font-bold text-gray-900 mt-3">Kjørelogg</h1>
          <p className="text-gray-500 text-sm mt-1">Tidligere genererte Tripletex-filer.</p>
        </div>

        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin mr-2" /> Laster...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {["Dato", "Type", "Periode", "Ansatte", "Linjer", ""].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {entries.map(entry => (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{formatDate(entry.created_at)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          entry.employee_type === "driver"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-orange-100 text-orange-700"
                        }`}>
                          {entry.employee_type === "driver" ? "Sjåfører" : "Lager"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{entry.fradato} – {entry.tildato}</td>
                      <td className="px-4 py-3 text-gray-700">{entry.employee_count}</td>
                      <td className="px-4 py-3 text-gray-700">{entry.row_count}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleDownload(entry)}
                          disabled={downloading === entry.id}
                          className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50 transition"
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
                      <td colSpan={6} className="text-center py-10 text-gray-400">Ingen kjøringer enda.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
