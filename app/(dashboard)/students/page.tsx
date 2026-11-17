"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  listStudents,
  listHomeVisitors,
  getStudentGenderCounts,
  type StudentListItem,
  type StudentGenderCounts,
} from "@/services/studentService";
import { listProvinces } from "@/services/lookupService";
import { listNgoFilterOptions, type NgoFilterOption } from "@/services/ngoService";
import { getMyProfile } from "@/services/userService";
import { getSignedStudentDocumentUrls, pickLatestPhotoPath } from "@/lib/storage";
import { StudentsTable } from "@/components/tables/StudentsTable";
import { StudentImportDialog } from "@/components/forms/StudentImportDialog";
import { CycleSelect } from "@/components/forms/CycleSelect";
import { Plus, Search, SlidersHorizontal, Trash2, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RoleGate } from "@/components/layout/RoleGate";
import { useAuth } from "@/hooks/useAuth";
import { useCycleFilter } from "@/hooks/useCycleFilter";
import { useRole } from "@/hooks/useRole";
import { STUDENT_STATUSES } from "@/lib/constants";

const PAGE_SIZE = 25;

// Filters + pagination are lost on remount — e.g. going to a student's
// profile/social form and back — because Next.js remounts this page from
// scratch rather than restoring it from cache. Persisting to sessionStorage
// means "back" lands on the same page/filters instead of page 1.
const LIST_STATE_KEY = "students-list-state";

type StoredListState = {
  page: number;
  search: string;
  status: string;
  homeVisitor: string;
  provinceId: string;
  ngoName: string;
};

export default function StudentsPage() {
  const { user } = useAuth();
  const { role } = useRole();
  const { cycles, cycleId, setCycleId, loading: cyclesLoading } = useCycleFilter();
  // Only the newest request may update the page (an older, slower answer for
  // another cycle/filter must not overwrite it).
  const listSeq = useRef(0);
  const countSeq = useRef(0);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [data, setData] = useState<StudentListItem[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  // What's typed in the box; `search` follows it after a short pause so each
  // keystroke doesn't fire a request.
  const [searchInput, setSearchInput] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string>("");
  const [homeVisitor, setHomeVisitor] = useState<string>("");
  const [provinceId, setProvinceId] = useState<string>("");
  const [ngoName, setNgoName] = useState<string>("");
  const [provinces, setProvinces] = useState<{ id: string; name_en: string }[]>([]);
  const [homeVisitors, setHomeVisitors] = useState<string[]>([]);
  const [ngoOptions, setNgoOptions] = useState<NgoFilterOption[]>([]);
  const [genderCounts, setGenderCounts] = useState<StudentGenderCounts | null>(null);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(LIST_STATE_KEY);
      if (raw) {
        const saved: Partial<StoredListState> = JSON.parse(raw);
        if (saved.page) setPage(saved.page);
        if (saved.search) {
          setSearch(saved.search);
          setSearchInput(saved.search);
        }
        if (saved.status) setStatus(saved.status);
        if (saved.homeVisitor) setHomeVisitor(saved.homeVisitor);
        if (saved.provinceId) setProvinceId(saved.provinceId);
        if (saved.ngoName) setNgoName(saved.ngoName);
      }
    } catch {
      // ignore malformed/inaccessible storage — falls back to defaults
    }
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!restored) return;
    const state: StoredListState = { page, search, status, homeVisitor, provinceId, ngoName };
    sessionStorage.setItem(LIST_STATE_KEY, JSON.stringify(state));
  }, [restored, page, search, status, homeVisitor, provinceId, ngoName]);

  useEffect(() => {
    const next = searchInput.trim();
    if (next === search) return;
    const t = setTimeout(() => {
      setPage(1);
      setSearch(next);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput, search]);

  // "/" jumps to the search box from anywhere on the page.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, [contenteditable='true']")) return;
      e.preventDefault();
      searchRef.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const activeFilterCount = [search, status, homeVisitor, provinceId, ngoName].filter(Boolean).length;
  /** Dropdown filters only (not the search box) — the badge on the phone/tablet Filters button. */
  const dropdownFilterCount = [status, homeVisitor, provinceId, ngoName].filter(Boolean).length;
  const [filtersOpen, setFiltersOpen] = useState(false);

  function clearFilters() {
    setPage(1);
    setSearch("");
    setSearchInput("");
    setStatus("");
    setHomeVisitor("");
    setProvinceId("");
    setNgoName("");
  }

  useEffect(() => {
    listProvinces().then(setProvinces).catch(() => toast.error("Failed to load provinces"));
  }, []);

  useEffect(() => {
    listNgoFilterOptions().then(setNgoOptions).catch(() => toast.error("Failed to load NGOs"));
  }, []);

  useEffect(() => {
    if (cyclesLoading) return;
    let cancelled = false;
    listHomeVisitors(cycleId || undefined)
      .then((names) => {
        if (!cancelled) setHomeVisitors(names);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [cycleId, cyclesLoading]);

  useEffect(() => {
    if (!user) return;
    getMyProfile(user.uid).then((profile) => setMyUserId(profile?.id ?? null));
  }, [user]);

  const ngoIds = ngoName ? ngoOptions.find((n) => n.name === ngoName)?.ids : undefined;

  const fetchStudents = useCallback(async () => {
    const seq = ++listSeq.current;
    setLoading(true);
    try {
      const result = await listStudents({
        page,
        pageSize: PAGE_SIZE,
        search: search || undefined,
        status: status || undefined,
        homeVisitor: homeVisitor || undefined,
        provinceId: provinceId || undefined,
        ngoIds,
        cycleId: cycleId || undefined,
      });
      if (seq !== listSeq.current) return;
      setData(result.data);
      setTotal(result.total);
      const photoPaths = result.data
        .map((s) => pickLatestPhotoPath(s.student_documents))
        .filter((p): p is string => !!p);
      const urls = await getSignedStudentDocumentUrls(photoPaths);
      if (seq === listSeq.current) setPhotoUrls(urls);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load students");
    } finally {
      if (seq === listSeq.current) setLoading(false);
    }
  }, [page, search, status, homeVisitor, provinceId, ngoIds, cycleId]);

  useEffect(() => {
    if (!restored || cyclesLoading) return;
    fetchStudents();
  }, [restored, cyclesLoading, fetchStudents]);

  useEffect(() => {
    if (!restored || cyclesLoading) return;
    const seq = ++countSeq.current;
    getStudentGenderCounts({
      search: search || undefined,
      status: status || undefined,
      homeVisitor: homeVisitor || undefined,
      provinceId: provinceId || undefined,
      ngoIds,
      cycleId: cycleId || undefined,
    })
      .then((counts) => {
        if (seq === countSeq.current) setGenderCounts(counts);
      })
      .catch(() => {});
  }, [restored, cyclesLoading, search, status, homeVisitor, provinceId, ngoIds, cycleId]);

  const selectTriggerClass = "w-full lg:w-44";

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Students</h1>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {genderCounts ? (
              <>
                <span>
                  <span className="font-medium text-foreground tabular-nums">{genderCounts.total}</span>{" "}
                  {activeFilterCount > 0 ? "matching" : "total"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-sky-500" aria-hidden />
                  <span className="tabular-nums">{genderCounts.male}</span> male
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-pink-500" aria-hidden />
                  <span className="tabular-nums">{genderCounts.female}</span> female
                </span>
                {genderCounts.other > 0 && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-violet-500" aria-hidden />
                    <span className="tabular-nums">{genderCounts.other}</span> other
                  </span>
                )}
              </>
            ) : (
              "All students across the active selection pipeline."
            )}
          </p>
        </div>
        <RoleGate capability="createEditStudents">
          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden lg:block">
              <CycleSelect
              cycles={cycles}
              value={cycleId}
              allowAll
              className="w-48"
              onChange={(value) => {
                setPage(1);
                setHomeVisitor("");
                setCycleId(value);
              }}
            />
            </div>
            <StudentImportDialog onImported={fetchStudents} />
            <RoleGate capability="viewTrash">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Link
                      href="/students/trash"
                      className={buttonVariants({ variant: "outline", size: "icon" })}
                      aria-label="Trash"
                    />
                  }
                >
                  <Trash2 />
                </TooltipTrigger>
                <TooltipContent>Deleted students</TooltipContent>
              </Tooltip>
            </RoleGate>
            <Link href="/students/new" className={buttonVariants()} aria-label="New student">
              <Plus />
              <span className="sm:hidden">New</span>
              <span className="hidden sm:inline">New Student</span>
            </Link>
          </div>
        </RoleGate>
      </div>

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="flex items-center gap-2 lg:contents">
        <div className="relative w-full min-w-0 flex-1 lg:max-w-sm lg:flex-none">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            type="search"
            placeholder="Search name or code"
            aria-label="Search students"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setSearchInput("");
            }}
            className="h-9 pr-9 pl-9 [&::-webkit-search-cancel-button]:hidden"
          />
          {searchInput ? (
            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                searchRef.current?.focus();
              }}
              className="absolute top-1/2 right-2 flex size-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="size-3.5" />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground sm:block">
              /
            </kbd>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          className={cn("h-9 shrink-0 lg:hidden", (filtersOpen || dropdownFilterCount > 0) && "border-primary/40 bg-primary/5")}
          onClick={() => setFiltersOpen((o) => !o)}
          aria-expanded={filtersOpen}
          aria-controls="student-filters"
        >
          <SlidersHorizontal />
          Filters
          {dropdownFilterCount > 0 && (
            <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-medium text-primary-foreground tabular-nums">
              {dropdownFilterCount}
            </span>
          )}
        </Button>
        </div>

        <div
          id="student-filters"
          className={cn(
            "grid grid-cols-2 gap-2 rounded-xl border bg-card p-3 sm:grid-cols-3 lg:flex lg:flex-wrap lg:items-center lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0",
            !filtersOpen && "hidden lg:flex",
          )}
        >
          <RoleGate capability="createEditStudents">
            <div className="col-span-2 sm:col-span-1 lg:hidden">
              <CycleSelect
              cycles={cycles}
              value={cycleId}
              allowAll
              className="w-full"
              onChange={(value) => {
                setPage(1);
                setHomeVisitor("");
                setCycleId(value);
              }}
            />
            </div>
          </RoleGate>
          <Select
            value={status}
            onValueChange={(value) => {
              setPage(1);
              setStatus(value ?? "");
            }}
          >
            <SelectTrigger className={cn(selectTriggerClass, status && "border-primary/40 bg-primary/5")}>
              <SelectValue placeholder="All statuses">
                {(value: string) => (
                  <span className="capitalize">{value ? value.replace(/_/g, " ") : "All statuses"}</span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All statuses</SelectItem>
              {STUDENT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  <span className="capitalize">{s.replace(/_/g, " ")}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={provinceId}
            onValueChange={(value) => {
              setPage(1);
              setProvinceId(value ?? "");
            }}
          >
            <SelectTrigger className={cn(selectTriggerClass, provinceId && "border-primary/40 bg-primary/5")}>
              <SelectValue placeholder="All provinces">
                {(value: string) => {
                  if (!value) return "All provinces";
                  if (value === "__none__") return "No province";
                  return provinces.find((p) => p.id === value)?.name_en ?? "All provinces";
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All provinces</SelectItem>
              <SelectItem value="__none__">No province set</SelectItem>
              {provinces.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name_en}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={homeVisitor}
            onValueChange={(value) => {
              setPage(1);
              setHomeVisitor(value ?? "");
            }}
          >
            <SelectTrigger className={cn(selectTriggerClass, homeVisitor && "border-primary/40 bg-primary/5")}>
              <SelectValue placeholder="All visitors">
                {(value: string) => value || "All visitors"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All visitors</SelectItem>
              {homeVisitors.map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={ngoName}
            onValueChange={(value) => {
              setPage(1);
              setNgoName(value ?? "");
            }}
          >
            <SelectTrigger className={cn(selectTriggerClass, ngoName && "border-primary/40 bg-primary/5")}>
              <SelectValue placeholder="All NGOs">{(value: string) => value || "All NGOs"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All NGOs</SelectItem>
              {ngoOptions.map((n) => (
                <SelectItem key={n.name} value={n.name}>
                  {n.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" className="col-span-2 justify-self-start text-muted-foreground sm:col-span-1" onClick={clearFilters}>
              <X />
              Clear filters
            </Button>
          )}
        </div>
      </div>

      <StudentsTable
        data={data}
        loading={loading}
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        onPageChange={setPage}
        onChanged={fetchStudents}
        onClearFilters={activeFilterCount > 0 ? clearFilters : undefined}
        role={role}
        currentUserId={myUserId}
        photoUrls={photoUrls}
      />
    </div>
  );
}
