import { useState, useRef, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Mail, Shield, GraduationCap, Calendar, Clock, ArrowLeft, Camera, Loader2, Trash2, QrCode, Eye, EyeOff, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAppSettings } from "@/hooks/useAppSettings";
import { GENDERS } from "@/lib/constants";

export default function ProfilePage() {
  const { user, refreshUserData } = useAuth();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changing, setChanging] = useState(false);
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [studentProfile, setStudentProfile] = useState({ name: "", age: "", gender: "Male", address: "" });
  const [loadingStudentProfile, setLoadingStudentProfile] = useState(false);
  const [savingStudentProfile, setSavingStudentProfile] = useState(false);
  const { settings, upsertSetting } = useAppSettings();
  const qrFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user?.role !== "student" || !user.studentId) return;

    const loadStudentProfile = async () => {
      setLoadingStudentProfile(true);
      const { data, error } = await supabase
        .from("students")
        .select("name, age, gender, address")
        .eq("id", user.studentId)
        .maybeSingle();

      if (error) {
        toast.error("Failed to load your student details");
      } else if (data) {
        setStudentProfile({
          name: data.name,
          age: String(data.age),
          gender: data.gender,
          address: data.address || "",
        });
      }
      setLoadingStudentProfile(false);
    };

    loadStudentProfile();
  }, [user?.role, user?.studentId]);

  if (!user) return null;

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      if (!event.target.files || event.target.files.length === 0) {
        throw new Error("You must select an image to upload.");
      }

      const file = event.target.files[0];
      const fileExt = file.name.split(".").pop();
      const filePath = `avatars/${user.id}-${Math.random()}.${fileExt}`;

      // 1. Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("user-assets")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from("user-assets")
        .getPublicUrl(filePath);
      
      console.log("[Profile] Generated public URL:", publicUrl);

      // 3. Update user_roles table
      const { error: updateError } = await supabase
        .from("user_roles")
        .update({ avatar_url: publicUrl })
        .eq("user_id", user.id);

      if (updateError) {
        console.error("[Profile] Update error:", updateError);
        throw updateError;
      }

      // 4. ALSO update students table if user is a student
      if (user.role === "student" && user.studentId) {
        console.log("[Profile] Syncing to students table for studentId:", user.studentId);
        const { error: studentSyncError } = await supabase
          .from("students")
          .update({ photo_url: publicUrl })
          .eq("id", user.studentId);
        
        if (studentSyncError) {
          console.error("[Profile] Student sync error:", studentSyncError);
          // We don't throw here to not break the whole flow, but we log it
        }
      }

      console.log("[Profile] Database updated successfully with URL");
      toast.success("Profile picture updated successfully!");
      
      // Update local state without reload
      await refreshUserData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setUploading(false);
    }
  };

  const removeAvatar = async () => {
    try {
      setUploading(true);
      const { error: updateError } = await supabase
        .from("user_roles")
        .update({ avatar_url: null })
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      // Also remove from students table if student
      if (user.role === "student" && user.studentId) {
        await supabase
          .from("students")
          .update({ photo_url: null })
          .eq("id", user.studentId);
      }

      toast.success("Profile picture removed.");
      await refreshUserData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword || !newPassword || !confirmPassword) {
      toast.error("Please fill in all fields");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    try {
      setChanging(true);
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: oldPassword,
      });
      if (reauthError) {
        toast.error("Old password is incorrect");
        return;
      }
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) {
        toast.error(updateError.message || "Failed to change password");
        return;
      }
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password changed successfully");
    } finally {
      setChanging(false);
    }
  };

  const handleSaveStudentProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const age = Number(studentProfile.age);
    const name = studentProfile.name.trim().replace(/\s+/g, " ");
    const address = studentProfile.address.trim().replace(/\s+/g, " ");

    if (!name || name.length > 255) {
      toast.error("Please enter a name between 1 and 255 characters");
      return;
    }
    if (!Number.isInteger(age) || age < 15 || age > 100) {
      toast.error("Age must be between 15 and 100");
      return;
    }
    if (address.length > 500) {
      toast.error("Address must not exceed 500 characters");
      return;
    }

    setSavingStudentProfile(true);
    const { error } = await supabase.rpc("update_own_student_profile", {
      p_name: name,
      p_age: age,
      p_gender: studentProfile.gender,
      p_address: address,
    });
    setSavingStudentProfile(false);

    if (error) {
      toast.error(error.message || "Failed to update your student details");
      return;
    }

    toast.success("Student details updated successfully");
    await refreshUserData();
  };

  const handlePaymentQrUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!event.target.files || event.target.files.length === 0) {
        throw new Error("Select an image to upload.");
      }
      const file = event.target.files[0];
      const fileExt = file.name.split(".").pop();
      const filePath = `payment-qr/admin-qr-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("user-assets")
        .upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage
        .from("user-assets")
        .getPublicUrl(filePath);
      await upsertSetting("payment_qr_url", publicUrl);
      toast.success("Payment QR updated");
    } catch (err: any) {
      toast.error(err.message || "Failed to upload QR");
    }
  };

  const [newCustomFineType, setNewCustomFineType] = useState("");
  const [newCustomFineAmount, setNewCustomFineAmount] = useState("");

  const handleAddCustomFineType = async () => {
    if (!newCustomFineType.trim() || !newCustomFineAmount) {
      toast.error("Please enter both fine type and amount");
      return;
    }

    try {
      const currentTypesStr = settings.custom_fine_types || "[]";
      const currentTypes = JSON.parse(currentTypesStr);
      
      const newType = {
        name: newCustomFineType.trim(),
        amount: Number(newCustomFineAmount)
      };

      // Check if it already exists
      if (currentTypes.some((t: any) => t.name.toLowerCase() === newType.name.toLowerCase())) {
        toast.error("This fine type already exists");
        return;
      }

      const updatedTypes = [...currentTypes, newType];
      await upsertSetting("custom_fine_types", JSON.stringify(updatedTypes));
      
      setNewCustomFineType("");
      setNewCustomFineAmount("");
      toast.success("Custom fine type added successfully");
    } catch (err: any) {
      console.error("Error adding custom fine type:", err);
      toast.error("Failed to add custom fine type");
    }
  };

  const handleRemoveCustomFineType = async (typeName: string) => {
    try {
      const currentTypesStr = settings.custom_fine_types || "[]";
      const currentTypes = JSON.parse(currentTypesStr);
      
      const updatedTypes = currentTypes.filter((t: any) => t.name !== typeName);
      await upsertSetting("custom_fine_types", JSON.stringify(updatedTypes));
      
      toast.success("Custom fine type removed");
    } catch (err: any) {
      console.error("Error removing custom fine type:", err);
      toast.error("Failed to remove custom fine type");
    }
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <Link 
          to={user.role === "admin" ? "/dashboard" : "/student-dashboard"} 
          className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-2 w-fit"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Dashboard</span>
        </Link>
        
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">My Profile</h1>
          <p className="text-muted-foreground">Manage your account information and preferences.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* User Profile Card */}
          <Card className="md:col-span-1 h-fit">
            <CardContent className="pt-8 flex flex-col items-center text-center">
              <div className="relative group mb-4">
                <Avatar 
                  key={user.avatarUrl || 'no-avatar'} 
                  className="h-32 w-32 ring-4 ring-primary/10 transition-transform group-hover:scale-105"
                >
                  {user.avatarUrl && (
                    <AvatarImage 
                      src={`${user.avatarUrl}${user.avatarUrl.includes('?') ? '&' : '?'}t=${new Date().getTime()}`} 
                      alt={user.name || user.email} 
                      className="object-cover"
                    />
                  )}
                  <AvatarFallback className="text-3xl bg-primary/10 text-primary font-bold">
                    {(user.name || user.email.split("@")[0]).slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 rounded-full cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  {uploading ? <Loader2 className="h-8 w-8 text-white animate-spin" /> : <Camera className="h-8 w-8 text-white" />}
                </div>
                
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handleAvatarUpload}
                  disabled={uploading}
                />
              </div>

              {user.avatarUrl && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 mb-2"
                  onClick={removeAvatar}
                  disabled={uploading}
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Remove Photo
                </Button>
              )}

              <h2 className="text-xl font-bold text-foreground">{user.name || "User"}</h2>
              <p className="text-sm text-primary font-medium px-2 py-0.5 bg-primary/10 rounded-full mt-1">
                {user.role === "admin" ? "CSC Officer / Admin" : user.role === "student" ? "Student" : "Authenticated User"}
              </p>
              
              <div className="w-full mt-6 pt-6 border-t border-border flex flex-col gap-3">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <span className="truncate">{user.email}</span>
                </div>
                {(user.studentCode || user.studentId) && (
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <GraduationCap className="h-4 w-4" />
                    <span>ID: {user.studentCode || user.studentId}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Shield className="h-4 w-4" />
                  <span>Role: {user.role ? (user.role.charAt(0).toUpperCase() + user.role.slice(1)) : "Member"}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Account Details */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Account Details</CardTitle>
              <CardDescription>Detailed information about your Hub account.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Display Name</label>
                  <div className="p-3 bg-muted/50 rounded-lg border border-border flex items-center gap-3">
                    <User className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">{user.name || "Not set"}</span>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email Address</label>
                  <div className="p-3 bg-muted/50 rounded-lg border border-border flex items-center gap-3">
                    <Mail className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">{user.email}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Account Role</label>
                  <div className="p-3 bg-muted/50 rounded-lg border border-border flex items-center gap-3">
                    <Shield className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">{user.role ? user.role.toUpperCase() : "AUTHENTICATED"}</span>
                  </div>
                </div>

                {(user.studentCode || user.studentId) && (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Student ID Number</label>
                    <div className="p-3 bg-muted/50 rounded-lg border border-border flex items-center gap-3">
                      <GraduationCap className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">{user.studentCode || user.studentId}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-6 border-t border-border">
                <div className="flex items-start gap-4 p-4 rounded-xl bg-primary/5 border border-primary/10">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Clock className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-primary">Session Security</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Your session is protected by end-to-end encryption. To maintain security, always sign out when using shared devices.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {user.role === "student" && (
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Edit Student Details</CardTitle>
                <CardDescription>Update the personal details attached to your student account.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveStudentProfile} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="studentProfileName">Name</Label>
                      <Input
                        id="studentProfileName"
                        value={studentProfile.name}
                        onChange={(event) => setStudentProfile((profile) => ({ ...profile, name: event.target.value }))}
                        maxLength={255}
                        disabled={loadingStudentProfile || savingStudentProfile}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="studentProfileAge">Age</Label>
                      <Input
                        id="studentProfileAge"
                        type="number"
                        min={15}
                        max={100}
                        value={studentProfile.age}
                        onChange={(event) => setStudentProfile((profile) => ({ ...profile, age: event.target.value }))}
                        disabled={loadingStudentProfile || savingStudentProfile}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="studentProfileGender">Gender</Label>
                      <select
                        id="studentProfileGender"
                        value={studentProfile.gender}
                        onChange={(event) => setStudentProfile((profile) => ({ ...profile, gender: event.target.value }))}
                        disabled={loadingStudentProfile || savingStudentProfile}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        {GENDERS.map((gender) => <option key={gender} value={gender}>{gender}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="studentProfileAddress">Address</Label>
                      <Input
                        id="studentProfileAddress"
                        value={studentProfile.address}
                        onChange={(event) => setStudentProfile((profile) => ({ ...profile, address: event.target.value }))}
                        maxLength={500}
                        disabled={loadingStudentProfile || savingStudentProfile}
                      />
                    </div>
                  </div>
                  <Button type="submit" disabled={loadingStudentProfile || savingStudentProfile}>
                    {savingStudentProfile ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                    Save Details
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Change Password */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>Confirm your current password to set a new one.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <Label htmlFor="oldPassword">Current Password</Label>
                  <div className="relative mt-2">
                    <Input
                      id="oldPassword"
                      type={showOldPassword ? "text" : "password"}
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      placeholder="Enter current password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowOldPassword(!showOldPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showOldPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="newPassword">New Password</Label>
                    <div className="relative mt-2">
                      <Input
                        id="newPassword"
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <div className="relative mt-2">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={changing}>
                  {changing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Change Password
                </Button>
              </form>
            </CardContent>
          </Card>

          {user.role === "admin" && (
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Admin Settings</CardTitle>
                <CardDescription>Manage payment QR code and custom fine types.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* Payment QR Code Section */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold border-b pb-2">Payment Configuration</h3>
                  <div className="space-y-2">
                    <Label>Payment QR Code</Label>
                    <div className="flex items-center gap-4">
                      <div className="w-40 h-40 border rounded-lg bg-muted/50 flex items-center justify-center overflow-hidden">
                        {settings.payment_qr_url ? (
                          <img
                            src={settings.payment_qr_url}
                            alt="Payment QR"
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <QrCode className="h-16 w-16 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => qrFileInputRef.current?.click()}
                        >
                          Upload New QR
                        </Button>
                        <input
                          ref={qrFileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handlePaymentQrUpload}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Students will see this code when paying via QR.
                    </p>
                  </div>
                </div>

                {/* Custom Fine Types Section */}
                <div className="space-y-4 pt-4">
                  <h3 className="text-sm font-semibold border-b pb-2">Custom Fine Types</h3>
                  <div className="space-y-4">
                    <div className="flex gap-4 items-end">
                      <div className="flex-1 space-y-2">
                        <Label htmlFor="fineType">Fine Name</Label>
                        <Input 
                          id="fineType" 
                          placeholder="e.g. Lost Book" 
                          value={newCustomFineType}
                          onChange={(e) => setNewCustomFineType(e.target.value)}
                        />
                      </div>
                      <div className="w-32 space-y-2">
                        <Label htmlFor="fineAmount">Amount (₱)</Label>
                        <Input 
                          id="fineAmount" 
                          type="number" 
                          min="1" 
                          placeholder="0.00" 
                          value={newCustomFineAmount}
                          onChange={(e) => setNewCustomFineAmount(e.target.value)}
                        />
                      </div>
                      <Button type="button" onClick={handleAddCustomFineType}>
                        Add Type
                      </Button>
                    </div>

                    <div className="border rounded-md divide-y">
                      {(() => {
                        const typesStr = settings.custom_fine_types || "[]";
                        const types = JSON.parse(typesStr);
                        
                        if (types.length === 0) {
                          return (
                            <div className="p-4 text-sm text-center text-muted-foreground">
                              No custom fine types added yet.
                            </div>
                          );
                        }

                        return types.map((type: any, index: number) => (
                          <div key={index} className="flex justify-between items-center p-3">
                            <div>
                              <span className="font-medium">{type.name}</span>
                              <span className="text-muted-foreground ml-2 text-sm">₱{type.amount}</span>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleRemoveCustomFineType(type.name)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                </div>

              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
