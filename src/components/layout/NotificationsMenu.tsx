import { useState, useEffect, useRef } from "react";
import { Bell, Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";

export function NotificationsMenu() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const isMarkingRef = useRef(false);
  const readIdsRef = useRef<Set<string>>(new Set());

  // Persist locally-marked read ids to avoid badge reappearing due to racing fetches
  const loadLocalReadIds = () => {
    try {
      const raw = localStorage.getItem("notifications_read_ids");
      if (!raw) return new Set<string>();
      const arr = JSON.parse(raw) as string[];
      return new Set(arr.map(String));
    } catch (e) {
      return new Set<string>();
    }
  };

  const saveLocalReadIds = (set: Set<string>) => {
    try {
      localStorage.setItem("notifications_read_ids", JSON.stringify(Array.from(set).map(String)));
    } catch (e) {
      // ignore
    }
  };

  const fetchNotifications = async () => {
    if (!user) return;

    let query;

    if (user.role === "admin") {
      query = supabase
        .from("notifications")
        .select("*")
        .in("type", ["payment", "voucher"])
        .order("created_at", { ascending: false })
        .limit(20);
    } else {
      query = supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .in("type", ["approval", "validation"])
        .order("created_at", { ascending: false })
        .limit(20);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Error fetching notifications:", error);
      return;
    }

    if (data) {
      // merge server is_read with locally tracked read ids to avoid race
      readIdsRef.current = loadLocalReadIds();
      const normalized = data.map((n) => {
        const id = String(n.id);
        return {
          ...n,
          id,
          is_read: Boolean(n.is_read) || readIdsRef.current.has(id),
        };
      });
      setNotifications(normalized);
      setUnreadCount(normalized.filter((n) => !n.is_read).length);
    }
  };

  useEffect(() => {
    if (!user) return;

    fetchNotifications();

    const handleUpdate = () => {
      fetchNotifications();
    };
    window.addEventListener("notification-update", handleUpdate);

    const channel = supabase
      .channel("notifications-changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
        },
        (payload) => {
          const newNotif = payload.new;

          if (user.role === "admin") {
            if (["payment", "voucher"].includes(newNotif.type)) {
              setNotifications((prev) => {
                if (prev.some((n) => n.id === newNotif.id)) return prev;
                return [
                  { ...newNotif, is_read: Boolean(newNotif.is_read) },
                  ...prev,
                ].slice(0, 20);
              });
              setUnreadCount((prev) => prev + (newNotif.is_read ? 0 : 1));
            }
          } else if (newNotif.user_id === user.id) {
            setNotifications((prev) => {
              if (prev.some((n) => n.id === newNotif.id)) return prev;
              return [
                { ...newNotif, is_read: Boolean(newNotif.is_read) },
                ...prev,
              ].slice(0, 20);
            });
            setUnreadCount((prev) => prev + (newNotif.is_read ? 0 : 1));
          }
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener("notification-update", handleUpdate);
      supabase.removeChannel(channel);
    };
  }, [user]);

  const markAsRead = async (id: string) => {
    try {
      const normalizedId = String(id);
      // optimistic local update
      readIdsRef.current.add(normalizedId);
      saveLocalReadIds(readIdsRef.current);
      const nextNotifications = notifications.map((n) =>
        String(n.id) === normalizedId ? { ...n, is_read: true } : n
      );
      setNotifications(nextNotifications);
      setUnreadCount((prev) => Math.max(0, prev - 1));

      const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', normalizedId);
      if (error) throw error;
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadIds = notifications.filter((n) => !n.is_read).map((n) => String(n.id));
      if (unreadIds.length > 0) {
        // mark locally first
        unreadIds.forEach((id) => readIdsRef.current.add(id));
        saveLocalReadIds(readIdsRef.current);
        isMarkingRef.current = true;
        const { error } = await supabase.from("notifications").update({ is_read: true }).in("id", unreadIds);
        if (error) throw error;
      }
      const nextNotifications = notifications.map((n) => ({ ...n, is_read: true }));
      setNotifications(nextNotifications);
      setUnreadCount(0);
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    } finally {
      setTimeout(() => { isMarkingRef.current = false; }, 300);
    }
  };

  useEffect(() => {
    if (!menuOpen || unreadCount === 0) {
      return;
    }

    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => String(n.id));
    if (unreadIds.length > 0) {
      // persist the IDs locally before requesting server update
      unreadIds.forEach((id) => readIdsRef.current.add(id));
      saveLocalReadIds(readIdsRef.current);
    }

    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);

    if (unreadIds.length > 0) {
      isMarkingRef.current = true;
      supabase
        .from("notifications")
        .update({ is_read: true })
        .in("id", unreadIds)
        .then(({ error }) => {
          if (error) {
            console.error("Error marking notifications as read:", error);
          }
        })
        .finally(() => {
          setTimeout(() => { isMarkingRef.current = false; }, 300);
        });
    }
  }, [menuOpen, unreadCount, notifications]);

  // Note: we intentionally do NOT refetch on route changes to avoid
  // transient unread badge reappearance. Notifications are fetched
  // once on login (see other effect) and updated via realtime events.

  return (
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px]"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between p-2">
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead} className="h-8 text-xs">
              <Check className="h-3 w-3 mr-1" /> Mark all read
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No notifications yet
          </div>
        ) : (
          <div className="flex flex-col">
            {notifications.map((notification) => (
              <div 
                key={notification.id} 
                className={`p-3 border-b last:border-0 cursor-pointer hover:bg-muted/50 transition-colors ${!notification.is_read ? 'bg-primary/5' : ''}`}
                onClick={() => markAsRead(notification.id)}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="font-medium text-sm">{notification.title}</span>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
                    {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{notification.message}</p>
                {notification.actor_name && (
                  <p className="text-[10px] text-muted-foreground mt-1 italic">By: {notification.actor_name}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}