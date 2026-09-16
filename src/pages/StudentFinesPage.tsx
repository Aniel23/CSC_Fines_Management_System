import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,} from "@/components/ui/table";
import { AlertCircle, CheckCircle, FileText, Loader, Eye, ExternalLink } from "lucide-react";
import { useFines } from "@/hooks/useFines";
import { useStudents } from "@/hooks/useStudents";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Archive, Trash2 as TrashIcon, RefreshCw } from "lucide-react";
import { archiveFine, unarchiveFine, binFine, restoreFine, deleteFine } from "@/integrations/supabase/queries";
import { toast } from "sonner";
import { usePagination } from "@/hooks/usePagination";
import { PaginationBar } from "@/components/shared/PaginationBar";

export default function StudentFinesPage() {
  const { user } = useAuth();
  const [viewFilter, setViewFilter] = useState<"active" | "archived" | "binned">("active");
  const { fines, loading: finesLoading, error: finesError, refetch } = useFines(viewFilter);
  const { students: mockStudents, loading: studentsLoading } = useStudents();
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const handleArchiveFine = async (fineId: string) => {
    try {
      setUpdatingId(fineId);
      await archiveFine(fineId);
      toast.success("Fine archived");
      await refetch();
    } catch (error) {
      toast.error("Failed to archive fine");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleUnarchiveFine = async (fineId: string) => {
    try {
      setUpdatingId(fineId);
      await unarchiveFine(fineId);
      toast.success("Fine unarchived");
      await refetch();
    } catch (error) {
      toast.error("Failed to unarchive fine");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleBinFine = async (fineId: string) => {
    try {
      setUpdatingId(fineId);
      await binFine(fineId);
      toast.success("Fine moved to bin");
      await refetch();
    } catch (error) {
      toast.error("Failed to move fine to bin");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRestoreFine = async (fineId: string) => {
    try {
      setUpdatingId(fineId);
      await restoreFine(fineId);
      toast.success("Fine restored");
      await refetch();
    } catch (error) {
      toast.error("Failed to restore fine");
    } finally {
      setUpdatingId(null);
    }
  };

  const handlePermanentDelete = async (fineId: string) => {
    try {
      setUpdatingId(fineId);
      await deleteFine(fineId);
      toast.success("Fine deleted permanently");
      await refetch();
    } catch (error) {
      toast.error("Failed to delete fine");
    } finally {
      setUpdatingId(null);
    }
  };

  // Get current student data by matching user.studentId with student.id
  const currentStudent = mockStudents.find((s) => s.id === user?.studentId) || mockStudents.find((s) => s.student_id === user?.studentId);
  
  // fines.student_id is the UUID (foreign key to students.id)
  const studentFines = currentStudent
    ? fines.filter((f) => f.student_id === currentStudent.id)
    : [];

  // Calculate statistics
  const totalFinesCount = studentFines.length;
  const totalAmount = studentFines.reduce((sum, fine) => sum + Number(fine.amount || 0), 0);
  const totalBalance = studentFines.reduce((sum, fine) => sum + Number(fine.balance || 0), 0);
  const paidCount = studentFines.filter((f) => f.status === "Paid").length;
  const pendingCount = studentFines.filter((f) => f.status === "Pending").length;

  const { paged: pagedFines, currentPage, setCurrentPage, totalPages, pageSize } = usePagination(studentFines);

  if (finesLoading || studentsLoading) {
    return (
      <AppLayout>
        <div className="content-wrapper pt-0 flex items-center justify-center min-h-96">
          <div className="flex flex-col items-center gap-3">
            <Loader className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading your fines...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (finesError) {
    return (
      <AppLayout>
        <div className="content-wrapper pt-0">
          <Card className="border-destructive/50 bg-destructive/5">
            <CardHeader>
              <CardTitle className="text-destructive">Error Loading Data</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-destructive/80">{finesError}</p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (mockStudents.length === 0) {
    return (
      <AppLayout>
        <div className="content-wrapper pt-0">
          <Card className="border-warning/50 bg-warning/5">
            <CardHeader>
              <CardTitle className="text-warning">No Student Data Available</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-warning/80">
                No student records found in the database. Please contact support.
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (!currentStudent) {
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

  return (
    <AppLayout>
      <div className="content-wrapper pt-0">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-foreground">
            My Fines
          </h1>
          <p className="text-muted-foreground mt-1">
            View and manage your violations and fines
          </p>
        </div>

        {/* Personal Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="card-elevated">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Violations
              </CardTitle>
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalFinesCount}</div>
              <p className="text-sm text-muted-foreground mt-1">
                {pendingCount} pending
              </p>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Amount
              </CardTitle>
              <div className="p-2 rounded-lg bg-accent/10">
                <AlertCircle className="h-5 w-5 text-accent" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ₱{totalAmount.toLocaleString()}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Total fines charged
              </p>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Overall Balance
              </CardTitle>
              <div className="p-2 rounded-lg bg-warning/10">
                <AlertCircle className="h-5 w-5 text-warning" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">
                ₱{totalBalance.toLocaleString()}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Balance due
              </p>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Settled
              </CardTitle>
              <div className="p-2 rounded-lg bg-success/10">
                <CheckCircle className="h-5 w-5 text-success" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{paidCount}</div>
              <p className="text-sm text-muted-foreground mt-1">
                Paid fines
              </p>
            </CardContent>
          </Card>
        </div>

        {/* All Fines */}
        <Card className="card-elevated mb-8">
          <CardHeader>
            <CardTitle className="font-display">All Your Fines</CardTitle>
          </CardHeader>
          <CardContent>
            {studentFines.length > 0 ? (
              <>
                {/* Desktop view */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="table-header">
                        <TableHead className="w-[50px]">#</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Type of Violation</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Balance</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Proof</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagedFines.map((fine, index) => (
                        <TableRow key={fine.id}>
                          <TableCell className="font-medium text-muted-foreground">{(currentPage - 1) * pageSize + index + 1}</TableCell>
                          <TableCell>
                            {new Date(fine.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="font-medium">
                            {fine.fine_type}
                          </TableCell>
                          <TableCell>₱{fine.amount.toFixed(2)}</TableCell>
                          <TableCell>
                            {fine.status === 'Pending' && fine.pending_payment ? (
                              <div className="flex flex-col">
                                <span>₱{fine.balance.toFixed(2)}</span>
                                <span className="text-[10px] text-warning">
                                  Paying: ₱{fine.pending_payment.toFixed(2)}
                                </span>
                              </div>
                            ) : (
                              `₱${fine.balance.toFixed(2)}`
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={
                                fine.status === "Paid"
                                  ? "bg-success"
                                  : "bg-warning text-white"
                              }
                            >
                              {fine.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {fine.payment_proof ? (
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="outline" size="sm" className="h-8 gap-1">
                                    <Eye className="h-3 w-3" />
                                    View
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-3xl">
                                  <DialogHeader>
                                    <DialogTitle>Your Proof of Payment</DialogTitle>
                                  </DialogHeader>
                                  <div className="mt-4 flex flex-col items-center">
                                    <img 
                                      src={fine.payment_proof} 
                                      alt="Proof of payment" 
                                      className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-md"
                                    />
                                    <div className="mt-4 flex gap-3">
                                      <Button variant="outline" asChild>
                                        <a href={fine.payment_proof} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                                          <ExternalLink className="h-4 w-4" />
                                          Open Original
                                        </a>
                                      </Button>
                                    </div>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            ) : (
                              <span className="text-muted-foreground text-xs italic">No proof</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {fine.notes || "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile view */}
                <div className="md:hidden space-y-4">
                  {pagedFines.map((fine) => (
                    <Card key={fine.id} className="border">
                      <CardContent className="pt-6">
                        <div className="space-y-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-sm text-muted-foreground">
                                {new Date(fine.created_at).toLocaleDateString()}
                              </p>
                              <p className="font-medium">{fine.fine_type}</p>
                            </div>
                            <Badge
                              className={
                                fine.status === "Paid"
                                  ? "bg-success"
                                  : "bg-warning text-white"
                              }
                            >
                              {fine.status}
                            </Badge>
                          </div>

                          <div className="flex justify-between text-sm">
                            <div>
                              <p className="text-muted-foreground">Amount</p>
                              <p className="font-medium">
                                ₱{fine.amount.toFixed(2)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-muted-foreground">Balance</p>
                              <div className="flex flex-col items-end">
                                <p className="font-medium">₱{fine.balance.toFixed(2)}</p>
                                {fine.status === 'Pending' && fine.pending_payment && (
                                  <p className="text-[10px] text-warning">
                                    Paying: ₱{fine.pending_payment.toFixed(2)}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>

                          {fine.notes && (
                            <div className="text-sm bg-muted p-2 rounded">
                              <p className="text-muted-foreground">
                                <span className="font-medium">Notes:</span>{" "}
                                {fine.notes}
                              </p>
                            </div>
                          )}

                          {fine.payment_proof && (
                            <div className="pt-2 border-t border-dashed">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="outline" size="sm" className="w-full gap-2">
                                    <Eye className="h-4 w-4" />
                                    View Uploaded Proof
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-[95vw] sm:max-w-lg">
                                  <DialogHeader>
                                    <DialogTitle className="text-sm">Your Proof of Payment</DialogTitle>
                                  </DialogHeader>
                                  <div className="mt-2">
                                    <img 
                                      src={fine.payment_proof} 
                                      alt="Proof of payment" 
                                      className="w-full object-contain rounded-lg border shadow-sm"
                                    />
                                    <div className="mt-4">
                                      <Button variant="outline" className="w-full" asChild>
                                        <a href={fine.payment_proof} target="_blank" rel="noopener noreferrer">
                                          Open Full Image
                                        </a>
                                      </Button>
                                    </div>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <PaginationBar
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={studentFines.length}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                />
              </>
            ) : (
              <div className="text-center py-12">
                <CheckCircle className="h-12 w-12 text-success/50 mx-auto mb-4" />
                <p className="text-muted-foreground">
                  No violations on record. Keep it up!
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Fines Alert */}
        {pendingCount > 0 && (
          <Card className="card-elevated border-warning/50 bg-warning/5">
            <CardContent className="pt-6">
              <div className="flex gap-4">
                <AlertCircle className="h-6 w-6 text-warning flex-shrink-0 mt-1" />
                <div>
                  <p className="font-medium text-foreground">
                    You have {pendingCount} pending violation{pendingCount > 1 ? "s" : ""}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Please settle your outstanding fines of ₱
                    {totalBalance.toLocaleString()} as soon as possible. Contact
                    the CSC office if you need payment arrangements.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
