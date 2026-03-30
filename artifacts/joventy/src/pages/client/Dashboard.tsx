import { Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { useListApplications } from "@workspace/api-client-react";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate } from "@/lib/format";
import { FileText, Plus, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ClientDashboard() {
  const { user } = useAuth();
  const { data, isLoading } = useListApplications({ limit: 3 });

  const applications = data?.applications || [];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-primary">Bienvenue, {user?.firstName}</h1>
          <p className="text-muted-foreground mt-1">Gérez vos dossiers de visa et suivez leur évolution.</p>
        </div>
        <Link href="/dashboard/applications/new">
          <Button className="gap-2 bg-secondary text-primary hover:bg-yellow-500 font-bold">
            <Plus className="w-4 h-4" /> Nouveau Dossier
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-border shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
            <FileText className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Dossiers Totaux</p>
            <h3 className="text-2xl font-bold text-primary">{data?.total || 0}</h3>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-border shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center">
            <Clock className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">En Cours</p>
            <h3 className="text-2xl font-bold text-primary">
              {applications.filter(a => ['submitted', 'in_review'].includes(a.status)).length}
            </h3>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-border shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Messages Non-lus</p>
            <h3 className="text-2xl font-bold text-primary">
              {applications.reduce((acc, a) => acc + (a.unreadCount || 0), 0)}
            </h3>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border flex justify-between items-center">
          <h2 className="text-xl font-bold text-primary">Dossiers Récents</h2>
          <Link href="/dashboard/applications" className="text-sm font-medium text-secondary hover:underline">
            Voir tout
          </Link>
        </div>
        <div className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Chargement...</div>
          ) : applications.length === 0 ? (
            <div className="p-12 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                <FileText className="w-8 h-8 text-slate-300" />
              </div>
              <h3 className="text-lg font-medium text-primary mb-2">Aucun dossier</h3>
              <p className="text-muted-foreground max-w-sm mx-auto mb-6">Vous n'avez pas encore de dossier de demande de visa en cours.</p>
              <Link href="/dashboard/applications/new">
                <Button>Créer mon premier dossier</Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {applications.map((app) => (
                <Link key={app.id} href={`/dashboard/applications/${app.id}`}>
                  <div className="p-4 sm:p-6 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className="hidden sm:flex w-12 h-12 rounded-xl bg-slate-100 items-center justify-center border border-border">
                        <Plane className="w-5 h-5 text-slate-500" />
                      </div>
                      <div>
                        <h4 className="font-bold text-primary">{app.destination.toUpperCase()} - {app.visaType}</h4>
                        <p className="text-sm text-muted-foreground mt-1">Pour {app.applicantName}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
                      <div className="text-right hidden sm:block">
                        <p className="text-sm font-medium text-primary">Créé le</p>
                        <p className="text-xs text-muted-foreground">{formatDate(app.createdAt)}</p>
                      </div>
                      <StatusBadge status={app.status} />
                      <ChevronRight className="w-5 h-5 text-slate-300 hidden sm:block" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
