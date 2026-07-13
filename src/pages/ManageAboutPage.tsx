import { useState, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCSCOfficers, createCSCOfficer, updateCSCOfficer, deleteCSCOfficer } from "@/integrations/supabase/queries";
import { supabase } from "@/integrations/supabase/client";
import { SEED_OFFICERS } from "@/lib/seed-data";
import { Plus, Trash2, Save, Loader2, User, Image as ImageIcon, ArrowUp, ArrowDown, Upload, X, Database, Mail } from "lucide-react";
import { useAppSettings } from "@/hooks/useAppSettings";

export default function ManageAboutPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { settings, upsertSetting } = useAppSettings();
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    position: "",
    description: "",
    photo_url: "",
    display_order: 0,
  });

  // Fetch officers
  const { data: officers, isLoading } = useQuery({
    queryKey: ["csc_officers"],
    queryFn: getCSCOfficers,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: createCSCOfficer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["csc_officers"] });
      toast({ title: "Success", description: "Officer added successfully" });
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: any }) => updateCSCOfficer(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["csc_officers"] });
      toast({ title: "Success", description: "Officer updated successfully" });
      setIsEditing(null);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCSCOfficer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["csc_officers"] });
      toast({ title: "Success", description: "Officer removed successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      for (const officer of SEED_OFFICERS) {
        // Remove id to let database generate it
        const { id, ...officerData } = officer;
        await createCSCOfficer(officerData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["csc_officers"] });
      toast({ title: "Success", description: "Default data imported successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      position: "",
      description: "",
      photo_url: "",
      display_order: (officers?.length || 0) + 1,
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleEdit = (officer: any) => {
    setIsEditing(officer.id);
    setFormData({
      name: officer.name,
      position: officer.position,
      description: officer.description || "",
      photo_url: officer.photo_url || "",
      display_order: officer.display_order,
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    // Validate size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Image must be less than 2MB",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
      const filePath = `officers/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('officer-photos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('officer-photos')
        .getPublicUrl(filePath);

      setFormData(prev => ({ ...prev, photo_url: publicUrl }));
      toast({ title: "Photo uploaded", description: "Image ready to save." });
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload image. Make sure 'officer-photos' bucket exists and is public.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing) {
      updateMutation.mutate({ id: isEditing, updates: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const moveOrder = (officer: any, direction: 'up' | 'down') => {
    const currentIndex = officers?.findIndex(o => o.id === officer.id);
    if (currentIndex === undefined || currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= (officers?.length || 0)) return;

    const otherOfficer = officers![newIndex];
    
    // Swap display orders
    updateMutation.mutate({ id: officer.id, updates: { display_order: otherOfficer.display_order } });
    updateMutation.mutate({ id: otherOfficer.id, updates: { display_order: officer.display_order } });
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-foreground">Manage About CSC</h1>
          <p className="text-muted-foreground mt-1">Add, edit, or remove CSC officers and their information.</p>
        </div>

        {/* Admin Email Section */}
        <div className="mb-8">
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="font-display flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Contact Email
              </CardTitle>
              <CardDescription>
                This is the email address where messages from the Contact Admin form will be sent.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Input 
                  value="lestermadrigal870@gmail.com" 
                  disabled 
                  className="bg-muted text-muted-foreground"
                />
                <Button disabled variant="outline">
                  Fixed
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Note: This email is currently fixed for testing purposes.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form Column */}
          <div className="lg:col-span-1">
            <Card className="card-elevated sticky top-6">
              <CardHeader>
                <CardTitle className="font-display">
                  {isEditing ? "Edit Officer" : "Add New Officer"}
                </CardTitle>
                <CardDescription>
                  Enter the officer's details to display on the About page.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      placeholder="e.g. Alexandra Chen"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="position">Position</Label>
                    <Input
                      id="position"
                      placeholder="e.g. President"
                      value={formData.position}
                      onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description (Optional)</Label>
                    <Textarea
                      id="description"
                      placeholder="A short bio..."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Officer Photo</Label>
                    <div className="flex flex-col gap-3">
                      {formData.photo_url && (
                        <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-primary/20">
                          <img 
                            src={formData.photo_url} 
                            alt="Preview" 
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => setFormData(p => ({ ...p, photo_url: "" }))}
                            className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                          >
                            <X className="h-5 w-5 text-white" />
                          </button>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading}
                        >
                          {uploading ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <Upload className="h-4 w-4 mr-2" />
                          )}
                          {formData.photo_url ? "Change Photo" : "Upload Photo"}
                        </Button>
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileUpload}
                          accept="image/*"
                          className="hidden"
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground text-center">
                        Max size: 2MB. Recommended: Square aspect ratio.
                      </p>
                    </div>
                  </div>
                  
                  <div className="pt-4 flex gap-2">
                    <Button 
                      type="submit" 
                      className="flex-1"
                      disabled={createMutation.isPending || updateMutation.isPending || uploading}
                    >
                      {(createMutation.isPending || updateMutation.isPending) ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      {isEditing ? "Update Officer" : "Add Officer"}
                    </Button>
                    {isEditing && (
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => { setIsEditing(null); resetForm(); }}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* List Column */}
          <div className="lg:col-span-2">
            <Card className="card-elevated">
              <CardHeader>
                <CardTitle className="font-display flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Current Officers
                  </div>
                  {(!officers || officers.length === 0) && !isLoading && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => seedMutation.mutate()}
                      disabled={seedMutation.isPending}
                    >
                      {seedMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Database className="h-4 w-4 mr-2" />}
                      Import Default Data
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : officers && officers.length > 0 ? (
                  <div className="space-y-4">
                    {officers.map((officer, index) => (
                      <div 
                        key={officer.id} 
                        className="flex items-center gap-4 p-4 rounded-lg border border-border bg-card/50 hover:bg-card/80 transition-colors"
                      >
                        <div className="h-16 w-16 rounded-full overflow-hidden bg-muted flex-shrink-0 border border-border">
                          {officer.photo_url ? (
                            <img src={officer.photo_url} alt={officer.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center">
                              <User className="h-8 w-8 text-muted-foreground/50" />
                            </div>
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold truncate">{officer.name}</h4>
                          <p className="text-sm text-primary font-medium">{officer.position}</p>
                          {officer.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-1">{officer.description}</p>
                          )}
                        </div>

                        <div className="flex flex-col gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8"
                            disabled={index === 0}
                            onClick={() => moveOrder(officer, 'up')}
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8"
                            disabled={index === (officers.length - 1)}
                            onClick={() => moveOrder(officer, 'down')}
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleEdit(officer)}
                          >
                            <Plus className="h-4 w-4 rotate-45" /> {/* Using Plus as Edit icon since it's common in this UI */}
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              if (window.confirm(`Are you sure you want to remove ${officer.name}?`)) {
                                deleteMutation.mutate(officer.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <User className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p>No officers found. Add your first officer using the form.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
