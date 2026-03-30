import { useListUsers } from "@workspace/api-client-react";
import { formatDate } from "@/lib/format";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function AdminClients() {
  const { data: users = [], isLoading } = useListUsers();

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-serif font-bold text-primary">Clients Inscrits</h1>
        <p className="text-muted-foreground mt-1">Base de données complète des utilisateurs de la plateforme.</p>
      </div>

      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground">Chargement...</div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">Aucun client trouvé.</div>
        ) : (
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead>Nom Complet</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead className="text-right">Inscription</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium text-primary py-4">
                    {u.firstName} {u.lastName}
                  </TableCell>
                  <TableCell>
                    <span className="block text-sm">{u.email}</span>
                    <span className="text-xs text-muted-foreground">{u.phone || "Non renseigné"}</span>
                  </TableCell>
                  <TableCell>
                    {u.role === 'admin' 
                      ? <Badge variant="default" className="bg-secondary text-primary border-none">Admin</Badge>
                      : <Badge variant="outline" className="text-slate-600">Client</Badge>
                    }
                  </TableCell>
                  <TableCell className="text-right text-sm text-slate-500">{formatDate(u.createdAt).split(' ')[0]}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
