"use client";

export function MapTotals({
  totalStudents,
  totalNgos,
  totalSchools,
}: {
  totalStudents: number;
  totalNgos: number;
  totalSchools: number;
}) {
  return (
    <div className="flex items-center gap-4 rounded-lg border bg-card px-4 py-2 text-sm shadow-sm">
      <span>
        <span className="font-semibold">{totalStudents}</span>{" "}
        <span className="text-muted-foreground">Students</span>
      </span>
      <span className="border-l pl-4">
        <span className="font-semibold">{totalNgos}</span>{" "}
        <span className="text-muted-foreground">NGO</span>
      </span>
      <span className="border-l pl-4">
        <span className="font-semibold">{totalSchools}</span>{" "}
        <span className="text-muted-foreground">Schools</span>
      </span>
    </div>
  );
}
