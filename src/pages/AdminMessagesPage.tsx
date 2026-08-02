import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader, Mail, CheckCircle, Trash2, Clock, Search, ArrowRight, Archive, RefreshCw, Trash2 as TrashIcon, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

type ContactMessage = {
  id: string;
  name: string;
  email: string;
  message: string;
  is_read: boolean;
  created_at: string;
  is_archived?: boolean;
  deleted_at?: string | null;
};

export default function AdminMessagesPage() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const [viewFilter, setViewFilter] = useState<"active" | "archived" | "binned">("active");

  const fetchMessages = async () => {
    try {
      setLoading(true);
      
      // Debug: Check current user
      const { data: { user } } = await supabase.auth.getUser();
      console.log("Current user:", user?.id);

      let query = supabase
        .from('contact_messages')
        .select('*')
        .order('created_at', { ascending: false });

      if (viewFilter === 'active') {
        query = query.is('deleted_at', null).eq('is_archived', false);
      } else if (viewFilter === 'archived') {
        query = query.is('deleted_at', null).eq('is_archived', true);
      } else if (viewFilter === 'binned') {
        query = query.not('deleted_at', 'is', null);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Supabase error fetching messages:", JSON.stringify(error, null, 2));
        throw error;
      }
      
      console.log("Fetched messages:", data);
      setMessages(data || []);
    } catch (error: any) {
      console.error("Error fetching messages:", JSON.stringify(error, null, 2));
      toast.error("Failed to load messages: " + (error.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSelectedMessages(new Set());
    fetchMessages();
  }, [viewFilter]);

  const markAsRead = async (id: string, currentStatus: boolean) => {
    if (currentStatus) return; // Already read

    try {
      const { error } = await supabase
        .from('contact_messages')
        .update({ is_read: true })
        .eq('id', id);

      if (error) throw error;
      
      // Update local state
      setMessages(messages.map(msg => 
        msg.id === id ? { ...msg, is_read: true } : msg
      ));
      
      if (selectedMessage?.id === id) {
        setSelectedMessage({ ...selectedMessage, is_read: true });
      }
    } catch (error) {
      toast.error("Failed to update message status");
    }
  };

  const deleteMessage = async (id: string) => {
    try {
      const { error } = await supabase
        .from('contact_messages')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setMessages(messages.filter(msg => msg.id !== id));
      if (selectedMessage?.id === id) {
        setSelectedMessage(null);
      }
      setSelectedMessages(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast.success("Message deleted permanently");
    } catch (error) {
      toast.error("Failed to delete message");
    }
  };

  const binMessage = async (id: string) => {
    try {
      const { error } = await supabase
        .from('contact_messages')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      fetchMessages();
      toast.success("Message moved to bin");
    } catch (error) {
      toast.error("Failed to move message to bin");
    }
  };

  const restoreMessage = async (id: string) => {
    try {
      const { error } = await supabase
        .from('contact_messages')
        .update({ deleted_at: null })
        .eq('id', id);
      if (error) throw error;
      fetchMessages();
      toast.success("Message restored");
    } catch (error) {
      toast.error("Failed to restore message");
    }
  };

  const archiveMessage = async (id: string) => {
    try {
      const { error } = await supabase
        .from('contact_messages')
        .update({ is_archived: true })
        .eq('id', id);
      if (error) throw error;
      fetchMessages();
      toast.success("Message archived");
    } catch (error) {
      toast.error("Failed to archive message");
    }
  };

  const unarchiveMessage = async (id: string) => {
    try {
      const { error } = await supabase
        .from('contact_messages')
        .update({ is_archived: false })
        .eq('id', id);
      if (error) throw error;
      fetchMessages();
      toast.success("Message unarchived");
    } catch (error) {
      toast.error("Failed to unarchive message");
    }
  };

  const deleteSelectedMessages = async () => {
    if (selectedMessages.size === 0) return;

    if (!confirm(`Are you sure you want to delete ${selectedMessages.size} selected message(s)? This action cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('contact_messages')
        .delete()
        .in('id', Array.from(selectedMessages));

      if (error) throw error;

      setMessages(messages.filter(msg => !selectedMessages.has(msg.id)));
      setSelectedMessages(new Set());
      toast.success(`${selectedMessages.size} message(s) deleted`);
    } catch (error) {
      console.error("Error deleting messages:", error);
      toast.error("Failed to delete messages");
    }
  };

  const toggleSelectAll = () => {
    if (selectedMessages.size === filteredMessages.length && filteredMessages.length > 0) {
      setSelectedMessages(new Set());
    } else {
      setSelectedMessages(new Set(filteredMessages.map(msg => msg.id)));
    }
  };

  const toggleSelectMessage = (id: string) => {
    const newSelected = new Set(selectedMessages);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedMessages(newSelected);
  };


  const filteredMessages = messages.filter(msg => 
    msg.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    msg.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    msg.message.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <AppLayout>
        <div className="content-wrapper pt-0 flex items-center justify-center min-h-96">
          <div className="flex flex-col items-center gap-3">
            <Loader className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading messages...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="content-wrapper pt-0">
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">
              Messages
            </h1>
            <p className="text-muted-foreground mt-1">
              View inquiries from students and users
            </p>
          </div>
          
          <div className="flex gap-2">
            {selectedMessages.size > 0 && (
              <Button 
                variant="destructive" 
                size="sm"
                onClick={deleteSelectedMessages}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Selected ({selectedMessages.size})
              </Button>
            )}
            <div className="relative w-full md:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search messages..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        <Card className="card-elevated">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle>Inbox</CardTitle>
              <CardDescription>
                {filteredMessages.length} message(s) found
              </CardDescription>
            </div>
            <Tabs value={viewFilter} onValueChange={(v: any) => setViewFilter(v)} className="w-full sm:w-auto">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="active">Active</TabsTrigger>
                <TabsTrigger value="archived">Archived</TabsTrigger>
                <TabsTrigger value="binned">Bin</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            {filteredMessages.length === 0 ? (
              <div className="text-center py-12">
                <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <h3 className="text-lg font-medium">No messages found</h3>
                <p className="text-muted-foreground">
                  {searchTerm ? "Try adjusting your search terms" : "You haven't received any messages yet"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px] sm:w-[50px] px-2 sm:px-4">
                        <div className="flex items-center justify-center">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300"
                            checked={filteredMessages.length > 0 && selectedMessages.size === filteredMessages.length}
                            onChange={toggleSelectAll}
                          />
                        </div>
                      </TableHead>
                      <TableHead className="w-[30px] sm:w-[50px] px-2 sm:px-4"></TableHead>
                      <TableHead className="min-w-[120px]">From</TableHead>
                      <TableHead className="min-w-[200px] hidden sm:table-cell">Subject / Preview</TableHead>
                      <TableHead className="min-w-[100px] hidden md:table-cell">Date</TableHead>
                      <TableHead className="text-right px-2 sm:px-4">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMessages.map((msg) => (
                      <TableRow 
                        key={msg.id} 
                        className={msg.is_read ? "opacity-70" : "font-medium bg-muted/20"}
                      >
                        <TableCell className="px-2 sm:px-4">
                          <div className="flex items-center justify-center">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-gray-300"
                              checked={selectedMessages.has(msg.id)}
                              onChange={(e) => {
                                e.stopPropagation();
                                toggleSelectMessage(msg.id);
                              }}
                            />
                          </div>
                        </TableCell>
                        <TableCell className="px-2 sm:px-4">
                          {!msg.is_read && (
                            <div className="h-2.5 w-2.5 rounded-full bg-primary" title="Unread" />
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-semibold text-sm sm:text-base">{msg.name}</span>
                            <span className="text-xs text-muted-foreground truncate max-w-[120px] sm:max-w-none">{msg.email}</span>
                            {/* Show preview on mobile only */}
                            <span className="text-xs text-muted-foreground mt-1 line-clamp-1 sm:hidden">
                              {msg.message}
                            </span>
                            {/* Show date on mobile only */}
                            <span className="text-[10px] text-muted-foreground mt-1 sm:hidden">
                              {format(new Date(msg.created_at), "MMM d, yyyy")}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs truncate hidden sm:table-cell">
                          {msg.message}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span className="text-xs">
                              {format(new Date(msg.created_at), "MMM d, yyyy")}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right px-2 sm:px-4">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                className="h-8 w-8 p-0 sm:h-9 sm:w-auto sm:px-3"
                                onClick={() => {
                                  setSelectedMessage(msg);
                                  markAsRead(msg.id, msg.is_read);
                                }}
                              >
                                <span className="hidden sm:inline">View</span>
                                <span className="sm:hidden">
                                  <ArrowRight className="h-4 w-4" />
                                </span>
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-md w-[95vw] max-h-[90vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>Message Details</DialogTitle>
                                <DialogDescription>
                                  Received on {format(new Date(msg.created_at), "PPP p")}
                                </DialogDescription>
                              </DialogHeader>
                            
                            <div className="space-y-4 py-4">
                              <div className="space-y-1">
                                <label className="text-xs font-semibold text-muted-foreground uppercase">From</label>
                                <div className="flex items-center gap-2">
                                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                    {msg.name.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium">{msg.name}</p>
                                    <p className="text-xs text-muted-foreground">{msg.email}</p>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="space-y-1">
                                <label className="text-xs font-semibold text-muted-foreground uppercase">Message</label>
                                <div className="p-4 bg-muted/30 rounded-lg text-sm whitespace-pre-wrap">
                                  {msg.message}
                                </div>
                              </div>
                            </div>

                            <DialogFooter className="flex flex-wrap gap-2 sm:justify-between">
                              <div className="flex gap-2">
                                {viewFilter === 'active' && (
                                  <>
                                    <Button variant="outline" size="sm" onClick={() => archiveMessage(msg.id)}>
                                      <Archive className="h-4 w-4 mr-2" /> Archive
                                    </Button>
                                    <Button variant="destructive" size="sm" onClick={() => binMessage(msg.id)}>
                                      <TrashIcon className="h-4 w-4 mr-2" /> Bin
                                    </Button>
                                  </>
                                )}
                                {viewFilter === 'archived' && (
                                  <>
                                    <Button variant="outline" size="sm" onClick={() => unarchiveMessage(msg.id)}>
                                      <RefreshCw className="h-4 w-4 mr-2" /> Unarchive
                                    </Button>
                                    <Button variant="destructive" size="sm" onClick={() => binMessage(msg.id)}>
                                      <TrashIcon className="h-4 w-4 mr-2" /> Bin
                                    </Button>
                                  </>
                                )}
                                {viewFilter === 'binned' && (
                                  <>
                                    <Button variant="outline" size="sm" className="text-success hover:text-success" onClick={() => restoreMessage(msg.id)}>
                                      <RefreshCw className="h-4 w-4 mr-2" /> Restore
                                    </Button>
                                    <Button variant="destructive" size="sm" onClick={() => deleteMessage(msg.id)}>
                                      <Trash2 className="h-4 w-4 mr-2" /> Delete Permanently
                                    </Button>
                                  </>
                                )}
                              </div>
                              <Button
                                type="button"
                                variant="secondary"
                                onClick={() => {
                                  const to = encodeURIComponent(msg.email || "");
                                  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${to}`;
                                  window.open(gmailUrl, "_blank");
                                }}
                              >
                                <Mail className="h-4 w-4 mr-2" />
                                Reply
                              </Button>
                          </DialogFooter>
                          </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
        {/* Floating compose button (bottom-right) */}
        <div className="fixed bottom-4 right-4 z-50">
          <Button
            className="h-12 w-12 rounded-full p-0 flex items-center justify-center shadow-lg"
            onClick={() => {
              const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1`;
              window.open(gmailUrl, "_blank");
            }}
            aria-label="Compose new message"
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}

