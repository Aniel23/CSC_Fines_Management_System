import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  CheckCircle,
  FileText,
  DollarSign,
  User as UserIcon,
  Clock,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useFines } from "@/hooks/useFines";
import { useStudentProfile } from "@/hooks/useStudentProfile";
import { Loader } from "lucide-react";

export default function StudentDashboardPage() {
  const { user, metadataLoading } = useAuth();
  const { fines, loading: finesLoading } = useFines();
  const { student: studentData, loading: profileLoading } = useStudentProfile();

  if (finesLoading || profileLoading || metadataLoading) {
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

  // If no student data found for this user
  if (!studentData) {
    return (
      <AppLayout>
        <div className="content-wrapper pt-0">
          <Card className="border-destructive/50 bg-destructive/5">
            <CardHeader>
              <CardTitle className="text-destructive">Student Profile Not Found</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-destructive/80">
                Could not find your student profile. Please contact support.
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }
  
  // fines.student_id is the UUID (foreign key to students.id)
  const studentFines = fines.filter((f) => f.student_id === studentData.id);

  // Calculate statistics
  const totalFinesCount = studentFines.length;
  const totalAmount = studentFines.reduce((sum, fine) => sum + Number(fine.amount || 0), 0);
  const totalBalance = studentFines.reduce((sum, fine) => sum + Number(fine.balance || 0), 0);
  
  // Accurate Status Filtering
  const toPayFines = studentFines.filter((f) => f.status === "To Pay" || (f.status !== "Paid" && f.status !== "Pending"));
  const pendingApprovalFines = studentFines.filter((f) => f.status === "Pending");
  const settledFines = studentFines.filter((f) => f.status === "Paid");

  const toPayAmount = toPayFines.reduce((sum, f) => sum + Number(f.balance || 0), 0);
  const pendingApprovalAmount = pendingApprovalFines.reduce((sum, f) => sum + Number(f.balance || 0), 0);
  const totalSettledAmount = settledFines.reduce((sum, f) => sum + Number(f.amount || 0), 0);
  const totalOutstandingAmount = studentFines
    .filter(f => f.status !== "Paid")
    .reduce((sum, f) => sum + Number(f.balance || 0), 0);

  return (
    <AppLayout>
      <div className="content-wrapper pt-0">
        {/* Header with Profile */}
        <div className="flex flex-col md:flex-row items-center gap-6 mb-8">
          <div className="relative group">
            <Avatar className="h-24 w-24 border-4 border-primary/20 shrink-0">
              {(user?.avatarUrl || studentData.photo_url) && (
                <AvatarImage 
                  src={user?.avatarUrl || studentData.photo_url} 
                  alt={studentData.name} 
                  className="object-cover"
                />
              )}
              <AvatarFallback className="bg-muted text-muted-foreground text-2xl font-bold">
                {studentData.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
          <div className="text-center md:text-left">
            <h1 className="font-display text-3xl font-bold text-foreground">
              Welcome, {studentData.name}
            </h1>
            <div className="flex flex-wrap justify-center md:justify-start gap-2 mt-2">
              <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">
                {studentData.student_id}
              </Badge>
              <Badge variant="outline" className="border-accent/30 text-accent">
                {studentData.department}
              </Badge>
            </div>
          </div>
        </div>

        {/* Summary Statistics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
          <Card className="card-elevated border-warning/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Payable
              </CardTitle>
              <div className="p-2 rounded-lg bg-warning/10">
                <AlertCircle className="h-5 w-5 text-warning" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">₱{toPayAmount.toLocaleString()}</div>
              <p className="text-sm text-muted-foreground mt-1">
                {toPayFines.length} violations
              </p>
            </CardContent>
          </Card>

          <Card className="card-elevated border-info/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending Approval
              </CardTitle>
              <div className="p-2 rounded-lg bg-info/10">
                <Clock className="h-5 w-5 text-info" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-info">
                ₱{pendingApprovalAmount.toLocaleString()}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {pendingApprovalFines.length} awaiting admin
              </p>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Overall Balance
              </CardTitle>
              <div className="p-2 rounded-lg bg-accent/10">
                <DollarSign className="h-5 w-5 text-accent" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ₱{totalOutstandingAmount.toLocaleString()}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Remaining balance
              </p>
            </CardContent>
          </Card>

          <Card className="card-elevated border-success/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Settled Fines
              </CardTitle>
              <div className="p-2 rounded-lg bg-success/10">
                <CheckCircle className="h-5 w-5 text-success" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">₱{totalSettledAmount.toLocaleString()}</div>
              <p className="text-sm text-muted-foreground mt-1">
                {settledFines.length} paid
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Violations & Fines Tabs */}
        <Card className="card-elevated overflow-hidden bg-card text-card-foreground shadow-sm bg-white dark:bg-card/50 dark:backdrop-blur-sm">
          <CardHeader className="border-b border-border/50">
            <CardTitle className="font-display">
              Violations & Payment Status
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 sm:p-6">
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="grid w-full grid-cols-4 rounded-none sm:rounded-md">
                <TabsTrigger value="all">All ({totalFinesCount})</TabsTrigger>
                <TabsTrigger value="to-pay">To Pay ({toPayFines.length})</TabsTrigger>
                <TabsTrigger value="pending">
                  Pending ({pendingApprovalFines.length})
                </TabsTrigger>
                <TabsTrigger value="paid">Settled ({settledFines.length})</TabsTrigger>
              </TabsList>

              {/* All Violations Tab */}
              <TabsContent value="all" className="mt-4 p-4 sm:p-0">
                {studentFines.length > 0 ? (
                  <>
                    {/* Mobile view */}
                    <div className="md:hidden space-y-4">
                      {studentFines.map((fine) => (
                        <Card key={fine.id} className="border-border/50 overflow-hidden">
                          <CardContent className="p-0">
                            <div className="p-4 space-y-3">
                              <div className="flex items-start justify-between">
                                <div>
                                  <p className="font-bold text-foreground">
                                    {fine.fine_type}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {new Date(fine.created_at).toLocaleDateString()}
                                  </p>
                                </div>
                                <Badge
                                  className={
                                    fine.status === "Paid"
                                      ? "bg-success"
                                      : fine.status === "Pending"
                                      ? "bg-info text-white"
                                      : "bg-warning text-white"
                                  }
                                >
                                  {fine.status === "Pending" ? "Pending Approval" : fine.status}
                                </Badge>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-sm pt-2">
                                <div>
                                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Amount</p>
                                  <p className="font-medium">₱{fine.amount.toFixed(2)}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Balance</p>
                                  <p className={`font-black ${fine.balance > 0 ? "text-warning" : "text-success"}`}>₱{fine.balance.toFixed(2)}</p>
                                </div>
                              </div>
                          {fine.proof_image ? (
                            <div className="mt-2 pt-2 border-t flex items-center justify-between">
                              <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Proof</span>
                              <a
                                href={fine.proof_image}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline text-xs flex items-center gap-1"
                              >
                                <FileText className="h-3 w-3" /> View
                              </a>
                            </div>
                          ) : null}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    {/* Desktop view */}
                    <div className="hidden md:block overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="table-header">
                            <TableHead>Date</TableHead>
                            <TableHead>Type of Violation</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Balance</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Proof</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {studentFines.map((fine) => (
                            <TableRow key={fine.id} className="hover:bg-muted/30">
                              <TableCell>
                                {new Date(fine.created_at).toLocaleDateString()}
                              </TableCell>
                              <TableCell className="font-medium">
                                {fine.fine_type}
                              </TableCell>
                              <TableCell>₱{fine.amount.toFixed(2)}</TableCell>
                              <TableCell className={fine.balance > 0 ? "text-warning font-bold" : "text-success font-bold"}>
                                ₱{fine.balance.toFixed(2)}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  className={
                                    fine.status === "Paid"
                                      ? "bg-success"
                                      : fine.status === "Pending"
                                      ? "bg-info text-white"
                                      : "bg-warning text-white"
                                  }
                                >
                                  {fine.status === "Pending" ? "Pending Approval" : fine.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {fine.proof_image ? (
                                  <a 
                                    href={fine.proof_image} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline text-xs flex items-center gap-1"
                                  >
                                    <FileText className="h-3 w-3" /> View
                                  </a>
                                ) : (
                                  <span className="text-muted-foreground text-xs">—</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12">
                    <CheckCircle className="h-12 w-12 text-success/20 mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      No violations on record. Keep it up!
                    </p>
                  </div>
                )}
              </TabsContent>

              {/* To Pay Tab */}
              <TabsContent value="to-pay" className="mt-4 p-4 sm:p-0">
                {toPayFines.length > 0 ? (
                  <div className="space-y-4">
                    {toPayFines.map((fine) => (
                      <div key={fine.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border-2 border-warning/20 bg-warning/5 text-card-foreground gap-4 shadow-sm bg-white dark:bg-card/50 dark:backdrop-blur-sm">
                        <div className="flex items-start gap-4">
                          <div className="h-10 w-10 rounded-full bg-warning/10 flex items-center justify-center text-warning shrink-0">
                            <AlertCircle className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-bold text-foreground">{fine.fine_type}</p>
                            <p className="text-xs text-muted-foreground">{new Date(fine.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-6 border-t sm:border-t-0 pt-3 sm:pt-0 border-warning/10">
                          <div className="text-right">
                            <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Amount Due</p>
                            <p className="text-xl font-black text-warning">₱{fine.balance.toFixed(2)}</p>
                          </div>
                          <Link to="/student-payment">
                            <Button size="sm" className="bg-warning hover:bg-warning/90 text-white font-bold h-9 shadow-lg shadow-warning/20">
                              Pay Now
                            </Button>
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <CheckCircle className="h-12 w-12 text-success/20 mx-auto mb-4" />
                    <p className="text-muted-foreground">No fines to pay at the moment.</p>
                  </div>
                )}
              </TabsContent>

              {/* Pending Violations Tab */}
              <TabsContent value="pending" className="mt-4 p-4 sm:p-0">
                {pendingApprovalFines.length > 0 ? (
                  <div className="space-y-4">
                    {pendingApprovalFines.map((fine) => (
                      <div key={fine.id} className="flex items-center justify-between p-4 rounded-xl border-2 border-info/20 bg-info/5 text-card-foreground shadow-sm bg-white dark:bg-card/50 dark:backdrop-blur-sm">
                        <div className="flex items-start gap-4">
                          <div className="h-10 w-10 rounded-full bg-info/10 flex items-center justify-center text-info shrink-0">
                            <Clock className="h-5 w-5 animate-pulse" />
                          </div>
                          <div>
                            <p className="font-bold text-foreground">{fine.fine_type}</p>
                            <p className="text-xs text-muted-foreground">Submitted on {new Date(fine.updated_at || fine.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className="text-right">
                            <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Amount Submitted</p>
                            <p className="text-xl font-black text-info">₱{(fine.pending_payment || fine.balance).toFixed(2)}</p>
                            {fine.pending_payment && fine.pending_payment < fine.balance && (
                              <p className="text-[10px] text-muted-foreground">
                                from ₱{fine.balance.toFixed(2)} balance
                              </p>
                            )}
                          </div>
                          {fine.payment_proof && (
                            <a 
                              href={fine.payment_proof} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-primary hover:underline text-xs flex items-center gap-1 font-bold"
                            >
                              <FileText className="h-3 w-3" /> View Proof
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Clock className="h-12 w-12 text-info/20 mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      No payments pending approval.
                    </p>
                  </div>
                )}
              </TabsContent>

              {/* Settled Violations Tab */}
              <TabsContent value="paid" className="mt-4 p-4 sm:p-0">
                {settledFines.length > 0 ? (
                  <div className="space-y-4">
                    {settledFines.map((fine) => (
                      <div key={fine.id} className="flex items-center justify-between p-4 rounded-xl border-2 border-success/20 bg-success/5 card-elevated">
                        <div className="flex items-start gap-4">
                          <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center text-success shrink-0">
                            <CheckCircle className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-bold text-foreground">{fine.fine_type}</p>
                            <p className="text-xs text-muted-foreground">Paid on {new Date(fine.updated_at || fine.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className="text-right">
                            <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Amount Paid</p>
                            <p className="text-xl font-black text-success">₱{fine.amount.toFixed(2)}</p>
                          </div>
                          {fine.payment_proof && (
                            <a 
                              href={fine.payment_proof} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-primary hover:underline text-xs flex items-center gap-1 font-bold"
                            >
                              <FileText className="h-3 w-3" /> View Receipt
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <AlertCircle className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      No settled fines yet.
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Action Card */}
        {toPayFines.length > 0 && (
          <Card className="card-elevated mt-8 border-warning/50 bg-warning/5 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-10 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform">
              <AlertCircle className="h-32 w-32 text-warning" />
            </div>
            <CardContent className="pt-6 relative z-10">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="flex gap-4">
                  <div className="h-12 w-12 rounded-full bg-warning/20 flex items-center justify-center shrink-0">
                    <AlertCircle className="h-6 w-6 text-warning" />
                  </div>
                  <div>
                    <p className="font-bold text-foreground text-lg leading-none">
                      Attention Required
                    </p>
                    <p className="text-sm text-muted-foreground mt-2 max-w-md">
                      You have {toPayFines.length} outstanding violation{toPayFines.length > 1 ? "s" : ""} totaling ₱{totalOutstandingAmount.toLocaleString()}. 
                      Settle your fines today to maintain your student status.
                    </p>
                  </div>
                </div>
                <Link to="/student-payment" className="w-full sm:w-auto">
                  <Button className="w-full sm:w-auto bg-warning hover:bg-warning/90 text-white font-black px-8 h-12 rounded-xl shadow-xl shadow-warning/20 transition-all hover:-translate-y-1">
                    Pay Now <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
