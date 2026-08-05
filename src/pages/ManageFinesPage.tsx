import { useState, useEffect, useRef, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useFines } from "@/hooks/useFines";
import { useStudents } from "@/hooks/useStudents";
import { useAppSettings } from "@/hooks/useAppSettings";
import { supabase } from "@/integrations/supabase/client";
import { FINE_TYPES as fineTypes, FINE_AMOUNTS as fineAmounts, DEFAULT_DEPARTMENTS } from "@/lib/constants";
import type { FineType, FineStatus } from "@/types";
import { getUniqueStudentDepartments, getDepartments } from "@/integrations/supabase/queries";
import { Plus, Loader, User, FileText, DollarSign, AlertCircle, Upload, X, Calendar, Search, Filter, Camera } from "lucide-react";

function resolveStudentPhotoUrl(
  rawPhotoUrl?: string | null,
  updatedAt?: string
) {
  const trimmed = rawPhotoUrl?.trim();
  if (!trimmed) return undefined;

  if (/^(data:|blob:)/i.test(trimmed)) {
    return trimmed;
  }

  let resolvedUrl = trimmed;

  try {
    const parsed = new URL(trimmed);
    const storageMatch = decodeURIComponent(parsed.pathname).match(
      /\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)$/
    );

    if (storageMatch) {
      const [, bucket, path] = storageMatch;
      resolvedUrl = supabase.storage
        .from(bucket)
        .getPublicUrl(path).data.publicUrl;
    }
  } catch {
    const normalizedPath = trimmed
      .replace(/^\/+/, "")
      .replace(/^storage\/v1\/object\/(?:public|sign)\/[^/]+\//, "")
      .replace(/^user-assets\//, "");

    resolvedUrl = supabase.storage
      .from("user-assets")
      .getPublicUrl(normalizedPath).data.publicUrl;
  }

  if (!updatedAt) return resolvedUrl;

  return `${resolvedUrl}${resolvedUrl.includes("?") ? "&" : "?"}t=${encodeURIComponent(
    updatedAt
  )}`;
}

export default function ManageFinesPage() {
  const { toast } = useToast();
  const { students, loading: studentsLoading, refetch: refetchStudents } = useStudents();
  const { fines, loading: finesLoading, refetch: refetchFines } = useFines();
  const { settings } = useAppSettings();
  
  const [selectedStudent, setSelectedStudent] = useState<string>("");
  const [selectedFineType, setSelectedFineType] = useState<string>("Not wearing ID");
  const [notes, setNotes] = useState<string>("");
  const [customAmount, setCustomAmount] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [useCustomAmount, setUseCustomAmount] = useState(false);
  const [proofImage, setProofImage] = useState<File | null>(null);
  const [proofImagePreview, setProofImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [fineDate, setFineDate] = useState<string>(new Date().toISOString().split('T')[0]); // Default to today
  
  // Camera state
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Filtering state
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedDeptFilter, setSelectedDeptFilter] = useState("all");
  const [dbDepartments, setDbDepartments] = useState<string[]>([]);

  // Load unique departments from both students table and departments table
  useEffect(() => {
    const loadDepartments = async () => {
      try {
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
        setDbDepartments(DEFAULT_DEPARTMENTS);
      }
    };
    loadDepartments();
  }, []);

  // Handle camera stream when component updates
  useEffect(() => {
    const attachStream = () => {
      if (isCameraOpen && streamRef.current && videoRef.current) {
        videoRef.current.srcObject = streamRef.current;
        videoRef.current.play().catch(e => console.error("Error playing video:", e));
      }
    };
    
    // Attach immediately if possible
    attachStream();
    
    // Also set a small timeout to ensure DOM is ready
    const timer = setTimeout(attachStream, 100);
    
    return () => clearTimeout(timer);
  }, [isCameraOpen]);

  // Clean up camera on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const loading = studentsLoading || finesLoading;

  // Filtered students list
  const filteredStudents = students.filter(student => {
    const matchesSearch = 
      student.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
      student.student_id.toLowerCase().includes(studentSearch.toLowerCase());
    
    const matchesDept = selectedDeptFilter === "all" || student.department === selectedDeptFilter;
    
    return matchesSearch && matchesDept;
  });

  // Get selected student details
  const selectedStudentData = students.find((s) => s.id === selectedStudent);
  const selectedStudentPhotoUrl = useMemo(() => {
    return resolveStudentPhotoUrl(
      selectedStudentData?.photo_url,
      selectedStudentData?.updated_at
    );
  }, [selectedStudentData]);

  // Combine default and custom fine types
  const allFineTypes = useMemo(() => {
    let customTypes: any[] = [];
    try {
      if (settings.custom_fine_types) {
        customTypes = JSON.parse(settings.custom_fine_types);
      }
    } catch (e) {
      console.error("Error parsing custom fine types:", e);
    }
    
    return [
      ...fineTypes.map(t => ({ name: t, amount: fineAmounts[t], isCustom: false })),
      ...customTypes.map(t => ({ ...t, isCustom: true }))
    ];
  }, [settings.custom_fine_types]);

  // Calculate amount based on fine type or custom
  const amount = useMemo(() => {
    if (useCustomAmount) {
      return parseFloat(customAmount) || 0;
    }
    const selectedType = allFineTypes.find(t => t.name === selectedFineType);
    return selectedType ? selectedType.amount : 0;
  }, [useCustomAmount, customAmount, selectedFineType, allFineTypes]);

  // Get student's existing fines

  const studentFines = selectedStudent 
    ? fines.filter((f) => f.student_id === selectedStudent)
    : [];

  const toPayFines = studentFines.filter((f) => f.status === "To Pay" || (f.status !== "Paid" && f.status !== "Pending"));
  const pendingApprovalFines = studentFines.filter((f) => f.status === "Pending");
  
  const totalToPayAmount = toPayFines.reduce((sum, f) => sum + Number(f.balance || 0), 0);
  const totalPendingAmount = pendingApprovalFines.reduce(
    (sum, f) => sum + Number(f.pending_payment ?? f.balance ?? 0),
    0
  );
  const totalPendingBalance = pendingApprovalFines.reduce(
    (sum, f) => sum + Number(f.balance || 0),
    0
  );
  const paidCount = studentFines.filter((f) => f.status === "Paid").length;
  const totalPaidAmount = studentFines.reduce((sum, f) => {
    const paidAmount = Number(f.amount || 0) - Number(f.balance || 0);
    return sum + Math.max(0, paidAmount);
  }, 0);

  // Handle image file selection
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid file",
          description: "Please select an image file (JPEG, PNG, etc.)",
          variant: "destructive",
        });
        return;
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Image must be less than 5MB",
          variant: "destructive",
        });
        return;
      }
      setProofImage(file);
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setProofImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Clear selected image
  const clearImage = () => {
    setProofImage(null);
    setProofImagePreview(null);
    if (isCameraOpen) {
      stopCamera();
    }
  };

  // Start camera
  const startCamera = async () => {
    try {
      // 1. First, set state to show the video element (this mounts the <video> tag)
      setIsCameraOpen(true);
      setProofImage(null);
      setProofImagePreview(null);
      
      // 2. Request camera access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" } // Prefer back camera on mobile
      });
      
      // 3. Save stream reference
      streamRef.current = stream;
      
      // 4. Attach to video element if it's already mounted (or let useEffect handle it)
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(e => console.error("Error playing video:", e));
      }
    } catch (error) {
      console.error("Camera error:", error);
      setIsCameraOpen(false); // Hide camera UI on error
      toast({
        title: "Camera Error",
        description: "Unable to access camera. Please check permissions.",
        variant: "destructive",
      });
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
  };

  // Capture photo
  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], `capture_${Date.now()}.jpg`, { type: "image/jpeg" });
            setProofImage(file);
            setProofImagePreview(canvas.toDataURL("image/jpeg"));
            stopCamera();
          }
        }, "image/jpeg", 0.8);
      }
    }
  };

  // Upload image to Supabase Storage
  const uploadImage = async (fineId: string): Promise<string | null> => {
    if (!proofImage) return null;
    
    setUploadingImage(true);
    try {
      const fileExt = proofImage.name.split('.').pop();
      const fileName = `${fineId}_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('fine-images')
        .upload(filePath, proofImage);

      if (uploadError) {
        toast({
          title: "Upload failed",
          description: "Failed to upload proof image",
          variant: "destructive",
        });
        return null;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('fine-images')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedStudent) {
      toast({
        title: "Error",
        description: "Please select a student",
        variant: "destructive",
      });
      return;
    }

    if (!proofImage) {
      toast({
        title: "Error",
        description: "Proof image is required",
        variant: "destructive",
      });
      return;
    }

    if (useCustomAmount && (!customAmount || parseFloat(customAmount) <= 0)) {
      toast({
        title: "Error",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    if (!useCustomAmount && amount <= 0) {
      toast({
        title: "Error",
        description: "Selected fine type has no valid amount",
        variant: "destructive",
      });
      return;
    }

    const finalAmount = Number(amount);
    if (isNaN(finalAmount) || finalAmount <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid amount greater than 0",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // First insert the fine without the image
      const fineData = {
        student_id: selectedStudent,
        fine_type: selectedFineType as FineType,
        amount: finalAmount,
        balance: finalAmount,
        status: "To Pay" as FineStatus,
        notes: notes || null,
        created_at: new Date(fineDate).toISOString(),
      };

      console.log("Inserting fine data:", fineData);

      const { data, error: insertError } = await supabase
        .from("fines")
        .insert(fineData)
        .select();

      if (insertError) {
        console.error("Supabase insert error:", insertError);
        throw insertError;
      }

      const insertedFine = data?.[0];
      if (!insertedFine) {
        throw new Error("Failed to retrieve inserted fine data.");
      }

      // If there's an image, upload it and update the fine
      let proofImageUrl = null;
      if (proofImage && insertedFine) {
        console.log("Uploading image for fine:", insertedFine.id);
        proofImageUrl = await uploadImage(insertedFine.id);
        if (proofImageUrl) {
          console.log("Updating fine with image URL:", proofImageUrl);
          const { error: updateError } = await supabase
            .from("fines")
            .update({ proof_image: proofImageUrl })
            .eq("id", insertedFine.id);
            
          if (updateError) {
            console.error("Error updating fine with image:", updateError);
            // Don't throw here, the fine was already created
          }
        }
      }

      toast({
        title: "Success",
        description: `Fine of ₱${amount} added to ${selectedStudentData?.name}`,
      });

      // Reset form
      setSelectedStudent("");
      setSelectedFineType("Not wearing ID");
      setNotes("");
      setCustomAmount("");
      setUseCustomAmount(false);
      setFineDate(new Date().toISOString().split('T')[0]);
      clearImage();

      // Refetch fines
      await refetchFines();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add fine. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="content-wrapper pt-0 flex items-center justify-center min-h-96">
          <div className="flex flex-col items-center gap-3">
            <Loader className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="content-wrapper pt-0">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-foreground">
            Manage Fines
          </h1>
          <p className="text-muted-foreground mt-1">
            Add and manage fines for students
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Add Fine Form */}
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="font-display flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Add New Fine
              </CardTitle>
              <CardDescription>
                Select a student and assign a fine
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Student Selection with Filters */}
                <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="h-4 w-4 text-primary" />
                    <Label className="font-semibold">Student Selection</Label>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="student-search" className="text-xs text-muted-foreground flex items-center gap-1">
                        <Search className="h-3 w-3" />
                        Search Student
                      </Label>
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          id="student-search"
                          placeholder="Name or ID..."
                          value={studentSearch}
                          onChange={(e) => setStudentSearch(e.target.value)}
                          className="pl-8 h-9 text-sm bg-background"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="dept-filter" className="text-xs text-muted-foreground flex items-center gap-1">
                        <Filter className="h-3 w-3" />
                        Filter by Department
                      </Label>
                      <Select
                        value={selectedDeptFilter}
                        onValueChange={setSelectedDeptFilter}
                      >
                        <SelectTrigger id="dept-filter" className="h-9 text-sm bg-background">
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
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="student" className="text-xs text-muted-foreground">
                      Final Selection
                    </Label>
                    <Select
                      value={selectedStudent}
                      onValueChange={setSelectedStudent}
                    >
                      <SelectTrigger id="student" className="w-full">
                        <SelectValue placeholder={filteredStudents.length > 0 ? "Choose a student" : "No students match filters"} />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredStudents.length > 0 ? (
                          filteredStudents.map((student) => (
                            <SelectItem key={student.id} value={student.id}>
                              {student.student_id} - {student.name} ({student.department})
                            </SelectItem>
                          ))
                        ) : (
                          <div className="p-2 text-center text-sm text-muted-foreground">
                            No matching students
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                    {studentSearch || selectedDeptFilter !== "all" ? (
                      <p className="text-[10px] text-muted-foreground italic">
                        Showing {filteredStudents.length} of {students.length} students
                      </p>
                    ) : null}
                  </div>
                </div>

                {/* Date Imposed */}
                <div className="space-y-2">
                  <Label htmlFor="fineDate" className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Date Imposed
                  </Label>
                  <Input
                    id="fineDate"
                    type="date"
                    value={fineDate}
                    onChange={(e) => setFineDate(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    className="w-full"
                  />
                </div>

                {/* Fine Type Selection */}
                <div className="space-y-2">
                  <Label htmlFor="fineType" className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Fine Type
                  </Label>
                  <Select
                    value={selectedFineType}
                    onValueChange={(value) => setSelectedFineType(value)}
                  >
                    <SelectTrigger id="fineType" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {allFineTypes.map((type) => (
                        <SelectItem key={type.name} value={type.name}>
                          {type.name} (₱{type.amount}) {type.isCustom ? "🌟" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Amount Selection */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Amount
                  </Label>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
                    <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-muted transition-colors border sm:border-0 border-border">
                      <input
                        type="radio"
                        checked={!useCustomAmount}
                        onChange={() => setUseCustomAmount(false)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm">Standard: ₱{allFineTypes.find(t => t.name === selectedFineType)?.amount || 0}</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-muted transition-colors border sm:border-0 border-border">
                      <input
                        type="radio"
                        checked={useCustomAmount}
                        onChange={() => setUseCustomAmount(true)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm">Custom</span>
                    </label>
                  </div>
                  {useCustomAmount && (
                    <Input
                      type="number"
                      placeholder="Enter custom amount"
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      min="1"
                      className="mt-2"
                    />
                  )}
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label htmlFor="notes" className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Notes (Optional)
                  </Label>
                  <Textarea
                    id="notes"
                    placeholder="Add any additional details about this fine..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                  />
                </div>

                {/* Proof Image Upload */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    Proof Image (Required)
                  </Label>
                  <div className="border-2 border-dashed border-border rounded-lg p-4 overflow-hidden">
                    {proofImagePreview ? (
                      <div className="relative">
                        <img
                          src={proofImagePreview}
                          alt="Proof preview"
                          className="w-full h-48 object-cover rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={clearImage}
                          className="absolute top-2 right-2 p-1 bg-destructive text-white rounded-full hover:bg-destructive/90"
                        >
                          <X className="h-4 w-4" />
                        </button>
                        <p className="text-sm text-muted-foreground mt-2 truncate">
                          {proofImage?.name}
                        </p>
                      </div>
                    ) : isCameraOpen ? (
                      <div className="flex flex-col items-center gap-4">
                        <div className="relative w-full h-48 bg-black rounded-lg overflow-hidden">
                          <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-cover"
                            onLoadedMetadata={() => videoRef.current?.play()}
                          />
                        </div>
                        <div className="flex gap-2 w-full">
                          <Button 
                            type="button" 
                            variant="destructive" 
                            onClick={stopCamera}
                            className="flex-1"
                          >
                            Cancel
                          </Button>
                          <Button 
                            type="button" 
                            onClick={capturePhoto}
                            className="flex-1"
                          >
                            Capture
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-4 gap-4">
                        <div className="flex gap-2">
                          <label className="flex flex-col items-center justify-center cursor-pointer p-4 border rounded-lg hover:bg-muted/50 transition-colors w-32">
                            <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                            <span className="text-sm font-medium">Upload</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleImageChange}
                              className="hidden"
                            />
                          </label>
                          
                          <button
                            type="button"
                            onClick={startCamera}
                            className="flex flex-col items-center justify-center cursor-pointer p-4 border rounded-lg hover:bg-muted/50 transition-colors w-32"
                          >
                            <Camera className="h-8 w-8 text-muted-foreground mb-2" />
                            <span className="text-sm font-medium">Camera</span>
                          </button>
                        </div>
                        <p className="text-xs text-muted-foreground text-center">
                          Upload an image or take a photo as proof
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting || !selectedStudent}
                >
                  {isSubmitting ? (
                    <>
                      <Loader className="h-4 w-4 mr-2 animate-spin" />
                      Adding Fine...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Fine (₱{amount})
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Student Fine Summary */}
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="font-display">
                Student Fine Summary
              </CardTitle>
              <CardDescription>
                {selectedStudentData 
                  ? `Viewing fines for ${selectedStudentData.name}`
                  : "Select a student to view their fines"
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedStudentData ? (
                <div className="space-y-6">
                  {/* Student Info with Profile Picture */}
                  <div className="p-4 bg-muted/50 rounded-xl border border-border/50">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-16 w-16 border-2 border-primary/20 shrink-0">
                        {selectedStudentPhotoUrl && (
                          <AvatarImage 
                            src={selectedStudentPhotoUrl}
                            alt={selectedStudentData.name} 
                            className="object-cover"
                          />
                        )}
                        <AvatarFallback className="bg-background text-muted-foreground font-bold">
                          {selectedStudentData.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <span className="font-bold text-lg block leading-tight">{selectedStudentData.name}</span>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{selectedStudentData.student_id}</Badge>
                          <span className="text-xs text-muted-foreground">{selectedStudentData.department}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Fine Statistics */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-warning/5 rounded-lg border border-warning/20">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Total Amount To Pay</p>
                      <p className="text-xl font-black text-warning">₱{totalToPayAmount.toLocaleString()}</p>
                    </div>
                    <div className="p-3 bg-info/5 rounded-lg border border-info/20">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Pending Approval</p>
                      <p className="text-xl font-black text-info">{pendingApprovalFines.length}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">payments need approval</p>
                    </div>
                    <div className="p-3 bg-destructive/5 rounded-lg border border-destructive/20">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Overall Balance</p>
                      <p className="text-xl font-black text-destructive">₱{(totalToPayAmount + totalPendingBalance).toLocaleString()}</p>
                    </div>
                    <div className="p-3 bg-success/5 rounded-lg border border-success/20">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Total Settled</p>
                      <p className="text-xl font-black text-success">₱{totalPaidAmount.toLocaleString()}</p>
                    </div>
                  </div>

                  {/* Recent Fines List */}
                  {studentFines.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-bold text-sm uppercase tracking-widest text-muted-foreground">Recent Fines</h4>
                        <Badge variant="outline" className="text-[10px]">{studentFines.length} total</Badge>
                      </div>
                      <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                        {studentFines
                          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                          .slice(0, 5)
                          .map((fine) => (
                            <div
                              key={fine.id}
                              className="p-3 border border-border/50 rounded-xl bg-card hover:bg-muted/30 transition-colors flex items-center justify-between gap-3"
                            >
                              <div className="min-w-0">
                                <p className="font-bold text-sm truncate">{fine.fine_type}</p>
                                <p className="text-[10px] text-muted-foreground">
                                  {new Date(fine.created_at).toLocaleDateString()}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="font-black text-sm">₱{fine.amount.toLocaleString()}</p>
                                <p className="text-[10px] text-muted-foreground">Bal: ₱{fine.balance.toLocaleString()}</p>
                                <Badge
                                  className={`text-[9px] px-1.5 h-4 mt-1 ${
                                    fine.status === "Paid"
                                      ? "bg-success text-white"
                                      : fine.status === "Pending"
                                      ? "bg-info text-white"
                                      : "bg-warning text-white"
                                  }`}
                                >
                                  {fine.status === "Pending" ? "Pending Approval" : fine.status}
                                </Badge>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Select a student to view their fine summary</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
