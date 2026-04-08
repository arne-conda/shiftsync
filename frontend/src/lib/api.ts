const BASE = import.meta.env.VITE_API_URL ?? "";

async function request(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      detail = err.detail ?? JSON.stringify(err);
    } catch {}
    throw new Error(detail);
  }
  return res;
}

// -- Employer mappings --

export async function uploadEmployerFile(file: File) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await request("/api/employer/upload", { method: "POST", body: fd });
  return res.json() as Promise<{ message: string; mappings_count: number }>;
}

export async function getEmployerMappings() {
  const res = await request("/api/employer/mappings");
  return res.json() as Promise<{
    mappings: { normalized_name: string; lonnstakernr: string }[];
    count: number;
  }>;
}

export async function clearEmployerMappings() {
  await request("/api/employer/mappings", { method: "DELETE" });
}

// -- Salary type mappings --

export type SalaryTypeMapping = {
  id?: string;
  source_code: string;
  target_loennsart: string;
  rate?: string;
  comment?: string;
};

export async function getSalaryTypeMappings(employeeType: string) {
  const res = await request(`/api/salary-types/${employeeType}`);
  return res.json() as Promise<{
    employee_type: string;
    mappings: (SalaryTypeMapping & { id: string })[];
  }>;
}

export async function saveSalaryTypeMappings(
  employeeType: string,
  mappings: SalaryTypeMapping[]
) {
  const res = await request(`/api/salary-types/${employeeType}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ employee_type: employeeType, mappings }),
  });
  return res.json();
}

// -- Processing --

export type WorkerSummary = {
  full_name: string;
  lonnstakernr?: string;
  salary_type_summary: { salary_type: string; total_hours: number }[];
};

export type AggregatedResponse = {
  data: WorkerSummary[];
  unmapped_names: string[];
  message: string;
};

export async function aggregateQuinyx(file: File, employeeType: string) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await request(
    `/api/process/aggregate?employee_type=${employeeType}`,
    { method: "POST", body: fd }
  );
  return res.json() as Promise<AggregatedResponse>;
}

export type PreviewItem = {
  lonnstakernr: string;
  employee_name: string;
  quinyx_code: string;
  loennsart: string;
  hours: number;
  rate?: number;
  amount?: number;
  comment?: string;
};

export type PreviewResponse = {
  items: PreviewItem[];
  total_hours: number;
  total_amount: number;
  missing_employee_mappings: number;
  missing_salary_type_mappings: number;
  message: string;
};

export async function previewSalary(file: File, employeeType: string) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await request(
    `/api/process/preview?employee_type=${employeeType}`,
    { method: "POST", body: fd }
  );
  return res.json() as Promise<PreviewResponse>;
}

export async function downloadCsv(
  file: File,
  employeeType: string,
  fradato: string,
  tildato: string
) {
  const fd = new FormData();
  fd.append("file", file);
  const params = new URLSearchParams({ employee_type: employeeType, fradato, tildato });
  const res = await request(`/api/process/download-csv?${params}`, {
    method: "POST",
    body: fd,
  });
  return res.blob();
}

export async function saveManualMapping(name: string, lonnstakernr: string) {
  const params = new URLSearchParams({ name, lonnstakernr });
  await request(`/api/process/manual-mapping?${params}`, { method: "POST" });
}

// -- Run log --

export type RunLogEntry = {
  id: number;
  created_at: string;
  employee_type: string;
  fradato: string;
  tildato: string;
  employee_count: number;
  row_count: number;
};

export async function saveRun(
  employeeType: string,
  fradato: string,
  tildato: string,
  employeeCount: number,
  rowCount: number,
  csvContent: string
): Promise<{ id: number }> {
  const params = new URLSearchParams({
    employee_type: employeeType, fradato, tildato,
    employee_count: String(employeeCount), row_count: String(rowCount)
  });
  const res = await request(`/api/process/save-run?${params}`, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: csvContent,
  });
  return res.json();
}

export async function getRunLog(): Promise<RunLogEntry[]> {
  const res = await request("/api/process/run-log");
  return res.json();
}

export async function downloadPreviousRun(id: number): Promise<Blob> {
  const res = await request(`/api/process/run-log/${id}/download`);
  return res.blob();
}

export async function searchEmployers(q: string) {
  const res = await request(`/api/employer/search?q=${encodeURIComponent(q)}`);
  return res.json() as Promise<{ normalized_name: string; lonnstakernr: string }[]>;
}
