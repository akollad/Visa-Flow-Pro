import { useState, useRef, useEffect } from "react";
import { useRoute } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  useGetApplication, 
  useUpdateApplication,
  useGetApplicationMessages, 
  useSendMessage,
  getGetApplicationQueryKey,
  getGetApplicationMessagesQueryKey,
  UpdateApplicationInputStatus
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { StatusBadge, statusOptions } from "@/components/StatusBadge";
import { formatDate, formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Send, Save, ArrowLeft, Loader2 } from "lucide-react";

const updateSchema = z.object({
  status: z.string(),
  appointmentDate: z.string().optional().nullable(),
  adminNotes: z.string().optional().nullable(),
  price: z.coerce.number().optional().nullable(),
  isPaid: z.boolean(),
});

export default function AdminApplicationDetail() {
  const [, params] = useRoute("/admin/applications/:id");
  const id = parseInt(params?.id || "0");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const [msgText, setMsgText] = useState("");

  const { data: app, isLoading } = useGetApplication(id, { query: { enabled: !!id } });
  const { data: messages = [] } = useGetApplicationMessages(id, { query: { enabled: !!id } });
  
  const { mutate: updateApp, isPending: isUpdating } = useUpdateApplication();
  const { mutate: sendMessage, isPending: isSending } = useSendMessage();

  const form = useForm<z.infer<typeof updateSchema>>({
    resolver: zodResolver(updateSchema),
    values: {
      status: app?.status || "draft",
      appointmentDate: app?.appointmentDate ? app.appointmentDate.split('T')[0] : "",
      adminNotes: app?.adminNotes || "",
      price: app?.price || 0,
      isPaid: app?.isPaid || false,
    }
  });

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const onUpdate = (data: z.infer<typeof updateSchema>) => {
    // format date for API (iso)
    let appointmentDate = data.appointmentDate || null;
    if (appointmentDate && !appointmentDate.includes('T')) {
      appointmentDate = new Date(appointmentDate).toISOString();
    }

    updateApp({ 
      id, 
      data: {
        ...data,
        status: data.status as UpdateApplicationInputStatus,
        appointmentDate
      } 
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetApplicationQueryKey(id) });
        toast({ title: "Mise à jour réussie", description: "Les modifications ont été sauvegardées." });
      },
      onError: () => toast({ variant: "destructive", title: "Erreur", description: "Impossible de mettre à jour le dossier." })
    });
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!msgText.trim()) return;
    sendMessage({ id, data: { content: msgText } }, {
      onSuccess: () => {
        setMsgText("");
        queryClient.invalidateQueries({ queryKey: getGetApplicationMessagesQueryKey(id) });
      }
    });
  };

  if (isLoading) return <div className="p-12 text-center">Chargement...</div>;
  if (!app) return <div className="p-12 text-center text-red-500">Dossier introuvable</div>;

  return (
    <div className="h-full flex flex-col xl:flex-row gap-6">
      
      {/* LEFT COL: Administration Form */}
      <div className="w-full xl:w-2/3 space-y-6">
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-border shadow-sm">
          <div className="flex justify-between items-start mb-6 pb-6 border-b border-border">
            <div>
              <h1 className="text-2xl font-serif font-bold text-primary mb-1">Administration Dossier</h1>
              <p className="text-muted-foreground">{app.applicantName} - {app.destination.toUpperCase()} {app.visaType}</p>
            </div>
            <StatusBadge status={app.status} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8 bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div><p className="text-xs text-muted-foreground">Passeport</p><p className="font-medium">{app.passportNumber}</p></div>
            <div><p className="text-xs text-muted-foreground">Téléphone (Client)</p><p className="font-medium">{app.user?.phone || "-"}</p></div>
            <div><p className="text-xs text-muted-foreground">Voyage</p><p className="font-medium">{app.travelDate ? formatDate(app.travelDate).split(' ')[0] : "-"}</p></div>
            <div><p className="text-xs text-muted-foreground">Création</p><p className="font-medium">{formatDate(app.createdAt).split(' ')[0]}</p></div>
            <div className="col-span-full mt-2 pt-2 border-t border-slate-200">
              <p className="text-xs text-muted-foreground mb-1">Motif / Notes du client</p>
              <p className="text-sm">{app.purpose || "-"}</p>
              {app.notes && <p className="text-sm mt-1 italic">"{app.notes}"</p>}
            </div>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onUpdate)} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Statut du dossier</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger className="h-11"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          {statusOptions.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="appointmentDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date RDV Consulat (Optionnel)</FormLabel>
                      <FormControl><Input type="date" {...field} value={field.value || ""} className="h-11" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prix facturé ($ USD)</FormLabel>
                      <FormControl><Input type="number" {...field} value={field.value || ""} className="h-11" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isPaid"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-xl border border-border p-3 sm:mt-8 h-11 bg-slate-50">
                      <div className="space-y-0.5">
                        <FormLabel className="text-sm font-medium cursor-pointer">Paiement reçu</FormLabel>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="adminNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes internes (Invisibles au client)</FormLabel>
                    <FormControl><Textarea {...field} value={field.value || ""} className="resize-none" rows={3} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={isUpdating} className="w-full sm:w-auto px-8 gap-2 bg-primary">
                {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Enregistrer les modifications
              </Button>
            </form>
          </Form>
        </div>
      </div>

      {/* RIGHT COL: Chat */}
      <div className="w-full xl:w-1/3 bg-white rounded-2xl border border-border shadow-sm flex flex-col h-[600px] xl:h-[calc(100vh-120px)] xl:sticky xl:top-24">
        <div className="p-4 border-b border-border bg-primary text-primary-foreground rounded-t-2xl flex items-center justify-between">
          <div>
            <h3 className="font-bold">Chat Client</h3>
            <p className="text-xs text-primary-foreground/70">{app.user?.firstName} {app.user?.lastName}</p>
          </div>
        </div>
        
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
          {messages.map((msg) => {
            const isMe = msg.isFromAdmin;
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-slate-500">{isMe ? "Moi (Admin)" : msg.senderName}</span>
                  <span className="text-[10px] text-slate-400">{formatDate(msg.createdAt)}</span>
                </div>
                <div className={`px-4 py-2.5 rounded-2xl max-w-[85%] text-sm shadow-sm ${
                  isMe 
                    ? "bg-secondary text-primary font-medium rounded-br-none" 
                    : "bg-white text-slate-800 rounded-bl-none border border-slate-200"
                }`}>
                  {msg.content}
                </div>
              </div>
            );
          })}
        </div>

        <form onSubmit={handleSend} className="p-4 border-t border-border bg-white rounded-b-2xl">
          <div className="relative flex gap-2">
            <Input 
              value={msgText}
              onChange={(e) => setMsgText(e.target.value)}
              placeholder="Répondre au client..." 
              className="h-11"
            />
            <Button type="submit" disabled={isSending || !msgText.trim()} className="h-11 px-4 bg-primary">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </form>
      </div>

    </div>
  );
}
