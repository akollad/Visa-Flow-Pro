import { Badge } from "@/components/ui/badge";

export function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    draft: { label: "Brouillon", className: "bg-slate-100 text-slate-700 border-slate-200" },
    submitted: { label: "Soumis", className: "bg-blue-100 text-blue-800 border-blue-200" },
    in_review: { label: "En révision", className: "bg-amber-100 text-amber-800 border-amber-200" },
    appointment_scheduled: { label: "RDV Programmé", className: "bg-purple-100 text-purple-800 border-purple-200" },
    approved: { label: "Approuvé", className: "bg-green-100 text-green-800 border-green-200" },
    rejected: { label: "Refusé", className: "bg-red-100 text-red-800 border-red-200" },
  };

  const c = config[status] || config.draft;

  return (
    <Badge variant="outline" className={`font-medium px-3 py-1 ${c.className}`}>
      {c.label}
    </Badge>
  );
}

export const statusOptions = [
  { value: "draft", label: "Brouillon" },
  { value: "submitted", label: "Soumis" },
  { value: "in_review", label: "En révision" },
  { value: "appointment_scheduled", label: "RDV Programmé" },
  { value: "approved", label: "Approuvé" },
  { value: "rejected", label: "Refusé" },
];
