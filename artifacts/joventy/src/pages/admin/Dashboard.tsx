import { Link } from "wouter";
import { useGetAdminStats } from "@workspace/api-client-react";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate, formatCurrency } from "@/lib/format";
import { Users, FileText, CheckCircle2, Clock, ChevronRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

export default function AdminDashboard() {
  const { data: stats, isLoading } = useGetAdminStats();

  if (isLoading) return <div className="p-8 text-center">Chargement des statistiques...</div>;

  // Prepare chart data safely
  const chartData = stats ? Object.entries(stats.byDestination).map(([key, value]) => ({
    name: key.toUpperCase(),
    valeur: value
  })) : [];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-serif font-bold text-primary">Vue d'ensemble</h1>
        <p className="text-muted-foreground mt-1">Contrôlez les opérations et les dossiers en temps réel.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {[
          { label: "Total Dossiers", value: stats?.totalApplications || 0, icon: FileText, bg: "bg-blue-50", color: "text-blue-600" },
          { label: "En Révision", value: stats?.pendingReview || 0, icon: Clock, bg: "bg-amber-50", color: "text-amber-600" },
          { label: "Approuvés (Mois)", value: stats?.approvedThisMonth || 0, icon: CheckCircle2, bg: "bg-green-50", color: "text-green-600" },
          { label: "Clients Actifs", value: stats?.totalClients || 0, icon: Users, bg: "bg-purple-50", color: "text-purple-600" },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl border border-border shadow-sm flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.bg}`}>
              <stat.icon className={`w-6 h-6 ${stat.color}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
              <h3 className="text-2xl font-bold text-primary">{stat.value}</h3>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-border shadow-sm p-6">
          <h2 className="text-lg font-bold text-primary mb-6">Demandes par destination</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                <Bar dataKey="valeur" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#0A192F' : '#D4AF37'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent list */}
        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-border flex justify-between items-center bg-slate-50">
            <h2 className="text-lg font-bold text-primary">Activités récentes</h2>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[350px] p-0 divide-y divide-border">
            {(stats?.recentApplications || []).map((app) => (
              <Link key={app.id} href={`/admin/applications/${app.id}`}>
                <div className="p-4 hover:bg-slate-50 transition-colors cursor-pointer">
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-semibold text-primary text-sm truncate pr-2">{app.applicantName}</p>
                    <StatusBadge status={app.status} />
                  </div>
                  <div className="flex justify-between items-center text-xs text-muted-foreground">
                    <span>{app.destination.toUpperCase()} - {app.visaType}</span>
                    <span className="flex items-center gap-1">
                      {formatDate(app.updatedAt)} <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
            {stats?.recentApplications.length === 0 && (
              <div className="p-8 text-center text-muted-foreground text-sm">Aucune activité</div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
