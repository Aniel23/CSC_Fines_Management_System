import { useState, useEffect } from "react";
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

  useEffect(() => {
    if (!user) return;

    const fetchNotifications = async () => {
      let query;

      // Admins should only see notifications meant for them (e.g., new payments, voucher used)
      // Students should only see notifications meant for them (e.g., payment approved/rejected)
      
      if (user.role === "admin") {
        // Fetch notifications for admins (type: payment, voucher)
        // Ensure we fetch even if user_id is null or belongs to a student
        query = supabase
          .from("notifications")
          .select("*")
          .in("type", ["payment", "voucher"])
          .order("created_at", { ascending: false })
          .limit(20);
      } else {
        // Fetch notifications for this specific student
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
        // If table doesn't exist yet, just fail silently
        return;
      }
      
      if (data) {
        setNotifications(data);
        setUnreadCount(data.filter(n => !n.is_read).length);
      }
    };

    fetchNotifications();

    // Listen for manual update events
    const handleUpdate = () => {
      fetchNotifications();
    };
    window.addEventListener('notification-update', handleUpdate);

    // Subscribe to new notifications
    const channel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications'
        },
        (payload) => {
          // Filter manually if needed since RLS might not apply to realtime events perfectly
          const newNotif = payload.new;
          
          if (user.role === "admin") {
            // Admins should see "payment" and "voucher" types, regardless of user_id
            if (["payment", "voucher"].includes(newNotif.type)) {
              setNotifications(prev => {
                if (prev.some(n => n.id === newNotif.id)) return prev;
                return [newNotif, ...prev].slice(0, 20);
              });
              setUnreadCount(prev => prev + 1);
            }
          } else {
            // Students should only see their own notifications
            if (newNotif.user_id === user.id) {
              setNotifications(prev => {
                if (prev.some(n => n.id === newNotif.id)) return prev;
                return [newNotif, ...prev].slice(0, 20);
              });
              setUnreadCount(prev => prev + 1);
            }
          }
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener('notification-update', handleUpdate);
      supabase.removeChannel(channel);
    };
  }, [user]);

  const markAsRead = async (id: string) => {
    try {
      const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id);
      if (error) throw error;
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
      if (unreadIds.length > 0) {
        const { error } = await supabase.from("notifications").update({ is_read: true }).in("id", unreadIds);
        if (error) throw error;
      }
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    }
  };

  return (
    <DropdownMenu>
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