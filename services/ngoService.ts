import { api } from "@/lib/api/client";
import type { Database } from "@/types/database.types";

export type Ngo = Database["public"]["Tables"]["ngo_partners"]["Row"];
export type NgoInsert = Database["public"]["Tables"]["ngo_partners"]["Insert"];
export type NgoUpdate = Database["public"]["Tables"]["ngo_partners"]["Update"];
export type NgoProject = Database["public"]["Tables"]["ngo_projects"]["Row"];

export type NgoListItem = Ngo & {
  provinces: { name_en: string } | null;
};

export type NgoStats = {
  referred: number;
  selected: number;
  referredThisCycle: number;
};

export type NgoListItemWithStats = NgoListItem & NgoStats;

export type NgoDetail = Ngo & {
  provinces: { name_en: string } | null;
  ngo_projects: NgoProject[];
};

export async function listNgos() {
  return api.get<NgoListItem[]>("/api/v1/ngos");
}

/** NGO list with referred/selected/this-cycle counts, aggregated client-side
 * from one students query (avoids N+1 per-row calls to getNgoPerformance).
 *
 * Stats are grouped by (organization_name, province_id), not ngo_partners.id:
 * several organizations have more than one ngo_partners record under the
 * identical name (duplicate data entry, e.g. four separate "SOS" rows, one
 * per province, see listNgoFilterOptions), and a student referred by that
 * organization can be attached to any one of those duplicate ids regardless
 * of which one's province they actually live in. To match what the Students
 * page shows when you filter it by this row's own Province + this NGO's name
 * (all duplicate ids), a row's stats must count students whose own
 * province_id equals this row's province_id — not every student the
 * organization ever referred nationwide, and not just students attached to
 * this one specific duplicate id.
 *
 * The organization_name for each student is looked up from the (non-deleted)
 * `ngos` list already fetched here, by referred_by_ngo_id — not via an
 * embedded `ngo_partners(organization_name)` join on the students query.
 * That join ignores ngo_partners.deleted_at entirely, so a student still
 * pointing at a soft-deleted duplicate id would resolve to its name and get
 * counted here even though that id (and so that student, for this NGO) is
 * invisible to the Students page's NGO filter, which only matches ids from
 * listNgoFilterOptions's non-deleted list — inflating this page's count
 * above what filtering the Students page actually shows. */
export async function listNgosWithStats(): Promise<NgoListItemWithStats[]> {
  const res = await api.get<{ ngos: NgoListItem[]; activeCycleId: string | null; students: unknown[] }>(
    "/api/v1/ngos/with-stats",
  );

  const ngos = res.ngos;
  const nameById = new Map(ngos.map((ngo) => [ngo.id, ngo.organization_name]));

  const activeCycleId = res.activeCycleId;
  const rows = res.students as {
    referred_by_ngo_id: string;
    cycle_id: string;
    province_id: string | null;
    committee_decisions: { decision: string | null } | null;
  }[];

  const statsKey = (name: string, provinceId: string | null) => `${name}::${provinceId ?? "none"}`;

  const statsByKey = new Map<string, NgoStats>();
  for (const row of rows) {
    const name = nameById.get(row.referred_by_ngo_id);
    if (!name) continue;
    const key = statsKey(name, row.province_id);
    const stats = statsByKey.get(key) ?? {
      referred: 0,
      selected: 0,
      referredThisCycle: 0,
    };
    stats.referred += 1;
    if (row.committee_decisions?.decision === "selected") stats.selected += 1;
    if (activeCycleId && row.cycle_id === activeCycleId) stats.referredThisCycle += 1;
    statsByKey.set(key, stats);
  }

  return ngos.map((ngo) => ({
    ...ngo,
    ...(statsByKey.get(statsKey(ngo.organization_name, ngo.province_id)) ?? {
      referred: 0,
      selected: 0,
      referredThisCycle: 0,
    }),
  }));
}

export type NgoFilterOption = { name: string; ids: string[] };

/**
 * Distinct NGO names for filter dropdowns. Several organizations have more
 * than one ngo_partners record under the identical name (duplicate data
 * entry, e.g. four separate "SOS" rows) — this groups by name so each shows
 * once, keeping every id behind it so filtering still matches all of them.
 */
export async function listNgoFilterOptions(): Promise<NgoFilterOption[]> {
  const ngos = await listNgos();
  const byName = new Map<string, string[]>();
  for (const ngo of ngos) {
    const ids = byName.get(ngo.organization_name) ?? [];
    ids.push(ngo.id);
    byName.set(ngo.organization_name, ids);
  }
  return Array.from(byName.entries())
    .map(([name, ids]) => ({ name, ids }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getNgo(id: string) {
  return api.get<NgoDetail>(`/api/v1/ngos/${id}`);
}

export async function createNgo(input: NgoInsert) {
  return api.post<Ngo>("/api/v1/ngos", input);
}

export async function updateNgo(id: string, input: NgoUpdate) {
  return api.patch<Ngo>(`/api/v1/ngos/${id}`, input);
}

export async function updateNgoOutreachStatus(id: string, outreachStatus: Ngo["outreach_status"]) {
  await api.patch(`/api/v1/ngos/${id}/outreach`, { outreachStatus });
}

export async function softDeleteNgo(id: string) {
  await api.delete(`/api/v1/ngos/${id}`);
}

/** Referred vs. selected counts for one NGO, all cycles combined (see docs/05-api-design.md §7).
 *
 * Matches against every ngo_partners id sharing this NGO's organization_name
 * (duplicate rows, one per province — see the grouping note on
 * listNgosWithStats), restricted to students whose own province_id matches
 * this specific row's province — the same (Province, NGO) combination the
 * Students page's filters would produce. */
export async function getNgoPerformance(ngoId: string) {
  return api.get<{ referred: number; selected: number }>(`/api/v1/ngos/${ngoId}/performance`);
}

export type NgoYearlyStat = {
  year: number;
  ngoId: string;
  ngoName: string;
  referred: number;
  selected: number;
};

/** Referred/selected counts per NGO per selection-cycle year, for the
 * dashboard's year-over-year referral chart (filterable by year/NGO there).
 *
 * Grouped by organization_name, not ngo_partners.id — see the grouping note
 * on listNgosWithStats. `ngoId` holds the organization name rather than a
 * real id; it's only ever used as a stable grouping/select key by callers. */
export async function getNgoYearlyStats(): Promise<NgoYearlyStat[]> {
  const rows = (await api.get<unknown[]>("/api/v1/ngos/yearly-stats")) as {
    ngo_partners: { organization_name: string } | null;
    selection_cycles: { year: number } | null;
    committee_decisions: { decision: string | null } | null;
  }[];

  const byKey = new Map<string, NgoYearlyStat>();
  for (const row of rows) {
    if (!row.selection_cycles || !row.ngo_partners) continue;
    const name = row.ngo_partners.organization_name;
    const key = `${name}-${row.selection_cycles.year}`;
    const stat = byKey.get(key) ?? {
      year: row.selection_cycles.year,
      ngoId: name,
      ngoName: name,
      referred: 0,
      selected: 0,
    };
    stat.referred += 1;
    if (row.committee_decisions?.decision === "selected") stat.selected += 1;
    byKey.set(key, stat);
  }

  return Array.from(byKey.values()).sort((a, b) => a.year - b.year || a.ngoName.localeCompare(b.ngoName));
}

export async function createNgoProject(ngoId: string, name: string, description?: string) {
  return api.post<NgoProject>(`/api/v1/ngos/${ngoId}/projects`, { name, description: description || undefined });
}
