const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
const API_KEY = import.meta.env.VITE_API_KEY ?? "";

export type Severity = "info" | "low" | "medium" | "high" | "critical";
export type Outcome = "pass" | "fail" | "not_applicable";

export interface DeviceService {
  name: string;
  banner: string | null;
}
export interface OpenPort {
  port: number;
  protocol: "tcp" | "udp";
  service: DeviceService | null;
}
export interface Device {
  ip: string;
  hostname: string | null;
  mac: string | null;
  mac_vendor: string | null;
  discovery_method: "icmp" | "tcp_syn" | "arp" | "manual";
  open_ports: OpenPort[];
  discovered_at: string;
}

export interface FirewallRule {
  rule_id: string;
  ruleset_id: string;
  ruleset_name: string;
  source_type: "iptables" | "aws-sg" | "cisco-ios";
  direction: "ingress" | "egress";
  action: string;
  protocol: string;
  source: string;
  destination: string;
  port_range: string;
  description: string | null;
  raw: string | null;
}

export interface BenchmarkResult {
  check_id: string;
  title: string;
  cis_reference: string;
  severity: Severity;
  outcome: Outcome;
  target_kind: "device" | "ruleset";
  target_id: string;
  evidence: string[];
  remediation: string | null;
  evaluated_at: string;
}

export interface CisCatalogEntry {
  check_id: string;
  title: string;
  cis_reference: string;
  severity: Severity;
  remediation: string;
}

export interface CisSummary {
  total: number;
  passed: number;
  failed: number;
  not_applicable: number;
  by_severity: Partial<Record<Severity, number>>;
}

export interface ScanSummary {
  scan_id: string;
  started_at: string;
  finished_at: string;
  device_count: number;
  ruleset_count: number;
  pass_count: number;
  fail_count: number;
}

export interface SampleEntry {
  id: string;
  source_type: "iptables" | "aws-sg" | "cisco-ios";
  label: string;
  available: "true" | "false";
}

export interface StartScanRequest {
  targets: string[];
  sample_ids: string[];
  allow_public?: boolean;
}

export interface Schedule {
  schedule_id: string;
  name: string;
  targets: string[];
  sample_ids: string[];
  allow_public: boolean;
  interval_minutes: number;
  enabled: boolean;
  created_at: string;
  last_run_at: string | null;
  next_run_at: string;
  last_scan_id: string | null;
  last_status: string | null;
}

export interface CreateScheduleRequest {
  name: string;
  targets: string[];
  sample_ids: string[];
  allow_public?: boolean;
  interval_minutes: number;
  enabled?: boolean;
  fire_immediately?: boolean;
}

export interface UpdateScheduleRequest {
  name?: string;
  targets?: string[];
  sample_ids?: string[];
  allow_public?: boolean;
  interval_minutes?: number;
  enabled?: boolean;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (API_KEY) headers.set("X-Api-Key", API_KEY);
  headers.set("Accept", "application/json");

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    let detail = text;
    try {
      const parsed = JSON.parse(text);
      if (parsed?.detail) detail = parsed.detail;
    } catch {
      // not JSON — use raw text
    }
    throw new Error(`${res.status} ${res.statusText} — ${detail}`);
  }
  return (await res.json()) as T;
}

/** Triggers a binary download in the browser without leaving the SPA. */
async function downloadFile(path: string, fallbackName: string): Promise<void> {
  const headers = new Headers();
  if (API_KEY) headers.set("X-Api-Key", API_KEY);
  const res = await fetch(`${API_URL}${path}`, { headers });
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);

  // Pull filename out of Content-Disposition if the server set one.
  const cd = res.headers.get("Content-Disposition") ?? "";
  const match = /filename="?([^";]+)"?/.exec(cd);
  const filename = match?.[1] ?? fallbackName;

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const api = {
  health: () => request<{ status: string; version: string }>("/health"),
  devices: () => request<Device[]>("/devices"),
  rules: (sourceType?: string) =>
    request<FirewallRule[]>(
      sourceType ? `/firewall-rules?source_type=${encodeURIComponent(sourceType)}` : "/firewall-rules"
    ),
  results: (outcome?: Outcome) =>
    request<BenchmarkResult[]>(outcome ? `/cis-results?outcome=${outcome}` : "/cis-results"),
  catalog: () => request<CisCatalogEntry[]>("/cis-results/catalog"),
  summary: () => request<CisSummary>("/cis-results/summary"),

  // Scan trigger + reports
  samples: () => request<SampleEntry[]>("/scans/samples"),
  scans:   () => request<ScanSummary[]>("/scans"),
  startScan: (req: StartScanRequest) =>
    request<ScanSummary>("/scans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    }),
  downloadReport: (scanId: string, format: "json" | "csv" | "pdf") =>
    downloadFile(
      `/scans/${encodeURIComponent(scanId)}/report?format=${format}`,
      `nps-report-${scanId.slice(0, 12)}.${format}`,
    ),

  // Schedules
  schedules: () => request<Schedule[]>("/schedules"),
  createSchedule: (req: CreateScheduleRequest) =>
    request<Schedule>("/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    }),
  updateSchedule: (id: string, req: UpdateScheduleRequest) =>
    request<Schedule>(`/schedules/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    }),
  deleteSchedule: async (id: string): Promise<void> => {
    const headers = new Headers();
    if (API_KEY) headers.set("X-Api-Key", API_KEY);
    const res = await fetch(`${API_URL}/schedules/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers,
    });
    if (!res.ok && res.status !== 204) {
      throw new Error(`Delete failed: ${res.status} ${res.statusText}`);
    }
  },
};

export const config = { API_URL, hasKey: Boolean(API_KEY) };
