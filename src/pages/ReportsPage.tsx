import { useRef, useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Printer, FileText, Loader, Filter, TrendingUp, Calendar as CalendarIcon } from "lucide-react";
import { useFines } from "@/hooks/useFines";
import { useStudents } from "@/hooks/useStudents";
import { useAuth } from "@/contexts/AuthContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { startOfWeek, startOfMonth, startOfYear, isAfter, isBefore, endOfDay, format, startOfDay } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export default function ReportsPage() {
  const { user } = useAuth();
  const { fines, loading: finesLoading, error: finesError } = useFines();
  const { students: mockStudents, loading: studentsLoading, error: studentsError } = useStudents();
  const reportRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const incomeRef = useRef<HTMLDivElement>(null);

  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedStudentId, setSelectedStudentId] = useState<string>("all");
  const [monthlyIncome, setMonthlyIncome] = useState<Record<string, number>>({});
  const [incomeLoading, setIncomeLoading] = useState(false);

  useEffect(() => {
    if (user?.role !== "admin") return;

    const fetchIncome = async () => {
      setIncomeLoading(true);
      try {
        const { data, error } = await supabase
          .from("transactions")
          .select("amount_paid, payment_date");
        
        if (error) throw error;

        const income: Record<string, number> = {};
        data?.forEach(tx => {
          const month = format(new Date(tx.payment_date), "MMMM yyyy");
          income[month] = (income[month] || 0) + tx.amount_paid;
        });
        
        setMonthlyIncome(income);
      } catch (err) {
        console.error("Error fetching income:", err);
      } finally {
        setIncomeLoading(false);
      }
    };

    fetchIncome();
  }, [user]);

  if (finesLoading || studentsLoading) {
    return (
      <AppLayout>
        <div className="content-wrapper pt-0 flex items-center justify-center min-h-96">
          <div className="flex flex-col items-center gap-3">
            <Loader className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading reports...</p>
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

  const isStudentView = user?.role === "student";
  // Find the student record for this user by matching user.studentId with student.id
  const currentStudent = isStudentView 
    ? (mockStudents.find((s) => s.id === user?.studentId) || mockStudents.find((s) => s.student_id === user?.studentId))
    : null;

  // fines.student_id is the UUID (foreign key to students.id)
  let finesWithStudents = fines.map((fine) => ({
    ...fine,
    student: mockStudents.find((s) => s.id === fine.student_id),
  }));

  // Filter for student view or admin student filter
  if (isStudentView && currentStudent) {
    finesWithStudents = finesWithStudents.filter(
      (f) => f.student_id === currentStudent.id
    );
  } else if (!isStudentView && selectedStudentId !== "all") {
    finesWithStudents = finesWithStudents.filter(
      (f) => f.student_id === selectedStudentId
    );
  }

  // Apply date range filter
  if (startDate) {
    const start = startOfDay(startDate);
    finesWithStudents = finesWithStudents.filter(f => 
      isAfter(new Date(f.created_at), start) || format(new Date(f.created_at), 'yyyy-MM-dd') === format(startDate, 'yyyy-MM-dd')
    );
  }

  if (endDate) {
    const end = endOfDay(endDate);
    finesWithStudents = finesWithStudents.filter(f => 
      isBefore(new Date(f.created_at), end) || format(new Date(f.created_at), 'yyyy-MM-dd') === format(endDate, 'yyyy-MM-dd')
    );
  }

  // Apply status filter
  if (statusFilter !== "all") {
    if (statusFilter === "Unpaid") {
      finesWithStudents = finesWithStudents.filter(f => f.status === "To Pay" || f.status === "Pending");
    } else {
      finesWithStudents = finesWithStudents.filter(f => f.status === statusFilter);
    }
  }

  // Calculate summary
  const studentFinesMap: Record<string, { total: number; balance: number; count: number }> = {};
  
  (isStudentView && currentStudent ? [currentStudent] : mockStudents).forEach((student) => {
    const studentFinesList = finesWithStudents.filter((f) => f.student_id === student.id);
    if (studentFinesList.length > 0) {
      studentFinesMap[student.id] = {
        total: studentFinesList.reduce((sum, f) => sum + f.amount, 0),
        balance: studentFinesList.reduce((sum, f) => sum + f.balance, 0),
        count: studentFinesList.length,
      };
    }
  });

  const studentsWithFinesSummary = (
    isStudentView && currentStudent ? [currentStudent] : mockStudents
  ).filter((s) => studentFinesMap[s.id]);

  const totalFines = finesWithStudents.length;
  const totalAmount = finesWithStudents.reduce((sum, f) => sum + f.amount, 0);
  const totalBalance = finesWithStudents.reduce((sum, f) => sum + f.balance, 0);
  const paidCount = finesWithStudents.filter((f) => f.status === "Paid").length;
  const pendingCount = finesWithStudents.filter((f) => f.status === "Pending").length;

  const handlePrint = (ref: React.RefObject<HTMLDivElement>, title: string) => {
    if (!ref.current) return;

    const printContent = ref.current.innerHTML;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const reportTitle = isStudentView ? `${title} - ${currentStudent?.name}` : title;

    printWindow.document.write(`
      <html>
        <head>
          <title>${reportTitle}</title>
          <style>
            body { font-family: 'Times New Roman', serif; padding: 40px; color: #000; }
            .print-header { margin-bottom: 20px; border-bottom: 1px solid #000; padding-bottom: 10px; }
            .print-header h1 { margin: 0; font-size: 18pt; font-weight: bold; text-align: center; color: #000; }
            .print-header h2 { margin: 5px 0; font-size: 14pt; font-weight: normal; text-align: center; color: #000; }
            .print-date { color: #000; font-size: 10pt; margin-top: 10px; text-align: right; }
            
            /* Hide mobile cards */
            .no-print { display: none !important; }
            
            /* Summary Grid Styles */
            .print-summary-stats { display: flex; justify-content: space-between; margin-bottom: 20px; border: 1px solid #000; padding: 10px; }
            .print-summary-stats > div { flex: 1; text-align: center; border-right: 1px solid #000; }
            .print-summary-stats > div:last-child { border-right: none; }
            .print-summary-stats p { margin: 5px 0; }
            .print-summary-stats p:first-child { font-size: 10pt; font-weight: bold; }
            .print-summary-stats p:last-child { font-size: 12pt; }
            .print-summary-title { font-weight: bold; margin-bottom: 10px; font-size: 14pt; }

            table { width: 100%; border-collapse: collapse; margin-top: 20px; table-layout: auto; }
            th, td { border: 1px solid #000; padding: 8px; text-align: left; font-size: 11pt; vertical-align: top; }
            th { background-color: #f0f0f0; font-weight: bold; }
            .badge { display: inline-block; padding: 2px 0; font-weight: normal; border: none; background: none; color: #000; }
            .status-paid { font-weight: bold; }
            .status-pending { font-weight: bold; }
            .status-topay { font-weight: bold; }
            @page { margin: 1in; size: portrait; }
            @media print { 
              body { 
                -webkit-print-color-adjust: exact; 
                print-color-adjust: exact; 
                margin: 0; 
                padding: 0;
                font-size: 12pt;
              }
              .no-print { display: none !important; }
              /* Hide scrollbars */
              ::-webkit-scrollbar { display: none; }
              table { page-break-inside: auto; width: 100%; }
              tr { page-break-inside: avoid; page-break-after: auto; }
              th, td { border: 1px solid #000 !important; }
            }
          </style>
        </head>
        <body>
          <div class="print-header">
            <h1>CSC Fines Management System</h1>
            <h2>${reportTitle}</h2>
            <p class="print-date">Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
          </div>
          ${printContent}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <AppLayout>
      <div className="content-wrapper">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-foreground">
            {isStudentView ? "My Reports" : "All Reports"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isStudentView
              ? `Generate and print reports for ${currentStudent?.name}`
              : "Generate and print fines reports"}
          </p>
        </div>

        {!isStudentView && (
          <Card className="card-elevated mb-8 no-print">
            <CardHeader>
              <CardTitle className="font-display flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Report Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2 flex flex-col">
                  <Label className="flex items-center gap-2 mb-1">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    Start Date
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !startDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={setStartDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2 flex flex-col">
                  <Label className="flex items-center gap-2 mb-1">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    End Date
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !endDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={setEndDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>Fine Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="Paid">Paid</SelectItem>
                      <SelectItem value="Unpaid">Unpaid (To Pay & Pending)</SelectItem>
                      <SelectItem value="To Pay">To Pay Only</SelectItem>
                      <SelectItem value="Pending">Pending Approval</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Select Student</Label>
                  <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Students" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Students</SelectItem>
                      {mockStudents.sort((a, b) => a.name.localeCompare(b.name)).map((student) => (
                        <SelectItem key={student.id} value={student.id}>
                          {student.name} ({student.student_id})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {(startDate || endDate || statusFilter !== "all" || selectedStudentId !== "all") && (
                <div className="mt-4 flex justify-end">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => {
                      setStartDate(undefined);
                      setEndDate(undefined);
                      setStatusFilter("all");
                      setSelectedStudentId("all");
                    }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Clear All Filters
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Report Actions - Only show for admin or simplified for student */}
        {!isStudentView && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="card-elevated">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1">Students with Fines</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Complete list of all students with recorded fines
                    </p>
                    <Button
                      onClick={() =>
                        handlePrint(reportRef, "Students with Fines")
                      }
                    >
                      <Printer className="mr-2 h-4 w-4" />
                      Print Report
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="card-elevated">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-accent/10">
                    <FileText className="h-6 w-6 text-accent" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1">Fines Summary Report</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Summary of fines by student with totals
                    </p>
                    <Button
                      onClick={() =>
                        handlePrint(summaryRef, "Fines Summary Report")
                      }
                    >
                      <Printer className="mr-2 h-4 w-4" />
                      Print Report
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="card-elevated">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-success/10">
                    <TrendingUp className="h-6 w-6 text-success" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1">Monthly Income</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Summary of collected payments by month
                    </p>
                    <Button
                      onClick={() =>
                        handlePrint(incomeRef, "Monthly Income Summary")
                      }
                      disabled={incomeLoading}
                    >
                      <Printer className="mr-2 h-4 w-4" />
                      Print Report
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {isStudentView && (
          <Card className="card-elevated mb-8">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">My Fines Report</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Print your complete fines and payment summary
                  </p>
                  <Button
                    onClick={() =>
                      handlePrint(summaryRef, "My Fines Report")
                    }
                  >
                    <Printer className="mr-2 h-4 w-4" />
                    Print Report
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Students/Fines with Fines Report */}
        {!isStudentView && (
          <Card className="card-elevated mb-8">
            <CardHeader>
              <CardTitle className="font-display">
                Students with Fines
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div ref={reportRef}>
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow className="table-header">
                        <TableHead>Student ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Fine Type</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Balance</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {finesWithStudents.map((fine) => (
                        <TableRow key={fine.id}>
                          <TableCell className="font-medium">{fine.student?.student_id}</TableCell>
                          <TableCell>{fine.student?.name}</TableCell>
                          <TableCell>{fine.student?.department}</TableCell>
                          <TableCell>{fine.fine_type}</TableCell>
                          <TableCell>₱{fine.amount.toFixed(2)}</TableCell>
                          <TableCell>₱{fine.balance.toFixed(2)}</TableCell>
                          <TableCell>
                            <Badge className={fine.status === "Paid" ? "status-paid" : "status-pending"}>{fine.status}</Badge>
                          </TableCell>
                          <TableCell>{new Date(fine.created_at).toLocaleDateString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="md:hidden space-y-3 no-print">
                  {finesWithStudents.map((fine) => (
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
                        <Badge className={fine.status === "Paid" ? "status-paid" : "status-pending"}>{fine.status}</Badge>
                      </div>
                      <div className="mt-2 text-sm text-muted-foreground">{new Date(fine.created_at).toLocaleDateString()}</div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Student View - Show their fines */}
        {isStudentView && finesWithStudents.length > 0 && (
          <Card className="card-elevated mb-8">
            <CardHeader>
              <CardTitle className="font-display">
                Your Violations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div ref={reportRef}>
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow className="table-header">
                        <TableHead>Date</TableHead>
                        <TableHead>Type of Violation</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Balance</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {finesWithStudents.map((fine) => (
                        <TableRow key={fine.id}>
                          <TableCell>{new Date(fine.created_at).toLocaleDateString()}</TableCell>
                          <TableCell className="font-medium">{fine.fine_type}</TableCell>
                          <TableCell>₱{fine.amount.toFixed(2)}</TableCell>
                          <TableCell>₱{fine.balance.toFixed(2)}</TableCell>
                          <TableCell>
                            <Badge className={fine.status === "Paid" ? "status-paid" : "status-pending"}>{fine.status}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="md:hidden space-y-3 no-print">
                  {finesWithStudents.map((fine) => (
                    <div key={fine.id} className="card-elevated p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">{new Date(fine.created_at).toLocaleDateString()}</p>
                          <p className="font-medium">{fine.fine_type}</p>
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
                        <Badge className={fine.status === "Paid" ? "status-paid" : "status-pending"}>{fine.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary Report */}
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="font-display">
              {isStudentView ? "Your Fines Summary" : "Fines Summary Report"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div ref={summaryRef}>
              {/* Summary Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 bg-muted/50 rounded-lg print-summary-stats">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Total Fines
                  </p>
                  <p className="text-xl font-bold">
                    {totalFines}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Total Amount
                  </p>
                  <p className="text-xl font-bold">
                    ₱{totalAmount.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Outstanding
                  </p>
                  <p className="text-xl font-bold text-warning">
                    ₱{totalBalance.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Paid / Pending
                  </p>
                  <p className="text-xl font-bold">
                    <span className="text-success">
                      {paidCount}
                    </span>{" "}
                    /{" "}
                    <span className="text-warning">
                      {pendingCount}
                    </span>
                  </p>
                </div>
              </div>

              {/* Admin view: summary by student */}
              {!isStudentView && (
                <>
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow className="table-header">
                          <TableHead>Student ID</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead>No. of Fines</TableHead>
                          <TableHead>Total Amount</TableHead>
                          <TableHead>Balance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {studentsWithFinesSummary.map((student) => (
                          <TableRow key={student.id}>
                            <TableCell className="font-medium">
                              {student.student_id}
                            </TableCell>
                            <TableCell>{student.name}</TableCell>
                            <TableCell>{student.department}</TableCell>
                            <TableCell>
                              {studentFinesMap[student.id]?.count || 0}
                            </TableCell>
                            <TableCell>
                              ₱{(studentFinesMap[student.id]?.total || 0).toFixed(2)}
                            </TableCell>
                            <TableCell>
                              ₱{(studentFinesMap[student.id]?.balance || 0).toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="md:hidden space-y-3 no-print">
                    {studentsWithFinesSummary.map((student) => (
                      <div key={student.id} className="card-elevated p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">{student.student_id}</p>
                            <p className="font-medium">{student.name}</p>
                            <p className="text-sm text-muted-foreground mt-1">{student.department}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">No. of Fines</p>
                            <p className="font-medium">{studentFinesMap[student.id]?.count || 0}</p>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Total Amount</p>
                            <p className="font-medium">₱{(studentFinesMap[student.id]?.total || 0).toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Balance</p>
                            <p className="font-medium">₱{(studentFinesMap[student.id]?.balance || 0).toFixed(2)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Student view: their summary */}
              {isStudentView && currentStudent && (
                <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                  <p className="text-sm font-medium text-foreground mb-3 print-summary-title">Summary for {currentStudent.name}</p>
                  <div className="grid grid-cols-2 gap-4 print-summary-stats">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Violations</p>
                      <p className="text-lg font-semibold">{totalFines}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Fine Amount</p>
                      <p className="text-lg font-semibold">₱{totalAmount.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Settled</p>
                      <p className="text-lg font-semibold text-success">{paidCount}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Outstanding</p>
                      <p className="text-lg font-semibold text-warning">₱{totalBalance.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        {/* Hidden Monthly Income Report for Printing */}
        <div className="hidden">
          <div ref={incomeRef}>
            <div className="print-summary-stats">
              <div>
                <p>Total Income</p>
                <p>₱{Object.values(monthlyIncome).reduce((a, b) => a + b, 0).toLocaleString()}</p>
              </div>
              <div>
                <p>Months Recorded</p>
                <p>{Object.keys(monthlyIncome).length}</p>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Total Collected</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(monthlyIncome)
                  .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
                  .map(([month, amount]) => (
                  <TableRow key={month}>
                    <TableCell className="font-medium">{month}</TableCell>
                    <TableCell className="text-right">₱{amount.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
                {Object.keys(monthlyIncome).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center py-4">No income data available</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

      </div>
    </AppLayout>
  );
}
