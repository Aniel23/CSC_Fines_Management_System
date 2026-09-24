import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { PublicNavbar } from "@/components/layout/PublicNavbar";
import { supabase } from "@/integrations/supabase/client";
import { getPublicDepartments } from "@/integrations/supabase/queries";
import { GENDERS as genders } from "@/lib/constants";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const normalizeWhitespace = (value: string) => value.trim().replace(/\s+/g, " ");
const normalizeEmail = (value: string) => value.trim().replace(/\s+/g, "").toLowerCase();
const namePattern = /^[\p{L}][\p{L}.' -]*$/u;

export default function RegisterPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  
  const [step, setStep] = useState<"check" | "register">("check");
  const [checking, setChecking] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [alreadyRegisteredOpen, setAlreadyRegisteredOpen] = useState(false);
  
  // Form State
  const [studentId, setStudentId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Student Details (if not found)
  const [name, setName] = useState("");
  const [age, setAge] = useState<number | "">("");
  const [gender, setGender] = useState<string>("Male");
  const [address, setAddress] = useState<string>("");
  // departmentId = departments.id (UUID), departmentName = departments.name (display)
  const [departmentId, setDepartmentId] = useState<string>("");
  const [departmentName, setDepartmentName] = useState<string>("");
  
  // Found Student State
  const [existingStudent, setExistingStudent] = useState<{ id: string, name: string } | null>(null);
  
  // Departments from DB: {id, name}[]
  const [dbDepartments, setDbDepartments] = useState<{ id: string; name: string }[]>([]);

  // Load departments from DB
  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const depts = await getPublicDepartments();
        setDbDepartments(depts);
      } catch (error) {
        console.error("Failed to load departments", error);
        setDbDepartments([]);
      }
    };
    loadDepartments();
  }, []);

  // Redirect if logged in
  useEffect(() => {
    if (!authLoading && user) {
      navigate(user.role === "admin" ? "/dashboard" : "/student-dashboard");
    }
  }, [authLoading, user, navigate]);

  const checkStudentId = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId.trim()) {
      toast.error("Please enter your Student ID");
      return;
    }

    setChecking(true);
    try {
      setExistingStudent(null);

      // Find the enrolled student record before checking account ownership.
      const { data: student, error: studentError } = await supabase
        .from("students")
        .select("id, name")
        .eq("student_id", studentId.trim())
        .maybeSingle();

      if (studentError) throw studentError;

      if (student) {
        // Check server-side because anonymous visitors cannot reliably query auth users.
        const { data: hasAuthAccount, error: authCheckError } = await supabase.rpc("has_student_auth_account", {
          p_student_id: studentId.trim(),
        });

        if (authCheckError) throw authCheckError;

        if (hasAuthAccount === true) {
          toast.error("This Student ID already has an account. Please log in instead.");
          navigate("/");
          return;
        }

        setExistingStudent(student);
        toast.info(`Welcome back, ${student.name}. Please set your password.`);
        setStep("register");
      } else {
        setExistingStudent(null);
        toast.error("Student ID not found in the database. Please contact the administrator for help.");
        setStep("check");
        return;
      }
    } catch (error: unknown) {
      console.error("Check failed:", error);
      toast.error("Failed to verify Student ID. Please try again.");
    } finally {
      setChecking(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!existingStudent) {
      toast.error("Student ID not found in the database. Please contact the administrator for help.");
      setStep("check");
      return;
    }

    const normalizedName = normalizeWhitespace(name);
    const normalizedAddress = normalizeWhitespace(address);
    const normalizedEmail = normalizeEmail(email);

    if (!existingStudent && (!normalizedName || normalizedName.length > 255 || !namePattern.test(normalizedName))) {
      toast.error("Please enter a valid name using letters, spaces, apostrophes, periods, or hyphens");
      return;
    }

    if (!existingStudent && (!normalizedAddress || normalizedAddress.length > 500)) {
      toast.error("Please enter a valid address up to 500 characters");
      return;
    }
    
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || normalizedEmail.length > 255) {
      toast.error("Please enter a valid email address");
      return;
    }

    if (!existingStudent) {
      if (!name || !age || !departmentId || !address.trim()) {
        toast.error("Please fill in all required fields");
        return;
      }
    }
    setRegistering(true);
    try {
      // Create the auth user and profile together in the Edge Function so a
      // failed profile write cannot leave an unusable auth account behind.
      const { data: registrationData, error: registrationError } = await supabase.functions.invoke("register-student", {
        body: {
          student_id: studentId.trim(),
          name: existingStudent ? existingStudent.name : normalizedName,
          age: existingStudent ? 0 : Number(age),
          gender: existingStudent ? "Male" : gender,
          department: existingStudent ? "" : departmentName,
          department_id: existingStudent ? null : departmentId,
          address: existingStudent ? null : normalizedAddress,
          email: normalizedEmail,
          password,
        },
      });

      if (registrationError) {
        const msg = registrationError.message?.toLowerCase() || "";
        if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
          toast.error("This Student ID already has an account. Please log in instead.");
          navigate("/");
          return;
        }
        throw registrationError;
      }

      if (!registrationData?.user) throw new Error("Registration failed");

      toast.success("Registration successful! Please sign in.");
      navigate("/");
    } catch (error: unknown) {
      console.error("Registration error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to register. Please try again.");
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden bg-background">
      <PublicNavbar />
      
      {/* Background Elements (Same as LoginPage) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage:
            "url('/csc-logo.png'), url('/csc-logo.jpg'), url('/colegio%20de%20naujan%20logo%20csc.jpg'), url('/csc_logo.png'), url('/logo.png'), url('/logo.jpg'), url('/logo.webp'), url('/placeholder.svg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          filter: "blur(10px)",
          opacity: 0.25,
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--bg-gradient-from))] via-[hsl(var(--bg-gradient-via))] to-[hsl(var(--bg-gradient-to))] transition-colors duration-500" />
      <img
        src="/csc-logo.png"
        alt="CSC Watermark"
        className="pointer-events-none select-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.1] dark:opacity-[0.15] transition-opacity duration-500"
        style={{ width: "min(48vmin, 420px)" }}
        onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/csc-logo.jpg'; }}
      />

      <div className="w-full max-w-md px-4 relative z-10">
        <div className="mb-6">
          <Link to="/">
            <Button variant="outline" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Login
            </Button>
          </Link>
        </div>

        <Card className="bg-card/40 border-border backdrop-blur-xl shadow-2xl rounded-2xl overflow-hidden">
          <CardContent>
            <div className="p-8">
              <div className="flex flex-col items-center text-center gap-4 mb-8">
                <img
                  src="/csc-logo.png"
                  alt="CSC Logo"
                  className="w-16 h-16 rounded-xl bg-card p-1.5 shadow-lg"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/csc-logo.jpg'; }}
                />
                <div>
                  <h2 className="text-foreground text-2xl font-bold tracking-tight">Student Registration</h2>
                  <p className="text-sm text-muted-foreground mt-1">Create your account to manage fines</p>
                </div>
              </div>

              {step === "check" ? (
                <form onSubmit={checkStudentId} className="grid gap-4">
                  <div>
                    <Label className="text-foreground/90">Student ID</Label>
                    <Input
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value)}
                      placeholder="e.g. 2024-00001"
                      className="mt-2 bg-background/50"
                      disabled={checking}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={checking}>
                    {checking ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Next
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleRegister} className="grid gap-4">
                  <div className="p-3 bg-primary/10 rounded-lg border border-primary/20 mb-2">
                    <Label className="text-xs text-muted-foreground uppercase font-bold">Registering as</Label>
                    <div className="font-mono text-lg font-bold text-primary">{studentId}</div>
                  </div>

                  {existingStudent ? (
                    <div>
                      <Label className="text-foreground/90">Name</Label>
                      <Input value={existingStudent.name} disabled className="mt-2 bg-muted" />
                      <p className="text-xs text-muted-foreground mt-1">Match found in records.</p>
                    </div>
                  ) : (
                    <>
                      <div>
                        <Label className="text-foreground/90">Full Name</Label>
                        <Input
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Juan Dela Cruz"
                          className="mt-2 bg-background/50"
                          required
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-foreground/90">Age</Label>
                          <Input
                            type="number"
                            value={age}
                            onChange={(e) => setAge(e.target.value ? Number(e.target.value) : "")}
                            className="mt-2 bg-background/50"
                            required
                            min={15}
                          />
                        </div>
                        <div>
                          <Label className="text-foreground/90">Gender</Label>
                          <Select value={gender} onValueChange={setGender}>
                            <SelectTrigger className="mt-2 bg-background/50">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {genders.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <Label className="text-foreground/90">Department</Label>
                        <Select
                          value={departmentId}
                          onValueChange={(id) => {
                            setDepartmentId(id);
                            setDepartmentName(dbDepartments.find(d => d.id === id)?.name ?? "");
                          }}
                        >
                          <SelectTrigger className="mt-2 bg-background/50">
                            <SelectValue placeholder="Select Department" />
                          </SelectTrigger>
                          <SelectContent>
                            {dbDepartments.length === 0 ? (
                              <div className="px-3 py-2 text-sm text-muted-foreground">No departments available</div>
                            ) : (
                              dbDepartments.map(d => (
                                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-foreground/90">Address</Label>
                        <Input
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          placeholder="123 Main Street, Barangay, City"
                          className="mt-2 bg-background/50"
                          required
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <Label className="text-foreground/90">Email Address</Label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="juan.delacruz@example.com"
                      className="mt-2 bg-background/50"
                      required
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      This email will be used for login and password recovery.
                    </p>
                  </div>

                  <div className="space-y-4 pt-2 border-t border-border/50">
                    <div>
                      <Label className="text-foreground/90">Password</Label>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Create a password"
                          className="mt-2 bg-background/50 pr-10"
                          required
                          minLength={6}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          tabIndex={-1}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <Label className="text-foreground/90">Confirm Password</Label>
                      <div className="relative">
                        <Input
                          type={showConfirmPassword ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Confirm your password"
                          className="mt-2 bg-background/50 pr-10"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          tabIndex={-1}
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-2">
                    <Button type="button" variant="outline" onClick={() => setStep("check")} disabled={registering}>
                      Back
                    </Button>
                    <Button type="submit" className="flex-1" disabled={registering}>
                      {registering ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Register
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      <Dialog open={alreadyRegisteredOpen} onOpenChange={setAlreadyRegisteredOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Account Already Exists</DialogTitle>
            <DialogDescription>
              This Student ID already has an account. Please contact the administrator to reset your password.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-end">
            <Button variant="outline" onClick={() => navigate("/")}>
              Back to Login
            </Button>
            <Button onClick={() => navigate("/contact-admin")}>
              Contact Admin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
