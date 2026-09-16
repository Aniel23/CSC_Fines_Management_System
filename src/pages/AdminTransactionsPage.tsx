import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Clock, Loader, Search, Filter } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useState, useEffect, useMemo } from "react";
import { useFines } from "@/hooks/useFines";
import { useStudents } from "@/hooks/useStudents";
import { DEFAULT_DEPARTMENTS } from "@/lib/constants";
import { 
  getUniqueStudentDepartments, 
  getDepartments 
} from "@/integrations/supabase/queries";
import { usePagination } from "@/hooks/usePagination";
import { PaginationBar } from "@/components/shared/PaginationBar";

export default function AdminTransactionsPage() {
  const { fines, loading: finesLoading, error: finesError } = useFines('all');
  const { students, loading: studentsLoading, error: studentsError } = useStudents();
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [dbDepartments, setDbDepartments] = useState<string[]>([]);

  useEffect(() => {
    loadDepartments();
  }, []);

  const loadDepartments = async () => {
    try {
      // Fetch from departments table
      const deptsFromTable = await getDepartments();
      const tableDeptNames = deptsFromTable.map((d: any) => d.name);
      
      // Use only departments from the database if available
      if (tableDeptNames.length > 0) {
        const uniqueDepts = Array.from(new Set(tableDeptNames))
          .filter(Boolean)
          .sort();
        setDbDepartments(uniqueDepts);
      } else {
        // Fallback to existing students' departments if table is empty
        const uniqueDepts = await getUniqueStudentDepartments();
        const combinedDepts = Array.from(new Set([...uniqueDepts, ...DEFAULT_DEPARTMENTS]))
          .filter(Boolean)
          .sort();
        setDbDepartments(combinedDepts);
      }
    } catch (error) {
      console.error("Error loading departments:", error);
      setDbDepartments(DEFAULT_DEPARTMENTS);
    }
  };

  // fines.student_id is the UUID (foreign key to students.id)
  let recentFines = fines
    .map((fine) => ({
      ...fine,
      student: students.find((s) => s.id === fine.student_id),
    }));

  if (searchTerm) {
    const search = searchTerm.toLowerCase();
    recentFines = recentFines.filter(
      (f) =>
        f.student?.name?.toLowerCase().includes(search) ||
        f.student?.student_id?.toLowerCase().includes(search)
    );
  }

  if (selectedDepartment) {
    recentFines = recentFines.filter(
      (f) => f.student?.department === selectedDepartment
    );
  }

  if (selectedStatus) {
    recentFines = recentFines.filter((f) => f.status === selectedStatus);
  }

  // Calculate summary stats
  const totalAmount = recentFines.reduce((sum, f) => sum + f.amount, 0);
  const totalBalance = recentFines.reduce((sum, f) => sum + f.balance, 0);
  const paidCount = recentFines.filter((f) => f.status === "Paid").length;
  const pendingCount = recentFines.filter((f) => f.status === "Pending").length;

  const { paged: pagedFines, currentPage, setCurrentPage, totalPages, pageSize } = usePagination(recentFines);

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
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive">Error Loading Data</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-destructive/80">{finesError || studentsError}</p>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  // Check if data is empty - likely not seeded yet
  if (students.length === 0 || fines.length === 0) {
    return (
      <AppLayout>
        <div className="content-wrapper pt-0">
          <Card className="border-warning/50 bg-warning/5">
            <CardHeader>
              <CardTitle className="text-warning">No Data Available</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-warning/80">
                No transactions or student data found.
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
            All Transactions
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor all student fines and payment activities
          </p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="card-elevated">
            <CardContent className="pt-6">
              <div>
                <p className="text-sm text-muted-foreground">Total Transactions</p>
                <p className="text-2xl font-bold">{fines.length}</p>
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
                  Paid / Pending
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

        {/* Search & Filters */}
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
                    placeholder="Search name or student ID..."
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
                    {dbDepartments.map((dept) => (
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
                    <SelectItem value="Paid">Paid</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {(searchTerm || selectedDepartment || selectedStatus) && (
              <div className="mt-4 p-3 bg-info/10 rounded-lg border border-info/20">
                <p className="text-sm text-info">
                  Showing {recentFines.length} of {fines.length} transactions •
                  ₱{totalAmount.toLocaleString()} •{" "}
                  <span className="font-medium text-warning">
                    ₱{totalBalance.toLocaleString()} outstanding
                  </span>
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="font-display flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Latest Recorded Fines
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentFines.length > 0 ? (
              <>
                <div className="space-y-4">
                  {pagedFines.map((fine) => (
                  <div
                    key={fine.id}
                    className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-4 w-full md:w-auto mb-3 md:mb-0">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary">
                        {fine.student?.name?.[0] || "?"}
                      </div>
                      <div>
                        <p className="font-medium">{fine.student?.name || "Deleted Student"}</p>
                        <p className="text-sm text-muted-foreground">
                          {fine.student?.student_id || "N/A"} • {fine.student?.department || "Unknown"}
                        </p>
                      </div>
                    </div>

                    <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4 w-full md:w-auto">
                      <div className="flex flex-col items-start md:items-center md:text-center">
                        <p className="text-sm font-medium">{fine.fine_type || "Deleted Fine"}</p>
                        <p className="text-xs text-muted-foreground">Fine Type</p>
                      </div>

                      <div className="flex flex-col items-start md:items-center md:text-center">
                        <p className="font-semibold">₱{fine.amount.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">Amount</p>
                      </div>

                      <div className="flex flex-col items-start md:items-center md:text-center">
                        <Badge
                          className={
                            fine.status === "Paid"
                              ? "bg-success"
                              : "bg-warning text-white"
                          }
                        >
                          {fine.status}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          Status
                        </p>
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
                <PaginationBar
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={recentFines.length}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                />
              </>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                No transactions recorded yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
