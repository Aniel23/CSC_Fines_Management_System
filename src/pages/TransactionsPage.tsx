import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Info, Loader, Filter } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFines } from "@/hooks/useFines";
import { useStudents } from "@/hooks/useStudents";
import { useAuth } from "@/contexts/AuthContext";
import { FINE_TYPES as fineTypes } from "@/lib/constants";

export default function TransactionsPage() {
  const { user } = useAuth();
  const { fines, loading: finesLoading, error: finesError } = useFines();
  const { students, loading: studentsLoading, error: studentsError } = useStudents();
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedFineType, setSelectedFineType] = useState<string>("all");

  if (finesLoading || studentsLoading) {
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
  
  // For students, show only their transactions
  // For admins, show all transactions
  // fines.student_id is the UUID (foreign key to students.id)
  let displayFines = fines.map((fine) => ({
    ...fine,
    student: students.find((s) => s.id === fine.student_id),
  }));

  let isStudentView = false;
  let studentName = "";

  if (user?.role === "student") {
    isStudentView = true;
    // Find the student record for this user by matching user.studentId with student.id
    const currentStudent = students.find((s) => s.id === user?.studentId) || students.find((s) => s.student_id === user?.studentId);
    if (currentStudent) {
      studentName = currentStudent.name;
      displayFines = displayFines.filter((f) => f.student_id === currentStudent.id);
    }
  }

  // Apply filters
  if (selectedStatus !== "all") {
    displayFines = displayFines.filter((f) => f.status === selectedStatus);
  }

  if (selectedFineType !== "all") {
    displayFines = displayFines.filter((f) => f.fine_type === selectedFineType);
  }

  return (
    <AppLayout>
      <div className="content-wrapper">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-foreground">
            {isStudentView ? "My Transactions" : "All Transactions"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isStudentView
              ? `Payment and fine records for ${studentName}`
              : "Recent fines and payment activities"}
          </p>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Status
                </label>
                <Select value={selectedStatus} onValueChange={(value) => setSelectedStatus(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="Paid">Paid</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Fine Type
                </label>
                <Select value={selectedFineType} onValueChange={(value) => setSelectedFineType(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Fine Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Fine Types</SelectItem>
                    {fineTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <Clock className="h-5 w-5" />
              {isStudentView ? "Your Recent Fines" : "Latest Recorded Fines"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {displayFines.length > 0 ? (
              <div className="space-y-4">
                {displayFines.map((fine) => (
                  <div
                    key={fine.id}
                    className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/30 transition-colors"
                  >
                    {!isStudentView && (
                      <div className="flex items-center gap-4 w-full md:w-auto mb-3 md:mb-0">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary">
                          {fine.student?.name?.[0] || "?"}
                        </div>
                        <div>
                          <p className="font-medium">{fine.student?.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {fine.student?.student_id} • {fine.student?.department}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4 w-full md:w-auto">
                      <div className="flex flex-col items-start md:items-center md:text-center">
                        <p className="text-sm font-medium">{fine.fine_type}</p>
                        <p className="text-xs text-muted-foreground">Fine Type</p>
                      </div>

                      <div className="flex flex-col items-start md:items-center md:text-center">
                        <p className="font-semibold">₱{fine.amount.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">Amount</p>
                      </div>

                      <div className="flex flex-col items-start md:items-center md:text-center">
                        <Badge
                          className={
                            fine.status === "Paid" ? "status-paid" : "status-pending"
                          }
                        >
                          {fine.status}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">Status</p>
                      </div>

                      <div className="flex flex-col items-start md:items-center md:text-center">
                        <p className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(fine.created_at), {
                            addSuffix: true,
                          })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(fine.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted mx-auto mb-4">
                  <Info className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">
                  {isStudentView
                    ? "No transactions recorded yet."
                    : "No transactions recorded yet."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
