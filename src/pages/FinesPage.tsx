import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
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
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Search, Loader, AlertCircle } from "lucide-react";
import {
  FINE_TYPES as fineTypes,
  FINE_AMOUNTS as fineAmounts,
} from "@/lib/constants";
import type { Fine } from "@/types";
import { createFine, updateFine } from "@/integrations/supabase/queries";
import { useFines } from "@/hooks/useFines";
import { useStudents } from "@/hooks/useStudents";

const fineSchema = z.object({
  student_id: z.string().min(1, "Please select a student"),
  fine_type: z.enum([
    "Not wearing ID",
    "Late enrollment",
    "Library fine",
    "Laboratory damage",
    "Dress code violation",
    "Unauthorized absence",
    "Property damage",
    "Other",
  ]),
  notes: z.string().optional(),
});

type FineFormValues = z.infer<typeof fineSchema>;

export default function FinesPage() {
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Use hooks for data
  const {
    fines,
    loading: finesLoading,
    error: finesError,
  } = useFines();
  const {
    students: fetchedStudents = [],
    loading: studentsLoading,
    error: studentsError,
  } = useStudents();
  
  const form = useForm<FineFormValues>({
    resolver: zodResolver(fineSchema),
    defaultValues: {
      student_id: "",
      fine_type: "Not wearing ID",
      notes: "",
    },
  });

  // Show loading state
  if (finesLoading || studentsLoading) {
    return (
      <AppLayout>
        <div className="content-wrapper pt-0 flex items-center justify-center min-h-96">
          <div className="flex flex-col items-center gap-3">
            <Loader className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading fines...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Show error state
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
  if (fines.length === 0 || fetchedStudents.length === 0) {
    return (
      <AppLayout>
        <div className="content-wrapper pt-0">
          <Card className="border-warning/50 bg-warning/5">
            <CardHeader>
              <CardTitle className="text-warning">No Data Available</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-warning/80">
                No fines recorded yet. Please check back later or create a new fine.
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const finesWithStudents = fines.map((fine) => ({
    ...fine,
    student: fetchedStudents.find((s) => s.id === fine.student_id),
  }));

  const filteredFines = finesWithStudents.filter(
    (fine) =>
      fine.student?.name?.toLowerCase().includes(search.toLowerCase()) ||
      fine.student?.student_id?.toLowerCase().includes(search.toLowerCase())
  );

  const totalAmount = fines.reduce((sum, fine) => sum + fine.amount, 0);
  const totalBalance = fines.reduce((sum, fine) => sum + fine.balance, 0);

  const onSubmit = async (data: FineFormValues) => {
    const amount = fineAmounts[data.fine_type];
    try {
      const { error } = await createFine({
        student_id: data.student_id,
        fine_type: data.fine_type,
        amount,
        balance: amount,
        status: "To Pay",
        notes: data.notes || null,
      });

      if (error) throw error;
      
      toast.success("Fine recorded successfully");
      setIsDialogOpen(false);
      form.reset();
    } catch (error: any) {
      console.error("Error creating fine:", error);
      toast.error("Failed to record fine: " + error.message);
    }
  };

  const markAsPaid = async (fine: any) => {
    try {
      const paymentAmount = fine.pending_payment || fine.balance;
      const newBalance = Math.max(0, fine.balance - paymentAmount);
      const newStatus = newBalance === 0 ? "Paid" : "To Pay";

      const { error } = await updateFine(fine.id, { 
        status: newStatus as FineStatus, 
        balance: newBalance,
        pending_payment: 0,
        payment_proof: null
      });
      if (error) throw error;
      toast.success(`Payment of ₱${paymentAmount.toFixed(2)} approved.`);
    } catch (error: any) {
      console.error("Error updating fine:", error);
      toast.error("Failed to update fine: " + error.message);
    }
  };

  return (
    <AppLayout>
      <div className="content-wrapper">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">
              Student Fines
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage and track student fines
            </p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Fine
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="font-display">
                  Record New Fine
                </DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-4"
                >
                  <FormField
                    control={form.control}
                    name="student_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Student</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a student" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {fetchedStudents.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.student_id} - {s.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="fine_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type of Fine</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {fineTypes.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type} - ₱{fineAmounts[type]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Additional notes..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end gap-3 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit">
                      Record Fine
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search & Summary */}
        <Card className="card-elevated mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row justify-between gap-4">
              <div className="relative max-w-md flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by student name or ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-6 text-sm">
                <div>
                  <span className="text-muted-foreground">Total Amount:</span>
                  <span className="ml-2 font-semibold">
                    ₱{totalAmount.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Total Balance:</span>
                  <span className="ml-2 font-semibold text-warning">
                    ₱{totalBalance.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Fines Table */}
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="font-display">Fines List</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredFines.length > 0 ? (
              <>
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="table-header">
                        <TableHead>Student ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Age</TableHead>
                        <TableHead>Gender</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Type of Fine</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Balance</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredFines.map((fine) => (
                        <TableRow key={fine.id}>
                          <TableCell className="font-medium">
                            {fine.student?.student_id}
                          </TableCell>
                          <TableCell>{fine.student?.name}</TableCell>
                          <TableCell>{fine.student?.age}</TableCell>
                          <TableCell>{fine.student?.gender}</TableCell>
                          <TableCell>{fine.student?.department}</TableCell>
                          <TableCell>{fine.fine_type}</TableCell>
                          <TableCell>₱{fine.amount.toFixed(2)}</TableCell>
                          <TableCell>₱{fine.balance.toFixed(2)}</TableCell>
                          <TableCell>
                            <Badge className={
                              fine.status === "Paid" 
                                ? "status-paid" 
                                : fine.status === "Pending"
                                ? "bg-warning text-white"
                                : "status-pending"
                            }>
                              {fine.status === "Pending" ? "Pending Approval" : fine.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {fine.status === "Pending" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => markAsPaid(fine)}
                              >
                                Mark Paid
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="md:hidden space-y-3">
                  {filteredFines.map((fine) => (
                    <div key={fine.id} className="card-elevated p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">{fine.student?.student_id}</p>
                          <p className="font-medium">{fine.student?.name}</p>
                          <p className="text-sm text-muted-foreground mt-1">{fine.fine_type}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Amount</p>
                          <p className="font-medium">₱{fine.amount.toFixed(2)}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Balance</p>
                          <p className="font-medium">₱{fine.balance.toFixed(2)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={
                            fine.status === "Paid" 
                              ? "status-paid" 
                              : fine.status === "Pending"
                              ? "bg-warning text-white"
                              : "status-pending"
                          }>
                            {fine.status === "Pending" ? "Pending Approval" : fine.status}
                          </Badge>
                          {fine.status === "Pending" && (
                            <Button size="sm" variant="outline" onClick={() => markAsPaid(fine)}>
                              Mark Paid
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-10 text-muted-foreground">
                No fines recorded yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
