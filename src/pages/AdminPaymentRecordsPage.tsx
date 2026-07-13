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
import { CreditCard, Filter, TrendingUp, Loader, AlertCircle, Search, Ticket } from "lucide-react";
import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { useStudents } from "@/hooks/useStudents";
import { supabase } from "@/integrations/supabase/client";

interface PaymentRecord {
  id: string;
  studentId: string;
  studentName: string;
  amount: number;
  originalAmount: number;
  voucherUsed: string | null;
  paymentMethod: "Online" | "Over-the-Counter";
  paymentDate: string;
  referenceNumber: string;
  notes: string | null;
}

export default function AdminPaymentRecordsPage() {
  const { students: studentsData, loading: studentsLoading, error: studentsError } = useStudents();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        setTransactionsLoading(true);
        const { data, error } = await supabase
          .from("transactions")
          .select("*, fines(student_id)")
          .order("payment_date", { ascending: false });
          
        if (error) throw error;
        setTransactions(data || []);
      } catch (err) {
        console.error("Error fetching transactions:", err);
      } finally {
        setTransactionsLoading(false);
      }
    };
    
    fetchTransactions();
  }, []);

  if (transactionsLoading || studentsLoading) {
    return (
      <AppLayout>
        <div className="content-wrapper pt-0 flex items-center justify-center min-h-96">
          <div className="flex flex-col items-center gap-3">
            <Loader className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading payment records...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (studentsError) {
    return (
      <AppLayout>
        <div className="content-wrapper pt-0">
          <Card className="border-destructive/50 bg-destructive/5">
            <CardHeader>
              <CardTitle className="text-destructive">Error Loading Data</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-destructive/80">{studentsError}</p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (studentsData.length === 0 || transactions.length === 0) {
    return (
      <AppLayout>
        <div className="content-wrapper pt-0">
          <Card className="border-warning/50 bg-warning/5">
            <CardHeader>
              <CardTitle className="text-warning">No Data Available</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-warning/80">
                No payment records available. Please check back later.
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  // Create payment records from transactions data
  const paymentRecords: PaymentRecord[] = transactions.map((tx) => {
    const studentId = tx.fines?.student_id;
    const student = studentsData.find((s) => s.id === studentId);
    
    // Extract voucher info from notes if not in column
    let voucherUsed = tx.voucher_used;
    let originalAmount = tx.original_amount || tx.amount_paid;
    
    if (!voucherUsed && tx.notes) {
      const voucherMatch = tx.notes.match(/Voucher:\s*([A-Z0-9]+)/);
      if (voucherMatch) voucherUsed = voucherMatch[1];
    }
    
    return {
      id: tx.id,
      studentId: student?.student_id || "N/A",
      studentName: student?.name || "Unknown",
      amount: tx.amount_paid,
      originalAmount: originalAmount,
      voucherUsed: voucherUsed,
      paymentMethod: tx.notes?.includes("CSC-Slip") ? "Online" : "Over-the-Counter",
      paymentDate: tx.payment_date,
      referenceNumber: `REF-${tx.id.substring(0, 8).toUpperCase()}`,
      notes: tx.notes
    };
  });

  const filteredRecords = paymentRecords.filter((record) => {
    const matchesSearch =
      record.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.studentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.referenceNumber.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesMethod = selectedPaymentMethod
      ? record.paymentMethod === selectedPaymentMethod
      : true;

    const matchesMonth = selectedMonth
      ? new Date(record.paymentDate).toLocaleDateString("en-US", {
          month: "2-digit",
          year: "numeric",
        }) === selectedMonth
      : true;

    return matchesSearch && matchesMethod && matchesMonth;
  });

  // Calculate statistics
  const totalPayments = paymentRecords.length;
  const totalAmount = paymentRecords.reduce((sum, r) => sum + r.amount, 0);
  const onlinePayments = paymentRecords.filter(
    (r) => r.paymentMethod === "Online"
  ).length;
  const counterPayments = paymentRecords.filter(
    (r) => r.paymentMethod === "Over-the-Counter"
  ).length;

  const filteredTotal = filteredRecords.reduce((sum, r) => sum + r.amount, 0);

  // Get available months
  const months = Array.from(
    new Set(
      paymentRecords.map((r) =>
        new Date(r.paymentDate).toLocaleDateString("en-US", {
          month: "2-digit",
          year: "numeric",
        })
      )
    )
  ).sort();

  return (
    <AppLayout>
      <div className="content-wrapper pt-0">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-foreground">
            Payment Records
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor student fine payments
          </p>
        </div>

        {/* Summary Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="card-elevated">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Payments
              </CardTitle>
              <CreditCard className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalPayments}</div>
              <p className="text-sm text-muted-foreground mt-1">
                payments recorded
              </p>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Collected
              </CardTitle>
              <TrendingUp className="h-5 w-5 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">
                ₱{totalAmount.toLocaleString()}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Total amount collected
              </p>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Online Payments
              </CardTitle>
              <Badge className="bg-info">{onlinePayments}</Badge>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                GCash, Maya, Bank Transfer
              </p>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Counter Payments
              </CardTitle>
              <Badge className="bg-warning">{counterPayments}</Badge>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                CSC office direct payments
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
                  Payment Method
                </label>
                <Select
                  value={selectedPaymentMethod || "all"}
                  onValueChange={(value) => setSelectedPaymentMethod(value === "all" ? "" : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Methods" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Methods</SelectItem>
                    <SelectItem value="Online">Online</SelectItem>
                    <SelectItem value="Over-the-Counter">
                      Over-the-Counter
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Month
                </label>
                <Select value={selectedMonth || "all"} onValueChange={(value) => setSelectedMonth(value === "all" ? "" : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Months" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Months</SelectItem>
                    {months.map((month) => (
                      <SelectItem key={month} value={month}>
                        {new Date(`${month}/01`).toLocaleDateString("en-US", {
                          month: "long",
                          year: "numeric",
                        })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {(selectedPaymentMethod || selectedMonth) && (
              <div className="mt-4 p-3 bg-info/10 rounded-lg border border-info/20">
                <p className="text-sm text-info">
                  Showing {filteredRecords.length} of {mockPaymentRecords.length}{" "}
                  payments • ₱{filteredTotal.toLocaleString()} collected
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Records Table */}
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="font-display">Payment Records</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredRecords.length > 0 ? (
              <>
                {/* Desktop view */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="table-header">
                        <TableHead>Student ID</TableHead>
                        <TableHead>Student Name</TableHead>
                        <TableHead>Original Amount</TableHead>
                        <TableHead>Voucher</TableHead>
                        <TableHead>Final Amount</TableHead>
                        <TableHead>Payment Method</TableHead>
                        <TableHead>Reference Number</TableHead>
                        <TableHead>Payment Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRecords.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell className="font-medium">
                            {record.studentId}
                          </TableCell>
                          <TableCell>{record.studentName}</TableCell>
                          <TableCell className="text-muted-foreground">
                            ₱{record.originalAmount.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            {record.voucherUsed ? (
                              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 gap-1">
                                <Ticket className="h-3 w-3" />
                                {record.voucherUsed}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">-</span>
                            )}
                          </TableCell>
                          <TableCell className="font-semibold text-success">
                            ₱{record.amount.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={
                                record.paymentMethod === "Online"
                                  ? "bg-info"
                                  : "bg-warning"
                              }
                            >
                              {record.paymentMethod}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {record.referenceNumber}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(record.paymentDate).toLocaleDateString()} (
                            {formatDistanceToNow(
                              new Date(record.paymentDate),
                              { addSuffix: true }
                            )}
                            )
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile view */}
                <div className="md:hidden space-y-4">
                  {filteredRecords.map((record) => (
                    <Card key={record.id} className="border">
                      <CardContent className="pt-6">
                        <div className="space-y-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-sm text-muted-foreground">
                                {record.studentId}
                              </p>
                              <p className="font-medium">
                                {record.studentName}
                              </p>
                            </div>
                            <Badge
                              className={
                                record.paymentMethod === "Online"
                                  ? "bg-info"
                                  : "bg-warning"
                              }
                            >
                              {record.paymentMethod}
                            </Badge>
                          </div>

                          <div className="flex justify-between text-sm">
                            <div>
                              <p className="text-muted-foreground">Original</p>
                              <p className="font-medium">
                                ₱{record.originalAmount.toFixed(2)}
                              </p>
                            </div>
                            <div className="text-center">
                              <p className="text-muted-foreground">Voucher</p>
                              {record.voucherUsed ? (
                                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[10px] h-5">
                                  {record.voucherUsed}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-muted-foreground">Final Paid</p>
                              <p className="font-semibold text-success">
                                ₱{record.amount.toFixed(2)}
                              </p>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-border">
                            <p className="text-xs text-muted-foreground mb-1">
                              Reference: {record.referenceNumber}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(record.paymentDate).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <CreditCard className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground">
                  No payment records matching the selected filters.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
