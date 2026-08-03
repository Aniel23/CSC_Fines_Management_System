import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Building2, 
  Plus, 
  Edit, 
  Trash2, 
  Users,
  Search,
  Filter,
  Archive,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { toast } from 'sonner';
import { createDepartment, getDepartments, updateDepartment, deleteDepartment, createStudent, updateStudent, deleteStudent, binStudent, restoreStudent, archiveStudent, unarchiveStudent } from '@/integrations/supabase/queries';
import { useStudents } from '@/hooks/useStudents';
import type { Student } from '@/types';

interface Department {
  id: string;
  name: string;
  description: string | null;
  head_of_department: string | null;
  office_location: string | null;
  contact_email: string | null;
  created_at: string;
  updated_at: string;
  student_count?: number;
}

export default function DepartmentManagement() {
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [studentViewFilter, setStudentViewFilter] = useState<'active' | 'archived' | 'binned'>('active');
  const [studentSearch, setStudentSearch] = useState('');
  const [studentDialogOpen, setStudentDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [studentForm, setStudentForm] = useState({
    student_id: '',
    name: '',
    age: 18,
    gender: 'Male' as 'Male' | 'Female' | 'Other',
    address: '',
    department: ''
  });
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    head_of_department: '',
    office_location: '',
    contact_email: ''
  });

  const { students: departmentStudents, loading: studentsLoading, error: studentsError, refetch: refetchStudents } = useStudents(selectedDepartment || undefined, studentViewFilter);

  useEffect(() => {
    loadDepartments();
  }, []);

  useEffect(() => {
    if (selectedDepartment) {
      refetchStudents();
    }
  }, [selectedDepartment, studentViewFilter, refetchStudents]);

  const filteredStudents = useMemo(() => {
    const normalizedSearch = studentSearch.trim().toLowerCase();
    return departmentStudents.filter((student) => {
      if (!normalizedSearch) return true;
      return (
        student.name.toLowerCase().includes(normalizedSearch) ||
        student.student_id.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [departmentStudents, studentSearch]);

  const closeStudentModal = () => {
    setStudentModalOpen(false);
    setSelectedDepartment(null);
    setStudentSearch('');
    setStudentViewFilter('active');
  };

  const resetStudentForm = () => {
    setStudentForm({
      student_id: '',
      name: '',
      age: 18,
      gender: 'Male',
      address: '',
      department: selectedDepartment || ''
    });
    setEditingStudent(null);
  };

  const openStudentDialog = (student?: Student) => {
    if (student) {
      setEditingStudent(student);
      setStudentForm({
        student_id: student.student_id,
        name: student.name,
        age: student.age,
        gender: student.gender,
        address: student.address || '',
        department: student.department || selectedDepartment || ''
      });
    } else {
      setEditingStudent(null);
      setStudentForm({
        student_id: '',
        name: '',
        age: 18,
        gender: 'Male',
        address: '',
        department: selectedDepartment || ''
      });
    }
    setStudentDialogOpen(true);
  };

  const saveStudent = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!studentForm.student_id.trim() || !studentForm.name.trim()) {
      toast.error('Student ID and name are required');
      return;
    }

    try {
      if (editingStudent) {
        await updateStudent(editingStudent.id, {
          student_id: studentForm.student_id,
          name: studentForm.name,
          age: studentForm.age,
          gender: studentForm.gender,
          department: studentForm.department,
          address: studentForm.address || null
        });
        toast.success('Student updated successfully');
      } else {
        await createStudent({
          student_id: studentForm.student_id,
          name: studentForm.name,
          age: studentForm.age,
          gender: studentForm.gender,
          department: studentForm.department,
          address: studentForm.address || null
        });
        toast.success('Student added successfully');
      }
      setStudentDialogOpen(false);
      resetStudentForm();
      refetchStudents();
    } catch (error) {
      console.error('Error saving student:', error);
      toast.error('Failed to save student');
    }
  };

  const handleStudentDelete = async () => {
    if (!studentToDelete) return;
    try {
      await deleteStudent(studentToDelete.id);
      toast.success('Student deleted permanently');
      setStudentToDelete(null);
      refetchStudents();
    } catch (error) {
      console.error('Error deleting student:', error);
      toast.error('Failed to delete student');
    }
  };

  const handleStudentBin = async (student: Student) => {
    try {
      await binStudent(student.id);
      toast.success('Student moved to bin');
      refetchStudents();
    } catch (error) {
      console.error('Error binning student:', error);
      toast.error('Failed to move student to bin');
    }
  };

  const handleStudentRestore = async (student: Student) => {
    try {
      await restoreStudent(student.id);
      toast.success('Student restored');
      refetchStudents();
    } catch (error) {
      console.error('Error restoring student:', error);
      toast.error('Failed to restore student');
    }
  };

  const handleStudentArchive = async (student: Student) => {
    try {
      await archiveStudent(student.id);
      toast.success('Student archived');
      refetchStudents();
    } catch (error) {
      console.error('Error archiving student:', error);
      toast.error('Failed to archive student');
    }
  };

  const handleStudentUnarchive = async (student: Student) => {
    try {
      await unarchiveStudent(student.id);
      toast.success('Student unarchived');
      refetchStudents();
    } catch (error) {
      console.error('Error unarchiving student:', error);
      toast.error('Failed to unarchive student');
    }
  };

  const loadDepartments = async () => {
    try {
      setLoading(true);
      const data = await getDepartments();
      setDepartments(data || []);
    } catch (error) {
      console.error('Error loading departments:', error);
      toast.error('Failed to load departments');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Department name is required');
      return;
    }

    try {
      if (editingDepartment) {
        // Update existing department
        await updateDepartment(editingDepartment.id, {
          name: formData.name,
          description: formData.description || null,
          head_of_department: formData.head_of_department || null,
          office_location: formData.office_location || null,
          contact_email: formData.contact_email || null
        });
        toast.success('Department updated successfully');
      } else {
        // Create new department
        await createDepartment({
          name: formData.name,
          description: formData.description || null,
          head_of_department: formData.head_of_department || null,
          office_location: formData.office_location || null,
          contact_email: formData.contact_email || null
        });
        toast.success('Department created successfully');
      }
      
      setIsDialogOpen(false);
      resetForm();
      loadDepartments();
    } catch (error) {
      console.error('Error saving department:', error);
      toast.error('Failed to save department');
    }
  };

  const handleEdit = (department: Department) => {
    setEditingDepartment(department);
    setFormData({
      name: department.name,
      description: department.description || '',
      head_of_department: department.head_of_department || '',
      office_location: department.office_location || '',
      contact_email: department.contact_email || ''
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (department: Department) => {
    if (!confirm(`Are you sure you want to delete "${department.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteDepartment(department.id);
      toast.success('Department deleted successfully');
      loadDepartments();
    } catch (error) {
      toast.error('Failed to delete department');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      head_of_department: '',
      office_location: '',
      contact_email: ''
    });
    setEditingDepartment(null);
  };

  const filteredDepartments = departments.filter(dept =>
    dept.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dept.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dept.head_of_department?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedDepartmentInfo = departments.find((dept) => dept.name === selectedDepartment);

  return (
    <AppLayout>
      <div className="content-wrapper pt-0">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold">Department Management</h1>
              <p className="text-muted-foreground">Manage academic departments and their information</p>
            </div>
            
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Department
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>
                    {editingDepartment ? 'Edit Department' : 'Add New Department'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="name">Department Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Computer Science"
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <textarea
                      id="description"
                      className="w-full min-h-[80px] px-3 py-2 text-sm ring-offset-background border border-input bg-background rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Brief description of the department"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="head_of_department">Head of Department</Label>
                    <Input
                      id="head_of_department"
                      value={formData.head_of_department}
                      onChange={(e) => setFormData(prev => ({ ...prev, head_of_department: e.target.value }))}
                      placeholder="e.g., Dr. John Smith"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="office_location">Office Location</Label>
                    <Input
                      id="office_location"
                      value={formData.office_location}
                      onChange={(e) => setFormData(prev => ({ ...prev, office_location: e.target.value }))}
                      placeholder="e.g., Building A, Room 101"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="contact_email">Contact Email</Label>
                    <Input
                      id="contact_email"
                      type="email"
                      value={formData.contact_email}
                      onChange={(e) => setFormData(prev => ({ ...prev, contact_email: e.target.value }))}
                      placeholder="e.g., dept@university.edu"
                    />
                  </div>
                  
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">
                      {editingDepartment ? 'Update' : 'Create'} Department
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Search and Filter */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search departments..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button variant="outline" size="sm">
                  <Filter className="mr-2 h-4 w-4" />
                  Filter
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Departments Grid */}
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredDepartments.map((department) => (
                <Card
                  key={department.id}
                  className="hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => {
                    setSelectedDepartment(department.name);
                    setStudentSearch('');
                    setStudentViewFilter('active');
                    setStudentModalOpen(true);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      setSelectedDepartment(department.name);
                      setStudentSearch('');
                      setStudentViewFilter('active');
                      setStudentModalOpen(true);
                    }
                  }}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-primary" />
                        <CardTitle className="text-lg">{department.name}</CardTitle>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {department.student_count || 0} students
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {department.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {department.description}
                      </p>
                    )}
                    
                    {department.head_of_department && (
                      <div className="text-sm">
                        <span className="font-medium">Head:</span> {department.head_of_department}
                      </div>
                    )}
                    
                    {department.office_location && (
                      <div className="text-sm">
                        <span className="font-medium">Location:</span> {department.office_location}
                      </div>
                    )}
                    
                    {department.contact_email && (
                      <div className="text-sm">
                        <span className="font-medium">Email:</span> 
                        <a href={`mailto:${department.contact_email}`} className="text-primary hover:underline ml-1">
                          {department.contact_email}
                        </a>
                      </div>
                    )}
                    
                    <div className="flex justify-between items-center pt-3 border-t">
                      <div className="text-xs text-muted-foreground">
                        Created: {new Date(department.created_at).toLocaleDateString()}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(department);
                          }}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(department);
                          }}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!loading && filteredDepartments.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  {searchTerm ? 'No departments found' : 'No departments yet'}
                </h3>
                <p className="text-muted-foreground text-center mb-4">
                  {searchTerm 
                    ? 'Try adjusting your search terms'
                    : 'Get started by adding your first department'
                  }
                </p>
                {!searchTerm && (
                  <Button onClick={() => setIsDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Department
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          <Dialog
            open={studentModalOpen}
            onOpenChange={(open) => {
              if (!open) {
                closeStudentModal();
                return;
              }
              setStudentModalOpen(true);
            }}
          >
            <DialogContent className="sm:max-w-5xl">
              <DialogHeader className="pr-10">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <DialogTitle>
                      {selectedDepartment ? `${selectedDepartment} Students` : 'Students'}
                    </DialogTitle>
                    <p className="text-sm text-muted-foreground mt-2">
                      {selectedDepartmentInfo?.description || `Showing students in ${selectedDepartment || 'selected'} department.`}
                    </p>
                  </div>
                  <Button onClick={() => openStudentDialog()} className="w-full sm:w-auto">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Student
                  </Button>
                </div>
              </DialogHeader>

              <div className="space-y-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {filteredStudents.length} student{filteredStudents.length === 1 ? '' : 's'} found
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    <div className="relative flex-1 sm:flex-none">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                      <Input
                        placeholder="Search students..."
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <Tabs value={studentViewFilter} onValueChange={(value: 'active' | 'archived' | 'binned') => setStudentViewFilter(value)} className="w-full sm:w-auto">
                      <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="active">Active</TabsTrigger>
                        <TabsTrigger value="archived">Archived</TabsTrigger>
                        <TabsTrigger value="binned">Bin</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                </div>

                {studentsLoading ? (
                  <div className="flex justify-center items-center h-40">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : studentsError ? (
                  <Card className="border-destructive/50 bg-destructive/5">
                    <CardContent>
                      <p className="text-sm text-destructive-foreground">Error loading students: {studentsError}</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-3 md:hidden">
                      {filteredStudents.map((student) => (
                        <Card key={student.id} className="border">
                          <CardContent className="space-y-4 pt-4">
                            <div className="space-y-1">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="font-medium break-words">{student.name}</p>
                                  <p className="text-xs text-muted-foreground break-all">
                                    {student.student_id}
                                  </p>
                                </div>
                                <Badge variant="secondary">{student.gender}</Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                Department: {student.department || '-'}
                              </p>
                            </div>

                            <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/20 p-3 text-sm">
                              <div>
                                <p className="text-xs text-muted-foreground">Age</p>
                                <p className="font-medium">{student.age}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Address</p>
                                <p className="font-medium break-words">{student.address || '-'}</p>
                              </div>
                            </div>

                            <div className="flex flex-col gap-2">
                              {(studentViewFilter === 'active' || studentViewFilter === 'archived') && (
                                <Button
                                  variant="outline"
                                  className="w-full"
                                  onClick={() => openStudentDialog(student)}
                                >
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit Student
                                </Button>
                              )}
                              {studentViewFilter === 'active' && (
                                <>
                                  <Button
                                    variant="outline"
                                    className="w-full"
                                    onClick={() => handleStudentArchive(student)}
                                  >
                                    <Archive className="mr-2 h-4 w-4" />
                                    Archive Student
                                  </Button>
                                  <Button
                                    variant="outline"
                                    className="w-full text-destructive hover:text-destructive"
                                    onClick={() => handleStudentBin(student)}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Move to Bin
                                  </Button>
                                </>
                              )}
                              {studentViewFilter === 'archived' && (
                                <>
                                  <Button
                                    variant="outline"
                                    className="w-full"
                                    onClick={() => handleStudentUnarchive(student)}
                                  >
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    Unarchive Student
                                  </Button>
                                  <Button
                                    variant="outline"
                                    className="w-full text-destructive hover:text-destructive"
                                    onClick={() => handleStudentBin(student)}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Move to Bin
                                  </Button>
                                </>
                              )}
                              {studentViewFilter === 'binned' && (
                                <>
                                  <Button
                                    variant="outline"
                                    className="w-full"
                                    onClick={() => handleStudentRestore(student)}
                                  >
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    Restore Student
                                  </Button>
                                  <Button
                                    variant="outline"
                                    className="w-full text-destructive hover:text-destructive"
                                    onClick={() => setStudentToDelete(student)}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete Permanently
                                  </Button>
                                </>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    <div className="hidden overflow-x-auto md:block">
                      <Table>
                        <TableHeader>
                          <TableRow>
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
                              <TableCell>{student.student_id}</TableCell>
                              <TableCell>{student.name}</TableCell>
                              <TableCell>{student.age}</TableCell>
                              <TableCell>{student.gender}</TableCell>
                              <TableCell>{student.department}</TableCell>
                              <TableCell className="max-w-xs truncate">{student.address || '-'}</TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-2">
                                  {(studentViewFilter === 'active' || studentViewFilter === 'archived') && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => openStudentDialog(student)}
                                      className="h-8 w-8 p-0"
                                      title="Edit Student"
                                    >
                                      <Edit className="h-3 w-3" />
                                    </Button>
                                  )}
                                  {studentViewFilter === 'active' && (
                                    <>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleStudentArchive(student)}
                                        className="h-8 w-8 p-0"
                                        title="Archive Student"
                                      >
                                        <Archive className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleStudentBin(student)}
                                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                        title="Move to Bin"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </>
                                  )}
                                  {studentViewFilter === 'archived' && (
                                    <>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleStudentUnarchive(student)}
                                        className="h-8 w-8 p-0"
                                        title="Unarchive Student"
                                      >
                                        <RefreshCw className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleStudentBin(student)}
                                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                        title="Move to Bin"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </>
                                  )}
                                  {studentViewFilter === 'binned' && (
                                    <>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleStudentRestore(student)}
                                        className="h-8 w-8 p-0"
                                        title="Restore Student"
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
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={closeStudentModal} className="w-full sm:w-auto">
                  Close
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={studentDialogOpen} onOpenChange={setStudentDialogOpen}>
            <DialogContent className="sm:max-w-[520px]">
              <DialogHeader>
                <DialogTitle>{editingStudent ? 'Edit Student' : 'Add Student'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={saveStudent} className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <Label htmlFor="student_id">Student ID</Label>
                    <Input
                      id="student_id"
                      value={studentForm.student_id}
                      onChange={(e) => setStudentForm(prev => ({ ...prev, student_id: e.target.value }))}
                      placeholder="2024-00001"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={studentForm.name}
                      onChange={(e) => setStudentForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Juan Dela Cruz"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="age">Age</Label>
                      <Input
                        id="age"
                        type="number"
                        value={studentForm.age}
                        onChange={(e) => setStudentForm(prev => ({ ...prev, age: Number(e.target.value) }))}
                        min={15}
                      />
                    </div>
                    <div>
                      <Label htmlFor="gender">Gender</Label>
                      <Select
                        value={studentForm.gender}
                        onValueChange={(value) => setStudentForm(prev => ({ ...prev, gender: value as 'Male' | 'Female' | 'Other' }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Female">Female</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="department">Department</Label>
                    <Input
                      id="department"
                      value={studentForm.department}
                      onChange={(e) => setStudentForm(prev => ({ ...prev, department: e.target.value }))}
                      placeholder="Department"
                    />
                  </div>
                  <div>
                    <Label htmlFor="address">Address</Label>
                    <Input
                      id="address"
                      value={studentForm.address}
                      onChange={(e) => setStudentForm(prev => ({ ...prev, address: e.target.value }))}
                      placeholder="123 Main St"
                    />
                  </div>
                </div>
                <DialogFooter className="gap-2">
                  <Button type="button" variant="outline" onClick={() => setStudentDialogOpen(false)} className="w-full sm:w-auto">
                    Cancel
                  </Button>
                  <Button type="submit" className="w-full sm:w-auto">
                    {editingStudent ? 'Save Changes' : 'Add Student'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <AlertDialog open={!!studentToDelete} onOpenChange={(open) => !open && setStudentToDelete(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Student</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to permanently delete {studentToDelete?.name} ({studentToDelete?.student_id})? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={handleStudentDelete}
                >
                  Delete Permanently
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

        </div>
      </div>
    </AppLayout>
  );
}
