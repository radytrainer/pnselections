"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { candidateDetails, sessionLabel, type ExamCandidate, type ExamData } from "@/features/written-exam/scoring";
import { getExamData } from "@/services/writtenExamService";

/**
 * Printable lists for one exam session, one page per room:
 *  - type=wall        display list to post outside the room (A4 portrait):
 *                     ID, first name, last name, gender, high school
 *  - type=attendance  sheet for the day (A4 landscape): ID number, first name,
 *                     last name, gender, DoB, high school, exam center,
 *                     province, NGO, signature
 * Details come from the linked student, else the candidate's imported details.
 * Opened from Written Exams → Planning with ?print=1 (print dialog → Save as PDF).
 */
const GENDER: Record<string, string> = { male: "Male", female: "Female", "lgbtqia+": "LGBTQIA+" };
const fmtDate = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "");

export default function ExamListsPage() {
  const { user, loading: authLoading } = useAuth();
  const [params, setParams] = useState<{ cycleId: string; sessionId: string; type: "wall" | "attendance"; print: boolean } | null>(null);
  const [data, setData] = useState<ExamData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setParams({
      cycleId: q.get("cycleId") ?? "",
      sessionId: q.get("sessionId") ?? "",
      type: q.get("type") === "attendance" ? "attendance" : "wall",
      print: q.get("print") === "1",
    });
  }, []);

  useEffect(() => {
    if (!params || authLoading) return;
    if (!user) return setError("Please sign in to print exam lists.");
    if (!params.cycleId || !params.sessionId) return setError("Missing session.");
    getExamData(params.cycleId)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [params, user, authLoading]);

  const view = useMemo(() => {
    if (!data || !params) return null;
    const center = data.centers.find((c) => c.sessions.some((s) => s.id === params.sessionId));
    const session = center?.sessions.find((s) => s.id === params.sessionId);
    if (!center || !session) return null;
    const inSession = data.candidates.filter((c) => c.session_id === session.id);
    const byNumber = (a: ExamCandidate, b: ExamCandidate) => a.exam_number.localeCompare(b.exam_number);
    const groups = [
      ...center.rooms.map((r) => ({ room: r.name, capacity: r.capacity, list: inSession.filter((c) => c.room_id === r.id).sort(byNumber) })),
      { room: "No room assigned", capacity: null, list: inSession.filter((c) => !c.room_id || !center.rooms.some((r) => r.id === c.room_id)).sort(byNumber) },
    ].filter((g) => g.list.length);
    return { center, session, groups, total: inSession.length };
  }, [data, params]);

  useEffect(() => {
    if (!view || !params) return;
    const prev = document.title;
    document.title = `${params.type === "wall" ? "Display list" : "Attendance list"} - ${view.center.name} - ${view.session.session_date}`;
    let t: ReturnType<typeof setTimeout> | undefined;
    if (params.print) t = setTimeout(() => window.print(), 700);
    return () => {
      document.title = prev;
      if (t) clearTimeout(t);
    };
  }, [view, params]);

  const isWall = params?.type === "wall";

  return (
    <div className="min-h-screen bg-slate-100 py-6 print:bg-white print:py-0">
      <style>{`
        @page { size: A4 ${isWall ? "portrait" : "landscape"}; margin: ${isWall ? "12mm" : "10mm"}; @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 8pt system-ui, sans-serif; color: #64748b; } }
        @media print {
          html, body { background: #fff !important; }
          .no-print { display: none !important; }
          .room-page { break-after: page; }
          .room-page:last-child { break-after: auto; }
          tr { break-inside: avoid; }
        }
      `}</style>

      <div className={`no-print mx-auto mb-4 flex items-center justify-between gap-2 px-4 sm:px-0 ${isWall ? "max-w-[210mm]" : "max-w-[297mm]"}`}>
        <Link href="/exams" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back to Written Exams
        </Link>
        <Button onClick={() => window.print()} disabled={!view}>
          <Download /> Download PDF
        </Button>
      </div>

      <div className={`mx-auto w-full space-y-6 print:max-w-none print:space-y-0 ${isWall ? "max-w-[210mm]" : "max-w-[297mm]"}`}>
        {error ? (
          <p className="rounded bg-white py-20 text-center text-sm text-rose-700">{error}</p>
        ) : !view ? (
          <p className="flex items-center justify-center gap-2 rounded bg-white py-20 text-sm text-slate-500">
            {data ? "This session wasn't found." : <><Loader2 className="size-4 animate-spin" /> Preparing lists…</>}
          </p>
        ) : view.groups.length === 0 ? (
          <p className="rounded bg-white py-20 text-center text-sm text-slate-500">No candidates are assigned to this session yet.</p>
        ) : (
          view.groups.map((g) => (
            <section
              key={g.room}
              className={`room-page bg-white py-[10mm] text-slate-900 shadow-sm print:px-0 print:py-0 print:shadow-none ${isWall ? "px-[12mm]" : "px-[10mm]"}`}
            >
              <header className="flex items-end justify-between gap-4 border-b-2 border-[#00427a] pb-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/pn-logo.png" alt="Passerelles Numériques" className="h-[12mm] w-auto" />
                <div className="text-right">
                  <h1 className="text-[15pt] font-semibold text-[#00427a]">{isWall ? "Written exam — candidate list" : "Written exam — attendance list"}</h1>
                  <p className="text-[9pt] text-slate-600">
                    {data?.cycle.name} · {view.center.name}
                    {view.center.province_name ? `, ${view.center.province_name}` : ""}
                  </p>
                </div>
              </header>
              <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
                <p className={isWall ? "text-[22pt] font-semibold" : "text-[13pt] font-semibold"}>{g.room}</p>
                <p className="text-[10pt] text-slate-600">
                  {sessionLabel(view.session)} · {g.list.length} candidate{g.list.length === 1 ? "" : "s"}
                  {g.capacity ? ` · ${g.capacity} seats` : ""}
                </p>
              </div>

              {isWall ? (
                <table className="mt-3 w-full border-collapse text-[12pt]">
                  <thead>
                    <tr className="border-b-2 border-slate-300 text-left text-[8pt] tracking-wide text-slate-500 uppercase">
                      <th className="w-[13%] py-1.5 pr-2 font-medium">ID</th>
                      <th className="w-[20%] py-1.5 pr-2 font-medium">First name</th>
                      <th className="w-[20%] py-1.5 pr-2 font-medium">Last name</th>
                      <th className="w-[11%] py-1.5 pr-2 font-medium">Gender</th>
                      <th className="py-1.5 font-medium">High school</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.list.map((c) => {
                      const d = candidateDetails(c);
                      return (
                        <tr key={c.id} className="border-b border-slate-200 align-top">
                          <td className="py-1.5 pr-2 font-mono text-[13pt] font-semibold tabular-nums">{c.exam_number}</td>
                          <td className="py-1.5 pr-2">{d.firstName}</td>
                          <td className="py-1.5 pr-2">{d.lastName}</td>
                          <td className="py-1.5 pr-2">{GENDER[d.gender ?? ""] ?? ""}</td>
                          <td className="py-1.5 text-[10.5pt]">{d.highSchool}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <>
                  <table className="mt-3 w-full border-collapse text-[9pt]">
                    <thead>
                      <tr className="bg-slate-100 text-left text-[7.5pt] tracking-wide text-slate-600 uppercase">
                        <th className="w-[3%] border border-slate-300 px-1.5 py-1.5 font-medium">#</th>
                        <th className="w-[7%] border border-slate-300 px-1.5 py-1.5 font-medium">ID number</th>
                        <th className="w-[10%] border border-slate-300 px-1.5 py-1.5 font-medium">First name</th>
                        <th className="w-[10%] border border-slate-300 px-1.5 py-1.5 font-medium">Last name</th>
                        <th className="w-[6%] border border-slate-300 px-1.5 py-1.5 font-medium">Gender</th>
                        <th className="w-[7.5%] border border-slate-300 px-1.5 py-1.5 font-medium">DoB</th>
                        <th className="w-[14%] border border-slate-300 px-1.5 py-1.5 font-medium">High school</th>
                        <th className="w-[11%] border border-slate-300 px-1.5 py-1.5 font-medium">Exam center</th>
                        <th className="w-[9%] border border-slate-300 px-1.5 py-1.5 font-medium">Province</th>
                        <th className="w-[10%] border border-slate-300 px-1.5 py-1.5 font-medium">NGO</th>
                        <th className="border border-slate-300 px-1.5 py-1.5 font-medium">Signature</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.list.map((c, i) => {
                        const d = candidateDetails(c);
                        return (
                          <tr key={c.id}>
                            <td className="border border-slate-300 px-1.5 py-2 text-slate-500 tabular-nums">{i + 1}</td>
                            <td className="border border-slate-300 px-1.5 py-2 font-mono tabular-nums">{c.exam_number}</td>
                            <td className="border border-slate-300 px-1.5 py-2">{d.firstName}</td>
                            <td className="border border-slate-300 px-1.5 py-2">{d.lastName}</td>
                            <td className="border border-slate-300 px-1.5 py-2">{GENDER[d.gender ?? ""] ?? ""}</td>
                            <td className="border border-slate-300 px-1.5 py-2 tabular-nums">{fmtDate(d.dob)}</td>
                            <td className="border border-slate-300 px-1.5 py-2">{d.highSchool}</td>
                            <td className="border border-slate-300 px-1.5 py-2">{view.center.name}</td>
                            <td className="border border-slate-300 px-1.5 py-2">{d.province}</td>
                            <td className="border border-slate-300 px-1.5 py-2">{d.ngo}</td>
                            <td className="border border-slate-300 px-1.5 py-2" />
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="mt-8 grid grid-cols-3 gap-8 text-[9pt]">
                    {["Present (total)", "Supervisor name", "Supervisor signature"].map((l) => (
                      <div key={l}>
                        <div className="h-8 border-b border-slate-400" />
                        <p className="mt-1 text-slate-600">{l}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>
          ))
        )}
      </div>
    </div>
  );
}
