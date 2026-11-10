import type { MapColorBy, MapLayerFilter } from "@/components/map/CambodiaMap";

const COLOR_BY_LABELS: Record<MapColorBy, string> = {
  students: "Students",
  ngos: "NGO Partners",
  schools: "School Partners",
};

export function MapLegend({
  colorBy,
  layerFilter,
}: {
  colorBy: MapColorBy;
  layerFilter: MapLayerFilter;
}) {
  const showStudents = layerFilter === "all" || layerFilter === "students";
  const showNgos = layerFilter === "all" || layerFilter === "ngos";
  const showSchools = layerFilter === "all" || layerFilter === "schools";

  return (
    <div className="space-y-2 rounded-lg border bg-card p-3 text-xs shadow-sm">
      {showStudents && (
        <>
          <p className="font-semibold">{COLOR_BY_LABELS[colorBy]} per Province</p>
          <div className="flex items-center gap-1">
            {["#cbd5e1", "#93c5fd", "#2563eb", "#1e3a8a"].map((color) => (
              <span key={color} className="h-3 w-6 rounded-sm" style={{ backgroundColor: color }} />
            ))}
            <span className="ml-1 text-muted-foreground">Low → High</span>
          </div>
        </>
      )}
      {showNgos && (
        <div className={showStudents ? "flex items-center gap-2 border-t pt-2" : "flex items-center gap-2"}>
          <span className="size-3 rounded-full bg-[#38bdf8]" />
          <span>NGO Partner</span>
        </div>
      )}
      {showSchools && (
        <div className="flex items-center gap-2">
          <span className="size-3 rounded-full bg-[#d97706]" />
          <span>School Partner</span>
        </div>
      )}
    </div>
  );
}
