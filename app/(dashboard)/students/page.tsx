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
import { buttonVariants } from "@/components/ui/button";
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
        if (saved.search) setSearch(saved.search);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Students</h1>
          <p className="text-sm text-muted-foreground">
            All students across the active selection pipeline.
          </p>
        </div>
        <RoleGate capability="createEditStudents">
          <div className="flex items-center gap-2">
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
            <StudentImportDialog onImported={fetchStudents} />
            <RoleGate capability="viewTrash">
              <Link href="/students/trash" className={buttonVariants({ variant: "outline" })}>
                Trash
              </Link>
            </RoleGate>
            <Link href="/students/new" className={buttonVariants()}>
              New Student
            </Link>
          </div>
        </RoleGate>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search name or code..."
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
          className="max-w-xs"
        />
        <Select
          value={status}
          onValueChange={(value) => {
            setPage(1);
            setStatus(value ?? "");
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All statuses">
              {(value: string) => (value ? value.replace(/_/g, " ") : "All statuses")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All statuses</SelectItem>
            {STUDENT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s.replace(/_/g, " ")}
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
          <SelectTrigger className="w-48">
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
          value={provinceId}
          onValueChange={(value) => {
            setPage(1);
            setProvinceId(value ?? "");
          }}
        >
          <SelectTrigger className="w-48">
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
          value={ngoName}
          onValueChange={(value) => {
            setPage(1);
            setNgoName(value ?? "");
          }}
        >
          <SelectTrigger className="w-48">
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
      </div>

      {genderCounts && (
        <p className="text-sm text-muted-foreground">
          {genderCounts.total} student{genderCounts.total === 1 ? "" : "s"} · {genderCounts.male} male ·{" "}
          {genderCounts.female} female
          {genderCounts.other > 0 ? ` · ${genderCounts.other} other` : ""}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading students...</p>
      ) : (
        <StudentsTable
          data={data}
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
          onPageChange={setPage}
          onChanged={fetchStudents}
          role={role}
          currentUserId={myUserId}
          photoUrls={photoUrls}
        />
      )}
    </div>
  );
}
