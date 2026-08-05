import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, FileText, AlertCircle, Loader, Clock, ArrowRight, Bell, Mail } from "lucide-react";
import { PesoSign } from "@/components/ui/peso-sign";
import { useFines } from "@/hooks/useFines";
import { useStudents } from "@/hooks/useStudents";
import { useAuth } from "@/contexts/AuthContext";
import FinesLineChart from "@/components/ui/fines-line-chart";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect, useMemo } from "react";
import { subDays, startOfDay } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  const { user, metadataLoading } = useAuth();
  const { fines, loading: finesLoading, error: finesError } = useFines();
  const { students, loading: studentsLoading, error: studentsError } = useStudents();
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [rangeDays, setRangeDays] = useState<7 | 30 | 90>(30);

  const filteredFinesByRange = useMemo(() => {
    const cutoff = startOfDay(subDays(new Date(), rangeDays - 1));
    return fines.filter((fine) => new Date(fine.created_at) >= cutoff);
  }, [fines, rangeDays]);

  const rangeSummary = useMemo(() => {
    return filteredFinesByRange.reduce(
      (summary, fine) => {
        const paid = fine.amount - fine.balance;
        summary.total += fine.amount;
        summary.paid += paid;
        summary.pending += fine.balance;
        summary.count += 1;
        return summary;
      },
      { total: 0, paid: 0, pending: 0, count: 0 }
    );
  }, [filteredFinesByRange]);

  useEffect(() => {
    const fetchUnreadMessages = async () => {
      try {
        const { count, error } = await supabase
          .from('contact_messages')
          .select('*', { count: 'exact', head: true })
          .eq('is_read', false);
        
        if (!error && count !== null) {
          setUnreadMessagesCount(count);
        }
      } catch (err) {
        console.error("Error fetching unread messages count:", err);
      }
    };

    fetchUnreadMessages();
    
    // Subscribe to changes
    const channel = supabase
      .channel('public:contact_messages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contact_messages' }, () => {
        fetchUnreadMessages();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (finesLoading || studentsLoading || metadataLoading) {
    return (
      <AppLayout>
        <div className="content-wrapper pt-0 flex items-center justify-center min-h-96">
          <div className="flex flex-col items-center gap-3">
            <Loader className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading dashboard...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (finesError || studentsError) {
    return (
      <AppLayout>
        <div className="content-wrapper pt-0">
          <Card className="border-destructive/50 bg-destructive/5">
            <CardHeader>
              <CardTitle className="text-destructive">Error Loading Data</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-destructive/80">{finesError || studentsError}</p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  // Check if data is empty
  if (students.length === 0) {
    return (
      <AppLayout>
        <div className="content-wrapper pt-0">
          <Card className="border-warning/50 bg-warning/5">
            <CardHeader>
              <CardTitle className="text-warning">No Data Available</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-warning/80">
                No student records found. Please add students to the database.
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const totalStudents = students.length;
  const totalFines = fines.length;
  const totalAmount = fines.reduce((sum, fine) => sum + fine.amount, 0);
  
  // Accurate calculations accounting for new workflow
  const pendingApprovalFines = fines.filter((f) => f.status === "Pending");
  const toPayFines = fines.filter((f) => f.status === "To Pay");
  const settledFines = fines.filter((f) => f.status === "Paid");
  
  const totalToPayAmount = toPayFines.reduce((sum, fine) => sum + fine.balance, 0);
  const totalPendingApprovalAmount = pendingApprovalFines.reduce((sum, fine) => sum + fine.balance, 0);
  const totalSettledAmount = settledFines.reduce((sum, fine) => sum + fine.amount, 0);

  // Get recent fines (last 5)
  const recentFines = [...fines]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5)
    .map(fine => {
      const student = students.find(s => s.id === fine.student_id);
      return {
        ...fine,
        studentName: student ? student.name : "Unknown Student"
      };
    });

  const statCards = [
    {
      title: "Unread Messages",
      value: unreadMessagesCount,
      icon: Bell,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
      link: "/admin-messages"
    },
    {
      title: "Total Students",
      value: totalStudents,
      icon: Users,
      color: "text-primary",
      bgColor: "bg-primary/10",
      link: "/students"
    },
    {
      title: "Total Fines",
      value: totalFines,
      icon: FileText,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      link: "/admin-fines"
    },
    {
      title: "Pending Approval",
      value: pendingApprovalFines.length,
      subValue: `₱${totalPendingApprovalAmount.toLocaleString()}`,
      icon: Clock,
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
      link: "/admin-fines?status=Pending"
    },
    {
      title: "To Pay",
      value: toPayFines.length,
      subValue: `₱${totalToPayAmount.toLocaleString()}`,
      icon: AlertCircle,
      color: "text-destructive",
      bgColor: "bg-destructive/10",
      link: "/admin-fines?status=To Pay"
    },
    {
      title: "Total Collected",
      value: `₱${totalSettledAmount.toLocaleString()}`,
      icon: PesoSign,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
      link: "/admin-transactions"
    },
  ];

  return (
    <AppLayout>
      <div className="content-wrapper">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-foreground">
            Admin Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Overview of fines, payments, and system status
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {statCards.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Link to={stat.link} key={index}>
                <Card className="card-elevated hover:bg-muted/50 transition-colors cursor-pointer h-full">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">
                          {stat.title}
                        </p>
                        <div className="flex items-baseline gap-2">
                          <h2 className="text-3xl font-bold font-display">
                            {stat.value}
                          </h2>
                        </div>
                        {stat.subValue && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {stat.subValue}
                          </p>
                        )}
                      </div>
                      <div className={`p-3 rounded-full ${stat.bgColor}`}>
                        {stat.title === "Unread Messages" && (typeof stat.value === 'number' && stat.value > 0) ? (
                          <div className="relative">
                            <Icon className={`h-6 w-6 ${stat.color}`} />
                            <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm">
                              {stat.value > 99 ? '99+' : stat.value}
                            </span>
                          </div>
                        ) : (
                          <Icon className={`h-6 w-6 ${stat.color}`} />
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Fines Line Graph */}
          <Card className="card-elevated lg:col-span-2">
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="font-display">Fines Analysis</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Showing the last {rangeDays} days of fine trends.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {[7, 30, 90].map((days) => (
                  <Button
                    key={days}
                    size="sm"
                    variant={rangeDays === days ? "secondary" : "outline"}
                    onClick={() => setRangeDays(days as 7 | 30 | 90)}
                  >
                    {days} Days
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-3 mb-4">
                <div className="rounded-lg border border-border/50 bg-muted/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Total Fine Amount</p>
                  <p className="mt-2 text-xl font-semibold">₱{rangeSummary.total.toLocaleString()}</p>
                </div>
                <div className="rounded-lg border border-border/50 bg-muted/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Paid Amount</p>
                  <p className="mt-2 text-xl font-semibold text-emerald-600">₱{rangeSummary.paid.toLocaleString()}</p>
                </div>
                <div className="rounded-lg border border-border/50 bg-muted/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Pending Amount</p>
                  <p className="mt-2 text-xl font-semibold text-rose-600">₱{rangeSummary.pending.toLocaleString()}</p>
                </div>
              </div>
              <div className="h-80">
                <FinesLineChart rangeDays={rangeDays} />
              </div>
            </CardContent>
          </Card>

          {/* Recent Fines */}
          <Card className="card-elevated">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-display">Recent Fines</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {recentFines.length > 0 ? (
                  recentFines.map((fine) => (
                    <div key={fine.id} className="flex items-start justify-between gap-2 border-b border-border/50 pb-3 last:border-0 last:pb-0">
                      <div className="space-y-1">
                        <p className="font-medium text-sm leading-none">{fine.studentName}</p>
                        <p className="text-xs text-muted-foreground">{fine.fine_type}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(fine.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-sm">₱{fine.amount.toLocaleString()}</p>
                        <Badge 
                          variant="secondary" 
                          className={`text-[10px] px-1.5 py-0 h-4 mt-1 ${
                            fine.status === "Paid" ? "bg-success/10 text-success border-success/20" : "bg-warning/10 text-warning border-warning/20"
                          }`}
                        >
                          {fine.status}
                        </Badge>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">No recent fines recorded</p>
                )}
                <a 
                  href="/manage-fines" 
                  className="flex items-center justify-center gap-1 text-xs font-medium text-primary hover:underline pt-2 w-full"
                >
                  View All Fines <ArrowRight className="h-3 w-3" />
                </a>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="font-display text-xl font-bold">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <a
                href="/students"
                className="p-4 rounded-xl border border-border hover:bg-muted/50 transition-all hover:shadow-md flex flex-col items-center sm:items-start text-center sm:text-left"
              >
                <div className="p-3 rounded-lg bg-primary/10 mb-3">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-bold text-lg">Manage Students</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Add, edit, or search students
                </p>
              </a>
              <a
                href="/manage-fines"
                className="p-4 rounded-xl border border-border hover:bg-muted/50 transition-all hover:shadow-md flex flex-col items-center sm:items-start text-center sm:text-left"
              >
                <div className="p-3 rounded-lg bg-accent/10 mb-3">
                  <FileText className="h-6 w-6 text-accent" />
                </div>
                <h3 className="font-bold text-lg">Record Fine</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Add new student fines
                </p>
              </a>
              <a
                href="/reports"
                className="p-4 rounded-xl border border-border hover:bg-muted/50 transition-all hover:shadow-md flex flex-col items-center sm:items-start text-center sm:text-left"
              >
                <div className="p-3 rounded-lg bg-success/10 mb-3">
                  <PesoSign className="h-6 w-6 text-success" />
                </div>
                <h3 className="font-bold text-lg">View Reports</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Generate and print reports
                </p>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
