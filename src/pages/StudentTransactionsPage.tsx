import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Loader, Receipt, Printer, X, CheckCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useFines } from "@/hooks/useFines";
import { useStudents } from "@/hooks/useStudents";
import { useAuth } from "@/contexts/AuthContext";
import { useTransactions } from "@/hooks/useTransactions";
import { useState } from "react";

export default function StudentTransactionsPage() {
  const { user } = useAuth();
  const { fines, loading: finesLoading, error: finesError } = useFines('all');
  const { transactions, loading: transLoading, error: transError } = useTransactions();
  const { students: mockStudents, loading: studentsLoading, error: studentsError } = useStudents();
  const [showReceipt, setShowReceipt] = useState(false);
  const [currentReceipt, setCurrentReceipt] = useState<{
    referenceNumber: string;
    amount: number;
    date: string;
    method: string;
    fine: any;
    student: any;
  } | null>(null);

  if (finesLoading || transLoading || studentsLoading) {
    return (
      <AppLayout>
        <div className="content-wrapper pt-0 flex items-center justify-center min-h-96">
          <div className="flex flex-col items-center gap-3">
            <Loader className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading transactions...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (finesError || transError || studentsError) {
    return (
      <AppLayout>
        <div className="content-wrapper pt-0">
          <Card className="border-destructive/50 bg-destructive/5">
            <CardHeader>
              <CardTitle className="text-destructive">Error Loading Data</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-destructive/80">{finesError || transError || studentsError}</p>
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

  // Get current student data by matching user.studentId with student.id
  const currentStudent = mockStudents.find((s) => s.id === user?.studentId) || mockStudents.find((s) => s.student_id === user?.studentId);
  
  // If no student data found for this user
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

  // Get only current student's transactions
  const myTransactions = transactions.filter(t => t.fines?.student_id === currentStudent?.id);

  const handleViewReceipt = (transaction: any) => {
    // Parse reference number and method from notes
    // Format: "Method: Online, Ref: PAY-12345678, Status: Pending Approval"
    const notes = transaction.notes || "";
    const methodMatch = notes.match(/Method: ([^,]+)/);
    const refMatch = notes.match(/Ref: ([^,]+)/);
    
    setCurrentReceipt({
      referenceNumber: refMatch ? refMatch[1] : "N/A",
      amount: transaction.amount_paid,
      date: transaction.payment_date,
      method: methodMatch ? methodMatch[1] : "N/A",
      fine: transaction.fines,
      student: currentStudent
    });
    setShowReceipt(true);
  };

  // Calculate summary stats
  const studentFines = fines.filter((f) => f.student_id === currentStudent?.id);
  const totalAmount = studentFines.reduce((sum, f) => sum + f.amount, 0);
  const totalBalance = studentFines.reduce((sum, f) => sum + f.balance, 0);
  const paidCount = studentFines.filter((f) => f.status === "Paid").length;
  const pendingCount = studentFines.filter((f) => f.status === "Pending").length;

  return (
    <AppLayout>
      <div className="content-wrapper pt-0">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-foreground">
            My Transactions
          </h1>
          <p className="text-muted-foreground mt-1">
            View your payment and fine records
          </p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="card-elevated">
            <CardContent className="pt-6">
              <div>
                <p className="text-sm text-muted-foreground">Total Fines</p>
                <p className="text-2xl font-bold">{studentFines.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="card-elevated">
            <CardContent className="pt-6">
              <div>
                <p className="text-sm text-muted-foreground">Total Amount</p>
                <p className="text-2xl font-bold">
                  ₱{totalAmount.toLocaleString()}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="card-elevated">
            <CardContent className="pt-6">
              <div>
                <p className="text-sm text-muted-foreground">Outstanding</p>
                <p className="text-2xl font-bold text-warning">
                  ₱{totalBalance.toLocaleString()}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="card-elevated">
            <CardContent className="pt-6">
              <div>
                <p className="text-sm text-muted-foreground">
                  Settled / Pending
                </p>
                <p className="text-2xl font-bold">
                  <span className="text-success">{paidCount}</span>
                  <span className="text-muted-foreground mx-1">/</span>
                  <span className="text-warning">{pendingCount}</span>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="card-elevated">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="font-display flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Your Payment History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {myTransactions.length > 0 ? (
              <div className="space-y-4">
                {myTransactions.map((trans) => (
                  <div
                    key={trans.id}
                    className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/30 transition-colors gap-4"
                  >
                    <div className="flex items-start gap-4 w-full md:w-auto">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                        <Receipt className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium">{trans.fines?.fine_type || "Fine Payment"}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(trans.payment_date).toLocaleDateString()} • {new Date(trans.payment_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>

                    <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-4 w-full md:w-auto items-center">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase font-semibold">Amount</p>
                        <p className="font-bold">₱{trans.amount_paid.toLocaleString()}</p>
                      </div>

                      <div>
                        <p className="text-xs text-muted-foreground uppercase font-semibold">Status</p>
                        <Badge
                          className={
                            trans.fines?.status === "Paid"
                              ? "bg-success"
                              : "bg-warning text-white"
                          }
                        >
                          {trans.fines?.status === "Paid" ? "Approved" : "Pending Approval"}
                        </Badge>
                      </div>

                      <div className="col-span-2 md:col-span-1 flex justify-end">
                        {trans.fines?.status === "Paid" ? (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleViewReceipt(trans)}
                            className="flex items-center gap-2 border-primary text-primary hover:bg-primary/5"
                          >
                            <Receipt className="h-4 w-4" /> View Receipt
                          </Button>
                        ) : (
                          <span className="text-[10px] text-muted-foreground italic">
                            Receipt available after approval
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                No payment history recorded yet.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Receipt Modal */}
        {showReceipt && currentReceipt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <Card className="w-full max-w-lg card-elevated overflow-hidden animate-in fade-in zoom-in duration-300">
              <div className="bg-success/10 p-6 text-center border-b border-success/20 relative">
                <button 
                  onClick={() => setShowReceipt(false)}
                  className="absolute right-4 top-4 p-1 rounded-full hover:bg-black/5 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
                <div className="h-16 w-16 bg-success/20 rounded-full flex items-center justify-center text-success mx-auto mb-3">
                  <CheckCircle className="h-10 w-10" />
                </div>
                <h2 className="text-2xl font-bold text-success">Official Receipt</h2>
                <p className="text-sm text-success/80">Payment Confirmed by Admin</p>
              </div>
              
              <CardContent className="p-6">
                <div id="receipt-content" className="space-y-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-lg font-display uppercase tracking-wider">Receipt</h3>
                      <p className="text-xs text-muted-foreground">{new Date(currentReceipt.date).toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground uppercase font-semibold">Reference Number</p>
                      <p className="font-mono font-bold text-primary">{currentReceipt.referenceNumber}</p>
                    </div>
                  </div>

                  <div className="border-y border-dashed py-4 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Student Name</span>
                      <span className="font-medium">{currentReceipt.student?.name}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Student ID</span>
                      <span className="font-medium">{currentReceipt.student?.student_id}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Payment Method</span>
                      <span className="font-medium">{currentReceipt.method}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-bold text-muted-foreground uppercase">Item Paid</p>
                    <div className="flex justify-between text-sm">
                      <span>{currentReceipt.fine?.fine_type}</span>
                      <span className="font-medium">₱{currentReceipt.amount.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="bg-muted/30 p-4 rounded-lg flex justify-between items-center">
                    <span className="font-bold">Total Paid</span>
                    <span className="text-2xl font-black text-primary">₱{currentReceipt.amount.toLocaleString()}</span>
                  </div>

                  <div className="text-center">
                    <p className="text-[10px] text-muted-foreground italic">
                      This is an electronically generated receipt for CSC Fine Payment.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-8">
                  <Button 
                    variant="outline" 
                    onClick={() => window.print()}
                    className="flex items-center gap-2"
                  >
                    <Printer className="h-4 w-4" /> Print
                  </Button>
                  <Button 
                    onClick={() => setShowReceipt(false)}
                    className="bg-primary hover:bg-primary/90"
                  >
                    Close
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
