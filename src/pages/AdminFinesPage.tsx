import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { AlertCircle, CheckCircle, Filter, Loader, RotateCw, Search, Eye, ExternalLink, AlertTriangle, Trash2, X } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useFines } from "@/hooks/useFines";
import { useStudents } from "@/hooks/useStudents";
import { getUniqueStudentDepartments, getDepartments } from "@/integrations/supabase/queries";
import { DEFAULT_DEPARTMENTS, GENDERS as genders } from "@/lib/constants";
import type { Student, FineStatus } from "@/types";
import { updateFine, deleteFine } from "@/integrations/supabase/queries";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Archive, Trash2 as TrashIcon, RefreshCw } from "lucide-react";
import { binFine, restoreFine, archiveFine, unarchiveFine } from "@/integrations/supabase/queries";

export default function AdminFinesPage() {
  const [viewFilter, setViewFilter] = useState<"active" | "archived">("active");
  const { fines: allFines, loading: finesLoading, error: finesError, refetch } = useFines('all');
  const { students, loading: studentsLoading, error: studentsError } = useStudents();
  const [departments, setDepartments] = useState<string[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [confirmingFine, setConfirmingFine] = useState<any | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<any | null>(null);

  // Load unique departments from both students table and departments table
  useEffect(() => {
    const loadDepartments = async () => {
      try {
        // Fetch from departments table (Single Source of Truth for valid departments)
        const deptsFromTable = await getDepartments();
        const tableDeptNames = deptsFromTable.map((d: any) => d.name);
        
        // Use only departments from the database if available
        if (tableDeptNames.length > 0) {
          const validDepts = tableDeptNames.filter(Boolean).sort();
          setDepartments(validDepts);
        } else {
          // Fallback to default departments if table is empty
          setDepartments(DEFAULT_DEPARTMENTS);
        }
      } catch (error) {
        console.error("Error loading departments:", error);
        setDepartments(DEFAULT_DEPARTMENTS); // Fallback to default data only on error
      }
    };

    loadDepartments();
  }, []); // Fallback to default data

  const handleApprovePayment = async (fine: any) => {
    if (fine.status !== "Pending") return;

    try {
      setUpdatingId(fine.id);
      
      const paymentAmount = fine.pending_payment || fine.balance;
      const newBalance = Math.max(0, fine.balance - paymentAmount);
      const newStatus = newBalance === 0 ? "Paid" : "To Pay";

      // 1. Check for voucher usage in recent transaction
      try {
        const { data: transactions } = await supabase
          .from("transactions")
          .select("notes, voucher_used")
          .eq("fine_id", fine.id)
          .order("payment_date", { ascending: false })
          .limit(1);

        if (transactions && transactions.length > 0) {
          const note = transactions[0].notes || "";
          const voucherUsed = transactions[0].voucher_used;
          
          // Extract voucher code: " | Voucher: CODE (-₱50)" or from column
          const voucherMatch = note.match(/Voucher:\s*([A-Z0-9]+)/);
          const code = voucherUsed || (voucherMatch ? voucherMatch[1] : null);
          
          if (code) {
            // 2. Fetch current vouchers settings
            const { data: settingsData } = await supabase
              .from("app_settings")
              .select("value")
              .eq("key", "voucher_codes")
              .maybeSingle();
              
            if (settingsData && settingsData.value) {
              const allVouchers = JSON.parse(settingsData.value);
              const updatedVouchers = allVouchers.map((v: any) => {
                if (v.code === code) {
                  const usedBy = v.usedBy || [];
                  // Add student if not already in list
                  if (!usedBy.some((u: any) => u.studentId === fine.student_id)) {
                    return { ...v, usedBy: [...usedBy, { studentId: fine.student_id, usedAt: new Date().toISOString() }] };
                  }
                }
                return v;
              });
              
              // 3. Update settings with new usage
              await supabase
                .from("app_settings")
                .update({ value: JSON.stringify(updatedVouchers) })
                .eq("key", "voucher_codes");

              // 4. Create notification for admins about voucher usage
              // We need to find the auth.user_id from user_roles
              const { data: roleDataVoucher } = await supabase
                .from("user_roles")
                .select("user_id")
                .eq("student_id", fine.student_id)
                .single();

              const { error: voucherNotifError } = await supabase.from("notifications").insert({
                user_id: roleDataVoucher?.user_id || fine.student_id, // Fallback if no user_id found (though FK might fail)
                title: "Voucher Used",
                message: `Voucher ${code} was successfully used by student ${fine.student?.name || fine.student_id}.`,
                type: "voucher",
                actor_name: "System"
              });
              
              if (voucherNotifError) {
                  console.error("Error creating voucher notification:", voucherNotifError);
              } else {
                  console.log("Notification created successfully for voucher.");
              }
            }
          }
        }
      } catch (voucherError) {
        console.error("Error recording voucher usage:", voucherError);
        // Continue with approval even if voucher recording fails
      }

      // When approving a pending payment, deduct pending_payment from balance
      await updateFine(fine.id, { 
        status: newStatus as FineStatus,
        balance: newBalance,
        pending_payment: 0,
        payment_proof: null, // Clear proof so they can upload again for remaining balance
        payment_proofs: null
      });

      // Create notification for the student
      // We need to find the auth.user_id from user_roles
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("student_id", fine.student_id)
        .single();

      if (roleData?.user_id) {
        const { error: notifError } = await supabase.from("notifications").insert({
          user_id: roleData.user_id, // Use the correct auth user ID
          title: "Payment Approved",
          message: `Your payment of ₱${paymentAmount.toFixed(2)} for ${fine.fine_type} has been approved.`,
          type: "approval",
          actor_name: "Admin"
        });
        
        if (notifError) {
          console.error("Error creating notification:", notifError);
        } else {
            console.log("Notification created successfully for approval.");
        }
      }

      // Trigger a custom event to force the notification menu to update immediately
      window.dispatchEvent(new CustomEvent('notification-update'));

      await refetch();
      toast.success(`Payment of ₱${paymentAmount.toFixed(2)} approved.`);
      setConfirmingFine(null);
    } catch (error) {
      console.error("Error approving payment:", error);
      toast.error("Failed to approve payment");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRejectPayment = async (fine: any) => {
    if (fine.status !== "Pending") return;

    try {
      setUpdatingId(fine.id);
      
      // Revert status to "To Pay" and clear pending payment and proofs
      await updateFine(fine.id, { 
        status: "To Pay",
        pending_payment: 0,
        payment_proof: null,
        payment_proofs: null
      });
      
      // Also delete the pending transaction
      const { data: transactions } = await supabase
        .from("transactions")
        .select("id")
        .eq("fine_id", fine.id)
        .order("payment_date", { ascending: false })
        .limit(1);
        
      if (transactions && transactions.length > 0) {
        await supabase.from("transactions").delete().eq("id", transactions[0].id);
      }

      // Create notification for the student
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("student_id", fine.student_id)
        .single();

      if (roleData?.user_id) {
        const { error: notifError } = await supabase.from("notifications").insert({
          user_id: roleData.user_id, // Use the correct auth user ID
          title: "Payment Rejected",
          message: `Your payment for ${fine.fine_type} was rejected. Please check and try again.`,
          type: "validation",
          actor_name: "Admin"
        });
        
        if (notifError) {
          console.error("Error creating notification:", notifError);
        }
      }

      // Trigger a custom event to force the notification menu to update immediately
      window.dispatchEvent(new CustomEvent('notification-update'));

      await refetch();
      toast.success("Payment rejected.");
      setConfirmingFine(null);
    } catch (error) {
      console.error("Error rejecting payment:", error);
      toast.error("Failed to reject payment");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleBinFine = async (fineId: string) => {
    try {
      setDeletingId(fineId);
      await binFine(fineId);
      toast.success("Fine moved to bin");
      await refetch();
      setConfirmingDelete(null);
    } catch (error: any) {
      console.error("Error moving fine to bin:", error);
      toast.error(error.message || "Failed to move fine to bin");
    } finally {
      setDeletingId(null);
    }
  };

  const handleRestoreFine = async (fineId: string) => {
    try {
      setUpdatingId(fineId);
      await restoreFine(fineId);
      toast.success("Fine restored successfully");
      await refetch();
    } catch (error: any) {
      console.error("Error restoring fine:", error);
      toast.error("Failed to restore fine");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleArchiveFine = async (fineId: string) => {
    try {
      setUpdatingId(fineId);
      await archiveFine(fineId);
      toast.success("Fine archived");
      await refetch();
    } catch (error: any) {
      console.error("Error archiving fine:", error);
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
    } catch (error: any) {
      console.error("Error unarchiving fine:", error);
      toast.error("Failed to unarchive fine");
    } finally {
      setUpdatingId(null);
    }
  };

  const handlePermanentDelete = async (fineId: string) => {
    try {
      setDeletingId(fineId);
      await deleteFine(fineId);
      toast.success("Fine permanently deleted");
      await refetch();
      setConfirmingDelete(null);
    } catch (error: any) {
      console.error("Error deleting fine:", error);
      toast.error(error.message || "Failed to delete fine");
    } finally {
      setDeletingId(null);
    }
  };

  if (finesLoading || studentsLoading) {
    return (
      <AppLayout>
        <div className="content-wrapper pt-0 flex items-center justify-center min-h-96">
          <div className="flex flex-col items-center gap-3">
            <Loader className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading fines data...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Check if there was a serious error loading data
  if (finesError || studentsError) {
    return (
      <AppLayout>
        <div className="content-wrapper pt-0">
          <Card className="border-destructive/50 bg-destructive/5">
            <CardHeader>
              <CardTitle className="text-destructive">Error Loading Data</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-destructive/80">
                {finesError || studentsError}
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  // Filter fines for the table based on viewFilter
  const finesForTable = allFines.filter(f => {
    if (viewFilter === 'active') return !f.deleted_at && !f.is_archived;
    if (viewFilter === 'archived') return !f.deleted_at && f.is_archived;
    return false;
  });

  // Filter fines based on department and status
  let filteredFines = finesForTable.map((fine) => ({
    ...fine,
    // fines.student_id is the UUID (foreign key to students.id)
    student: students.find((s) => s.id === fine.student_id),
  }));

  if (selectedDepartment) {
    filteredFines = filteredFines.filter(
      (f) => f.student?.department === selectedDepartment
    );
  }

  if (selectedStatus) {
    filteredFines = filteredFines.filter((f) => f.status === selectedStatus);
  }

  if (searchTerm) {
    const search = searchTerm.toLowerCase();
    filteredFines = filteredFines.filter(
      (f) =>
        f.student?.name.toLowerCase().includes(search) ||
        f.student?.student_id.toLowerCase().includes(search)
    );
  }

  // Calculate statistics using all NON-BINNED fines (Active + Archived)
  const statsFines = allFines.filter(f => !f.deleted_at);

  const totalFines = statsFines.length;
  const totalAmount = statsFines.reduce((sum, f) => sum + Number(f.amount || 0), 0);
  const totalBalance = statsFines.reduce((sum, f) => sum + Number(f.balance || 0), 0);
  const totalCollected = statsFines
    .filter((f) => f.status === "Paid")
    .reduce((sum, f) => sum + Number(f.amount || 0), 0);
  const paidCount = statsFines.filter((f) => f.status === "Paid").length;
  const pendingApprovalCount = statsFines.filter((f) => f.status === "Pending").length;
  const toPayCount = statsFines.filter((f) => f.status === "To Pay").length;

  const filteredTotal = filteredFines.reduce((sum, f) => sum + Number(f.amount || 0), 0);
  const filteredBalance = filteredFines.reduce((sum, f) => sum + Number(f.balance || 0), 0);
  const filteredPending = filteredFines.filter((f) => f.status === "Pending").length;
  const filteredToPay = filteredFines.filter((f) => f.status === "To Pay" || (f.status !== "Paid" && f.status !== "Pending")).length;

  return (
    <AppLayout>
      <div className="content-wrapper pt-0">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-foreground">
            Student Fines Monitoring
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor and manage all student fines
          </p>
        </div>

        {/* Overall Statistics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
          <Card className="card-elevated">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Fines
              </CardTitle>
              <div className="p-2 rounded-lg bg-primary/10">
                <AlertCircle className="h-5 w-5 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalFines}</div>
              <p className="text-sm text-muted-foreground mt-1">
                {toPayCount} to pay, {pendingApprovalCount} pending
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
                All recorded fines
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
                Unpaid & pending balance
              </p>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Collected
              </CardTitle>
              <div className="p-2 rounded-lg bg-success/10">
                <CheckCircle className="h-5 w-5 text-success" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">₱{totalCollected.toLocaleString()}</div>
              <p className="text-sm text-muted-foreground mt-1">
                From {paidCount} settled fines
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="card-elevated mb-8">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Search Student
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search name or ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Department
                </label>
                <Select value={selectedDepartment || "all"} onValueChange={(value) => setSelectedDepartment(value === "all" ? "" : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Status
                </label>
                <Select value={selectedStatus || "all"} onValueChange={(value) => setSelectedStatus(value === "all" ? "" : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="To Pay">To Pay</SelectItem>
                    <SelectItem value="Pending">Pending Approval</SelectItem>
                    <SelectItem value="Paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {(selectedDepartment || selectedStatus) && (
              <div className="mt-4 p-3 bg-info/10 rounded-lg border border-info/20">
                <p className="text-sm text-info">
                  Showing {filteredFines.length} of {finesForTable.length} fines •
                  ₱{filteredTotal.toLocaleString()} •{" "}
                  <span className="font-medium text-warning">
                    ₱{filteredBalance.toLocaleString()} outstanding
                  </span>
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Fines Table */}
        <Card className="card-elevated">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="font-display">All Student Fines</CardTitle>
            <Tabs value={viewFilter} onValueChange={(v: any) => setViewFilter(v)} className="w-full sm:w-auto">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="active">Active</TabsTrigger>
                <TabsTrigger value="archived">Archived</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            {filteredFines.length > 0 ? (
              <>
                {/* Desktop view */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="table-header">
                        <TableHead>Student ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Type of Fine</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Balance</TableHead>
                        <TableHead>Proof</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredFines.map((fine) => (
                        <TableRow key={fine.id}>
                          <TableCell className="font-medium">
                            {fine.student?.student_id}
                          </TableCell>
                          <TableCell>{fine.student?.name}</TableCell>
                          <TableCell>{fine.student?.department}</TableCell>
                          <TableCell>{fine.fine_type}</TableCell>
                          <TableCell>₱{fine.amount.toFixed(2)}</TableCell>
                          <TableCell className="font-medium">
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
                            {fine.payment_proofs && fine.payment_proofs.length > 0 ? (
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="outline" size="sm" className="h-8 gap-1">
                                    <Eye className="h-3 w-3" />
                                    View ({fine.payment_proofs.length})
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-4xl">
                                  <DialogHeader>
                                    <DialogTitle>Proof of Payment - {fine.student?.name}</DialogTitle>
                                  </DialogHeader>
                                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto">
                                    {fine.payment_proofs.map((proof: string, idx: number) => {
                                      const isVideo = /\.(mp4|mov|webm|ogg|m4v)(\?|$)/i.test(proof);
                                      return (
                                        <div key={idx} className="flex flex-col items-center">
                                          {isVideo ? (
                                            <video src={proof} controls className="max-w-full max-h-[50vh] object-contain rounded-lg shadow-md" />
                                          ) : (
                                            <img 
                                              src={proof} 
                                              alt={`Proof ${idx + 1}`} 
                                              className="max-w-full max-h-[50vh] object-contain rounded-lg shadow-md"
                                            />
                                          )}
                                          <div className="mt-2">
                                            <Button variant="outline" size="sm" asChild>
                                              <a href={proof} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                                                <ExternalLink className="h-3 w-3" />
                                                Open Original
                                              </a>
                                            </Button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </DialogContent>
                              </Dialog>
                            ) : fine.payment_proof ? (
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="outline" size="sm" className="h-8 gap-1">
                                    <Eye className="h-3 w-3" />
                                    View
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-3xl">
                                  <DialogHeader>
                                    <DialogTitle>Proof of Payment - {fine.student?.name}</DialogTitle>
                                  </DialogHeader>
                                  <div className="mt-4 flex flex-col items-center">
                                    {(/\.(mp4|mov|webm|ogg|m4v)(\?|$)/i.test(fine.payment_proof || '') ) ? (
                                      <video src={fine.payment_proof || ''} controls className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-md" />
                                    ) : (
                                      <img 
                                        src={fine.payment_proof} 
                                        alt="Proof of payment" 
                                        className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-md"
                                      />
                                    )}
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
                          <TableCell>
                            {fine.status === "Pending" ? (
                              <button
                                onClick={() => setConfirmingFine(fine)}
                                disabled={updatingId === fine.id}
                                title="Approve Payment"
                                className="inline-flex items-center gap-2 hover:opacity-80 transition-opacity"
                              >
                                <Badge className="bg-warning text-white cursor-pointer">
                                  Pending Approval
                                </Badge>
                                {updatingId === fine.id && (
                                  <RotateCw className="h-4 w-4 animate-spin text-muted-foreground" />
                                )}
                              </button>
                            ) : (
                              <Badge
                                className={
                                  fine.status === "Paid"
                                    ? "bg-success"
                                    : fine.status === "To Pay"
                                    ? "bg-warning text-white"
                                    : "bg-muted text-muted-foreground"
                                }
                              >
                                {fine.status}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {new Date(fine.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {fine.status === "Pending" ? (
                                <>
                                  <Button
                                    variant="default"
                                    size="sm"
                                    className="h-8 bg-green-600 hover:bg-green-700 text-white"
                                    onClick={() => setConfirmingFine(fine)}
                                    disabled={updatingId === fine.id}
                                  >
                                    {updatingId === fine.id ? (
                                      <Loader className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <CheckCircle className="h-3 w-3 mr-1" />
                                    )}
                                    Confirm
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    className="h-8"
                                    onClick={() => handleRejectPayment(fine)}
                                    disabled={updatingId === fine.id}
                                  >
                                    <X className="h-3 w-3 mr-1" />
                                    Reject
                                  </Button>
                                </>
                              ) : (
                                <>
                                  {viewFilter === "active" ? (
                                    <>
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                                        onClick={() => handleArchiveFine(fine.id)}
                                        disabled={updatingId === fine.id}
                                        title="Archive"
                                      >
                                        <Archive className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8 text-destructive hover:text-destructive"
                                        onClick={() => handleBinFine(fine.id)}
                                        disabled={deletingId === fine.id}
                                        title="Move to Bin"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </>
                                  ) : (
                                    <>
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                                        onClick={() => handleUnarchiveFine(fine.id)}
                                        disabled={updatingId === fine.id}
                                        title="Unarchive"
                                      >
                                        <RefreshCw className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8 text-destructive hover:text-destructive"
                                        onClick={() => setConfirmingDelete(fine)}
                                        disabled={deletingId === fine.id}
                                        title="Delete Permanently"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </>
                                  )}
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile view */}
                <div className="md:hidden space-y-4">
                  {filteredFines.map((fine) => (
                    <Card key={fine.id} className="border">
                      <CardContent className="pt-6">
                        <div className="space-y-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-sm text-muted-foreground">
                                {fine.student?.student_id}
                              </p>
                              <p className="font-medium">{fine.student?.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {fine.student?.department}
                              </p>
                            </div>
                            {fine.status === "Pending" ? (
                              <button
                                onClick={() => setConfirmingFine(fine)}
                                disabled={updatingId === fine.id}
                                title="Approve Payment"
                                className="inline-flex items-center gap-2 hover:opacity-80 transition-opacity"
                              >
                                <Badge className="bg-warning text-white cursor-pointer">
                                  Pending Approval
                                </Badge>
                                {updatingId === fine.id && (
                                  <RotateCw className="h-4 w-4 animate-spin text-muted-foreground" />
                                )}
                              </button>
                            ) : (
                              <Badge
                                className={
                                  fine.status === "Paid"
                                    ? "bg-success"
                                    : fine.status === "To Pay"
                                    ? "bg-warning text-white"
                                    : "bg-muted text-muted-foreground"
                                }
                              >
                                {fine.status}
                              </Badge>
                            )}
                          </div>

                          <div>
                            <p className="font-medium">{fine.fine_type}</p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(fine.created_at).toLocaleDateString()}
                            </p>
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

                          {fine.payment_proof && (
                            <div className="pt-2 border-t border-dashed">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="outline" size="sm" className="w-full gap-2">
                                    <Eye className="h-4 w-4" />
                                    View Proof of Payment
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-[95vw] sm:max-w-lg">
                                  <DialogHeader>
                                    <DialogTitle className="text-sm">Proof of Payment - {fine.student?.name}</DialogTitle>
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

                          <div className="pt-3 border-t flex flex-wrap gap-2">
                            {viewFilter === 'active' && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleArchiveFine(fine.id)}
                                  disabled={updatingId === fine.id}
                                  className="flex-1 gap-2"
                                >
                                  <Archive className="h-4 w-4" />
                                  Archive
                                </Button>
                              </>
                            )}
                            {viewFilter === 'archived' && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleUnarchiveFine(fine.id)}
                                  disabled={updatingId === fine.id}
                                  className="flex-1 gap-2"
                                >
                                  <RefreshCw className="h-4 w-4" />
                                  Unarchive
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <CheckCircle className="h-12 w-12 text-success/50 mx-auto mb-4" />
                <p className="text-muted-foreground">
                  No fines matching the selected filters.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Approval Confirmation Dialog */}
        <AlertDialog open={!!confirmingFine} onOpenChange={(open) => !open && setConfirmingFine(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                Confirm Payment Approval
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                {confirmingFine && (
                  <div className="mt-4 space-y-4 text-sm text-muted-foreground">
                    <p>Are you sure you want to approve this payment? This action will deduct the payment amount from the balance.</p>
                    
                    <div className="p-4 bg-muted/50 rounded-lg space-y-2 border">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Student:</span>
                        <span className="font-bold">{confirmingFine.student?.name}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Violation:</span>
                        <span className="font-bold">{confirmingFine.fine_type}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Current Balance:</span>
                        <span className="font-bold">₱{confirmingFine.balance.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm border-t pt-2 mt-2">
                        <span className="text-muted-foreground font-bold">Payment Amount:</span>
                        <span className="font-bold text-lg text-primary">₱{(confirmingFine.pending_payment || confirmingFine.balance).toFixed(2)}</span>
                      </div>
                    </div>
                    
                    <p className="text-xs text-muted-foreground italic">
                      Please ensure you have verified the uploaded proof of payment before proceeding.
                    </p>
                  </div>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={updatingId !== null}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={updatingId !== null}
                onClick={async (e) => {
                  e.preventDefault();
                  if (confirmingFine) {
                    await handleApprovePayment(confirmingFine);
                  }
                }}
                className="bg-success hover:bg-success/90 text-white"
              >
                {updatingId ? (
                  <>
                    <RotateCw className="mr-2 h-4 w-4 animate-spin" />
                    Approving...
                  </>
                ) : (
                  "Confirm Approval"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!confirmingDelete} onOpenChange={(open) => !open && setConfirmingDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Delete Fine Permanently
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                {confirmingDelete && (
                  <div className="mt-4 space-y-4 text-sm text-muted-foreground">
                    <p className="text-destructive font-semibold">Are you sure you want to permanently delete this fine?</p>
                    <p>This action cannot be undone. This will permanently delete the fine record from the database.</p>
                    
                    <div className="p-4 bg-muted/50 rounded-lg space-y-2 border">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Student:</span>
                        <span className="font-bold">{confirmingDelete.student?.name}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Violation:</span>
                        <span className="font-bold">{confirmingDelete.fine_type}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Amount:</span>
                        <span className="font-bold text-primary">₱{confirmingDelete.amount.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deletingId !== null}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={deletingId !== null}
                onClick={async (e) => {
                  e.preventDefault();
                  if (confirmingDelete) {
                    await handlePermanentDelete(confirmingDelete.id);
                  }
                }}
                className="bg-destructive hover:bg-destructive/90 text-white"
              >
                {deletingId ? (
                  <>
                    <RotateCw className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete Permanently"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
