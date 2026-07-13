import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
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
import { Plus, Search, Loader, Edit, Trash2, Check, Archive, RefreshCw, Trash2 as TrashIcon, Info, AlertTriangle } from "lucide-react";
import { useStudents } from "@/hooks/useStudents";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { getUniqueStudentDepartments, getDepartments, deleteStudent, binStudent, restoreStudent, archiveStudent, unarchiveStudent } from "@/integrations/supabase/queries";
import { DEFAULT_DEPARTMENTS, GENDERS as genders } from "@/lib/constants";
import type { Student } from "@/types";

const studentSchema = z.object({
  student_id: z.string().min(1, "Student ID is required").max(20),
  name: z.string().min(1, "Name is required").max(255),
  age: z.coerce.number().min(15, "Age must be at least 15").max(100, "Age must be less than 100"),
  address: z.string().optional(),
  gender: z.enum(["Male", "Female", "Other"] as const),
  department: z.string().optional(),
});

type StudentFormValues = z.infer<typeof studentSchema>;

export default function StudentsPage() {
  const { user, metadataLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const selectedDepartment = searchParams.get("department") || undefined;
  const [viewFilter, setViewFilter] = useState<"active" | "archived" | "binned">("active");
  const { students: fetchedStudents, loading: studentsLoading, error: studentsError } = useStudents(selectedDepartment, viewFilter);
   const [search, setSearch] = useState("");
   const [isDialogOpen, setIsDialogOpen] = useState(false);
   const [editingStudent, setEditingStudent] = useState<Student | null>(null);
   const [students, setStudents] = useState<Student[]>(fetchedStudents);
   const [dbDepartments, setDbDepartments] = useState<string[]>([]);
   const [loadingDepts, setLoadingDepts] = useState(false);
   const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);

  // Load unique departments from both students table and departments table
  useEffect(() => {
    const loadDepartments = async () => {
      try {
        setLoadingDepts(true);
        
        // Fetch unique departments from students table
        const uniqueDepts = await getUniqueStudentDepartments();
        
        // Fetch from departments table to ensure all listed departments are included
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
        setDbDepartments(DEFAULT_DEPARTMENTS); // Fallback
      } finally {
        setLoadingDepts(false);
      }
    };

    loadDepartments();
  }, []);

  // Initialize form hook BEFORE any conditional returns
  const form = useForm<StudentFormValues>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      student_id: "",
      name: "",
      age: 18,
      address: "",
      gender: "Male",
      department: "",
    },
  });

  // Update form when editing student
  useEffect(() => {
    if (editingStudent) {
      form.reset({
        student_id: editingStudent.student_id,
        name: editingStudent.name,
        age: editingStudent.age,
        address: editingStudent.address || "",
        gender: editingStudent.gender,
        department: editingStudent.department,
      });
    }
  }, [editingStudent, form]);

  // Update students when fetched data changes
  useEffect(() => {
    setStudents(fetchedStudents);
  }, [fetchedStudents]);

  // Calculate filtered students BEFORE any conditional returns
  const filteredStudents = useMemo(() => {
    return students.filter(
      (student) => {
        const matchesSearch =
          student.name.toLowerCase().includes(search.toLowerCase()) ||
          student.student_id.toLowerCase().includes(search.toLowerCase());
        const matchesDepartment = !selectedDepartment || student.department === selectedDepartment;
        return matchesSearch && matchesDepartment;
      }
    );
  }, [students, search, selectedDepartment]);

  const onSubmit = async (data: StudentFormValues) => {
    try {
      if (editingStudent) {
        // Update existing student
        const { error } = await supabase
          .from("students")
          .update({
            student_id: data.student_id,
            name: data.name,
            age: data.age,
            address: data.address || null,
            gender: data.gender,
            department: data.department,
          })
          .eq("id", editingStudent.id)
          .select()
          .single();

        if (error) {
          console.error("Error updating student:", JSON.stringify(error, null, 2));
          toast.error("Failed to update student: " + (error.message || "Check console for details"));
          return;
        }

        // Update local state
        setStudents(students.map(s => s.id === editingStudent.id ? { ...s, department: data.department } : s));
        toast.success("Student updated successfully");
        setEditingStudent(null);
      } else {
        // Insert new student
        const { data: newStudentData, error } = await supabase
          .from("students")
          .insert({
            student_id: data.student_id,
            name: data.name,
            age: data.age,
            address: data.address || null,
            gender: data.gender,
            department: data.department,
          })
          .select()
          .single();

        if (error) {
          console.error("Error adding student:", JSON.stringify(error, null, 2));
          toast.error("Failed to add student: " + (error.message || "Check console for details"));
          return;
        }

        // Update local state
        if (newStudentData) {
          setStudents([newStudentData as Student, ...students]);
          toast.success("Student added successfully");
        }
      }

      setIsDialogOpen(false);
      form.reset();
      setEditingStudent(null);
    } catch (error) {
      toast.error("Failed to save student");
    }
  };

  const handleDeleteStudent = async () => {
    if (!studentToDelete) return;

    try {
      await deleteStudent(studentToDelete.id);
      setStudents(students.filter(s => s.id !== studentToDelete.id));
      toast.success("Student deleted permanently");
    } catch (error: any) {
      console.error("Error deleting student:", error);
      toast.error("Failed to delete student: " + (error.message || "Unknown error"));
    } finally {
      setStudentToDelete(null);
    }
  };

  const handleBinStudent = async (student: Student) => {
    try {
      await binStudent(student.id);
      setStudents(students.filter(s => s.id !== student.id));
      toast.success("Student moved to bin");
    } catch (error: any) {
      toast.error("Failed to move student to bin");
    }
  };

  const handleRestoreStudent = async (student: Student) => {
    try {
      await restoreStudent(student.id);
      setStudents(students.filter(s => s.id !== student.id));
      toast.success("Student restored");
    } catch (error: any) {
      toast.error("Failed to restore student");
    }
  };

  const handleArchiveStudent = async (student: Student) => {
    try {
      await archiveStudent(student.id);
      setStudents(students.filter(s => s.id !== student.id));
      toast.success("Student archived");
    } catch (error: any) {
      toast.error("Failed to archive student");
    }
  };

  const handleUnarchiveStudent = async (student: Student) => {
    try {
      await unarchiveStudent(student.id);
      setStudents(students.filter(s => s.id !== student.id));
      toast.success("Student unarchived");
    } catch (error: any) {
      toast.error("Failed to unarchive student");
    }
  };

  if (studentsLoading || metadataLoading) {
    return (
      <AppLayout>
        <div className="content-wrapper pt-0 flex items-center justify-center min-h-96">
          <div className="flex flex-col items-center gap-3">
            <Loader className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading students...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Check if there was a serious error loading data
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

  return (
    <AppLayout>
      <div className="content-wrapper">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">
              Students {selectedDepartment && `- ${selectedDepartment}`}
            </h1>
            <p className="text-muted-foreground mt-1">
              {selectedDepartment ? `Students in ${selectedDepartment} department` : "Manage student information"}
            </p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Student
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="font-display">
                  {editingStudent ? 'Edit Student' : 'Add New Student'}
                </DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-4"
                >
                  {!editingStudent && (
                    <div className="bg-blue-50 text-blue-800 p-3 rounded-md flex gap-2 text-sm">
                      <Info className="h-5 w-5 shrink-0" />
                      <p>
                        Adding a student here only creates their profile. 
                        <strong> The student must go to the Register page</strong> to set their password and create their login account.
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="student_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Student ID</FormLabel>
                          <FormControl>
                            <Input placeholder="2024-00001" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Juan Dela Cruz" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="age"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Age</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="gender"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Gender</FormLabel>
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
                              {genders.map((g) => (
                                <SelectItem key={g} value={g}>
                                  {g}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="department"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Department</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select Department" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {loadingDepts ? (
                              <div className="flex items-center justify-center py-2">
                                <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground mr-2" />
                                <span className="text-xs text-muted-foreground">Loading departments...</span>
                              </div>
                            ) : (
                              dbDepartments.map((dept) => (
                                <SelectItem key={dept} value={dept}>
                                  {dept}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address</FormLabel>
                        <FormControl>
                          <Input placeholder="123 Main St, City" {...field} />
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
                      {editingStudent ? 'Update Student' : 'Add Student'}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <AlertDialog open={!!studentToDelete} onOpenChange={(open) => !open && setStudentToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the student <strong>{studentToDelete?.name}</strong> ({studentToDelete?.student_id}).
                <br /><br />
                This action cannot be undone. This will permanently delete the student account, their authentication data, and remove their data from our servers.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteStudent}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete Permanently
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Search */}
        <Card className="card-elevated mb-6">
          <CardContent className="pt-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or student ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Students Table */}
        <Card className="card-elevated">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="font-display">Student List</CardTitle>
            <Tabs value={viewFilter} onValueChange={(v: any) => setViewFilter(v)} className="w-full sm:w-auto">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="active">Active</TabsTrigger>
                <TabsTrigger value="archived">Archived</TabsTrigger>
                <TabsTrigger value="binned">Bin</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            {viewFilter === 'binned' && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md flex gap-2 text-sm text-amber-800 items-start">
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
                <p>
                  <strong>Note:</strong> Items in the bin will be permanently deleted after 30 days. Please restore any students you wish to keep before then.
                </p>
              </div>
            )}

            {filteredStudents.length > 0 ? (
              <div className="overflow-x-auto">
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow className="table-header">
                        <TableHead>Student ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Age</TableHead>
                        <TableHead>Gender</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Address</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStudents.map((student) => (
                        <TableRow key={student.id}>
                          <TableCell className="font-medium">
                            {student.student_id}
                          </TableCell>
                          <TableCell>{student.name}</TableCell>
                          <TableCell>{student.age}</TableCell>
                          <TableCell>{student.gender}</TableCell>
                          <TableCell>{student.department}</TableCell>
                          <TableCell className="max-w-xs truncate">{student.address || "-"}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {viewFilter === 'active' && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setEditingStudent(student);
                                      setIsDialogOpen(true);
                                    }}
                                    className="h-8 w-8 p-0"
                                    title="Edit"
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleArchiveStudent(student)}
                                    className="h-8 w-8 p-0"
                                    title="Archive"
                                  >
                                    <Archive className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleBinStudent(student)}
                                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                    title="Move to Bin"
                                  >
                                    <TrashIcon className="h-3 w-3" />
                                  </Button>
                                </>
                              )}
                              {viewFilter === 'archived' && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleUnarchiveStudent(student)}
                                    className="h-8 w-8 p-0"
                                    title="Unarchive"
                                  >
                                    <RefreshCw className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleBinStudent(student)}
                                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                    title="Move to Bin"
                                  >
                                    <TrashIcon className="h-3 w-3" />
                                  </Button>
                                </>
                              )}
                              {viewFilter === 'binned' && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleRestoreStudent(student)}
                                    className="h-8 w-8 p-0 text-success hover:text-success"
                                    title="Restore"
                                  >
                                    <RefreshCw className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setStudentToDelete(student)}
                                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                    title="Delete Permanently"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="md:hidden space-y-3">
                  {filteredStudents.map((student) => (
                    <div key={student.id} className="card-elevated p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">{student.student_id}</p>
                          <p className="font-medium">{student.name}</p>
                          <p className="text-sm text-muted-foreground mt-1">{student.department}</p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex gap-1">
                            {viewFilter === 'active' && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setEditingStudent(student);
                                    setIsDialogOpen(true);
                                  }}
                                  className="h-8 w-8 p-0"
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleArchiveStudent(student)}
                                  className="h-8 w-8 p-0"
                                >
                                  <Archive className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleBinStudent(student)}
                                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                >
                                  <TrashIcon className="h-3 w-3" />
                                </Button>
                              </>
                            )}
                            {viewFilter === 'archived' && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleUnarchiveStudent(student)}
                                  className="h-8 w-8 p-0"
                                >
                                  <RefreshCw className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleBinStudent(student)}
                                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                >
                                  <TrashIcon className="h-3 w-3" />
                                </Button>
                              </>
                            )}
                            {viewFilter === 'binned' && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleRestoreStudent(student)}
                                  className="h-8 w-8 p-0 text-success hover:text-success"
                                >
                                  <RefreshCw className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setStudentToDelete(student)}
                                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </>
                            )}
                          </div>
                          <div className="text-right mt-1">
                            <p className="text-sm text-muted-foreground">Age</p>
                            <p className="font-medium">{student.age}</p>
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Gender</p>
                          <p className="font-medium">{student.gender}</p>
                        </div>
                        <p className="max-w-[150px] truncate text-sm text-muted-foreground">
                          {student.address || "-"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-10 text-muted-foreground">
                No students found. Add your first student to get started.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
