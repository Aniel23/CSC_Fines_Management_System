import React, { useState, useEffect } from 'react';
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
import { 
  Building2, 
  Plus, 
  Edit, 
  Trash2, 
  Users,
  Search,
  Filter
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { toast } from 'sonner';
import { createDepartment, getDepartments, updateDepartment, deleteDepartment } from '@/integrations/supabase/queries';

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
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    head_of_department: '',
    office_location: '',
    contact_email: ''
  });

  useEffect(() => {
    loadDepartments();
  }, []);

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
                <Card key={department.id} className="hover:shadow-lg transition-shadow">
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
                          onClick={() => handleEdit(department)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(department)}
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
        </div>
      </div>
    </AppLayout>
  );
}
