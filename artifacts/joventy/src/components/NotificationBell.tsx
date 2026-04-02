import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import { useLocation } from "wouter";
import { Bell, CheckCheck, ExternalLink } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState } from "react";

type Notif = {
  _id: Id<"notifications">;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: number;
  applicationId?: Id<"applications">;
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "À l'instant";
  if (min < 60) return `il y a ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h}h`;
  const d = Math.floor(h / 24);
  return `il y a ${d}j`;
}

function typeIcon(type: string): string {
  switch (type) {
    case "slot_found": return "🎯";
    case "engagement_validated": return "✅";
    case "hunting_started": return "🔍";
    case "success_fee_validated": return "🎉";
    case "dossier_completed": return "📁";
    case "visa_obtained": return "🛂";
    case "rejected": return "❌";
    case "new_message": return "💬";
    case "new_application": return "📋";
    case "payment_proof_submitted": return "💳";
    default: return "🔔";
  }
}

export function NotificationBell({ isAdmin }: { isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();
  const notifications = (useQuery(api.notifications.list) ?? []) as Notif[];
  const unreadCount = useQuery(api.notifications.getUnreadCount) ?? 0;
  const markRead = useMutation(api.notifications.markRead);
  const markAllRead = useMutation(api.notifications.markAllRead);

  async function handleClick(notif: Notif) {
    if (!notif.read) {
      await markRead({ notificationId: notif._id });
    }
    if (notif.applicationId) {
      const base = isAdmin ? "/admin/applications" : "/dashboard/applications";
      navigate(`${base}/${notif.applicationId}`);
      setOpen(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative flex items-center justify-center w-9 h-9 rounded-xl hover:bg-slate-100 transition-colors flex-shrink-0"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5 text-slate-500" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold min-w-[17px] h-[17px] px-0.5 rounded-full flex items-center justify-center leading-none">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        side="bottom"
        align="end"
        sideOffset={8}
        className="w-[340px] p-0 shadow-xl border border-border rounded-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-white">
          <h3 className="text-sm font-bold text-primary">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground h-auto px-2 py-1 gap-1"
              onClick={() => markAllRead()}
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Tout marquer lu
            </Button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
            <Bell className="w-8 h-8 text-slate-200 mb-2" />
            <p className="text-sm text-muted-foreground">Aucune notification pour l'instant.</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <ul className="divide-y divide-border">
              {notifications.map((notif) => (
                <li key={notif._id}>
                  <button
                    className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-start gap-3 ${
                      !notif.read ? "bg-blue-50/50" : ""
                    }`}
                    onClick={() => handleClick(notif)}
                  >
                    <span className="text-lg flex-shrink-0 mt-0.5">{typeIcon(notif.type)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <p className={`text-xs font-semibold text-primary truncate ${!notif.read ? "font-bold" : ""}`}>
                          {notif.title}
                        </p>
                        {!notif.read && (
                          <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-0.5" />
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{notif.body}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] text-slate-400">{timeAgo(notif.createdAt)}</span>
                        {notif.applicationId && (
                          <span className="text-[10px] text-secondary flex items-center gap-0.5">
                            Voir le dossier <ExternalLink className="w-2.5 h-2.5" />
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
