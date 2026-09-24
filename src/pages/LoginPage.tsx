import { useState, useEffect } from "react";
import { useNavigate, Link, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Info, Loader2, Eye, EyeOff, KeyRound, Mail } from "lucide-react";
import { toast } from "sonner";
import { PublicNavbar } from "@/components/layout/PublicNavbar";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export default function LoginPage() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [showForgotPasswordDialog, setShowForgotPasswordDialog] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [sendingRecovery, setSendingRecovery] = useState(false);
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      return document.documentElement.classList.contains("dark");
    } catch {
      return false;
    }
  });

  const { login, loginStudent, authenticating, user, loading, lastVisitedPage } = useAuth();

  // If already logged in, redirect away from login page
  if (!loading && user) {
    const target = lastVisitedPage || (user.role === "admin" ? "/dashboard" : "/student-dashboard");
    return <Navigate to={target} replace />;
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!identifier) {
      toast.error("Please provide email or student ID");
      return;
    }

    try {
      localStorage.setItem("sb-remember", remember ? "true" : "false");
    } catch {
      // ignore storage errors
    }

    // Check if it's a student email (ends with @student.local) or a regular email
    const normalizedIdentifier = identifier.trim();
    const isStudentEmail = normalizedIdentifier.toLowerCase().endsWith("@student.local");
    const looksLikeRegularEmail = normalizedIdentifier.includes("@") && !isStudentEmail;

    if (looksLikeRegularEmail) {
      // Admin login with regular email
      if (!password) {
        toast.error("Please provide password for admin login");
        return;
      }
      try {
        const role = await login(normalizedIdentifier, password);
        toast.success("Signed in");
        navigate(role === "student" ? "/student-dashboard" : "/dashboard");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Sign in failed";
        toast.error(msg);
      }
    } else if (isStudentEmail) {
      // Legacy student accounts used the synthetic student.local address.
      const studentIdFromEmail = normalizedIdentifier.replace(/@student\.local$/i, "");
      if (!password) {
        toast.error("Password is required for student login");
        return;
      }
      try {
        await loginStudent(studentIdFromEmail, password);
        toast.success("Signed in as student");
        navigate("/student-dashboard");
      } catch (err: unknown) {
        const msg = err instanceof Error && err.message.includes("Invalid login credentials")
          ? "Invalid Student ID or Password"
          : err instanceof Error ? err.message : "Student sign in failed";
        toast.error(msg);
      }
    } else {
      // Treat identifier as student id (no @ symbol). Password is required for privacy.
      if (!password) {
        toast.error("Password is required for student login");
        return;
      }

      try {
        await loginStudent(normalizedIdentifier, password);
        toast.success("Signed in as student");
        navigate("/student-dashboard");
      } catch (err: unknown) {
        const msg = err instanceof Error && err.message.includes("Invalid login credentials")
          ? "Invalid Student ID or Password"
          : err instanceof Error ? err.message : "Student sign in failed";
        toast.error(msg);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-muted-foreground animate-pulse">Initializing Hub...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden bg-background">
      <PublicNavbar />
      
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
          opacity: isDark ? 0.35 : 0.25,
        }}
      />
      <div
        className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--bg-gradient-from))] via-[hsl(var(--bg-gradient-via))] to-[hsl(var(--bg-gradient-to))] transition-colors duration-500"
      />
      <img
        src="/csc-logo.png"
        alt="CSC Watermark"
        className="pointer-events-none select-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.1] dark:opacity-[0.15] transition-opacity duration-500"
        style={{ width: "min(64vmin, 560px)" }}
        onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/csc-logo.jpg'; }}
      />

      <div className="w-full max-w-md px-4 relative z-10">
        <Card className="bg-card/40 border-border backdrop-blur-xl shadow-2xl rounded-2xl overflow-hidden">
          <CardContent>
            <div className="p-8">
              <div className="flex flex-col items-center text-center gap-4 mb-8">
                <img
                  src="/csc-logo.png"
                  alt="CSC Logo"
                  className="w-20 h-20 rounded-xl bg-card p-1.5 shadow-lg"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/csc-logo.jpg'; }}
                />
                <div>
                  <h2 className="text-foreground text-2xl font-bold tracking-tight">CSC Fines Management System</h2>
                  <p className="text-sm text-muted-foreground mt-1">Sign in to your account to continue</p>
                </div>
              </div>

              <form onSubmit={onSubmit} className="grid gap-4">
                <div>
                  <Label className="text-foreground/90">Email or Student ID</Label>
                  <Input
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="you@school.edu or 2024-00001"
                    type="text"
                    className="mt-2 bg-background/50 border-border text-foreground placeholder:text-muted-foreground/60"
                    disabled={authenticating}
                  />
                </div>

                <div>
                  <Label className="text-foreground/90">Password</Label>
                  <div className="relative">
                    <Input
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      type={showPassword ? "text" : "password"}
                      className="mt-2 bg-background/50 border-border text-foreground placeholder:text-muted-foreground/60 pr-10"
                      disabled={authenticating}
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

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-foreground/90 cursor-pointer">
                    <Checkbox checked={remember} onCheckedChange={(v) => setRemember(Boolean(v))} />
                    <span className="text-sm">Remember me</span>
                  </label>
                  <button 
                    type="button"
                    onClick={() => setShowForgotPasswordDialog(true)}
                    className="text-primary font-medium underline-offset-4 hover:underline transition-colors bg-transparent border-0 p-0 text-sm"
                  >
                    Forgot Password?
                  </button>
                </div>

                <div>
                  <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20" disabled={authenticating}>
                    {authenticating ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Signing in...
                      </span>
                    ) : (
                      "Sign In"
                    )}
                  </Button>
                </div>

                <div className="text-center text-sm text-muted-foreground">
                  Don't have an account? <Link to="/register" className="text-primary font-medium underline-offset-4 hover:underline transition-colors">Register</Link>
                </div>
                <div className="text-center text-sm text-muted-foreground mt-2">
                  Need help? <Link to="/contact-admin" className="text-primary font-medium underline-offset-4 hover:underline transition-colors">Contact Admin</Link>
                </div>
              </form>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showForgotPasswordDialog} onOpenChange={setShowForgotPasswordDialog}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden">
          <div className="bg-primary/10 px-6 py-5 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <KeyRound className="h-5 w-5" />
              </div>
              <DialogHeader className="space-y-1 text-left">
                <DialogTitle className="text-xl">Reset your password</DialogTitle>
                <DialogDescription>
                  We will send a secure reset link to your account email.
                </DialogDescription>
              </DialogHeader>
            </div>
          </div>

          <div className="space-y-5 px-6 py-6">
            <div className="space-y-2">
              <Label htmlFor="recovery-email" className="text-sm font-medium">
                Account email
              </Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="recovery-email"
                  type="email"
                  placeholder="you@example.com"
                  value={recoveryEmail}
                  onChange={(e) => setRecoveryEmail(e.target.value)}
                  disabled={sendingRecovery}
                  autoComplete="email"
                  className="h-11 pl-10"
                />
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Use the email you entered during registration.
              </p>
            </div>

            <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowForgotPasswordDialog(false)}
                disabled={sendingRecovery}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                disabled={sendingRecovery}
                className="w-full sm:w-auto"
                onClick={async () => {
                  if (!recoveryEmail.trim()) {
                    toast.error("Please enter your email address");
                    return;
                  }
                  setSendingRecovery(true);
                  const { error } = await supabase.auth.resetPasswordForEmail(recoveryEmail.trim().toLowerCase(), {
                    redirectTo: `${window.location.origin}/reset-password`,
                  });
                  setSendingRecovery(false);
                  if (error) {
                    toast.error(error.message);
                    return;
                  }
                  toast.success("Password reset link sent. Check your email.");
                  setShowForgotPasswordDialog(false);
                }}
              >
                {sendingRecovery ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending link...
                  </>
                ) : (
                  "Send reset link"
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Floating Action Button for About CSC */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button 
          onClick={() => navigate("/about")} 
          className="rounded-full h-12 w-12 shadow-lg bg-primary hover:bg-primary/90 transition-all hover:scale-105"
          size="icon"
          title="About CSC"
        >
          <Info className="h-6 w-6" />
        </Button>
      </div>
    </div>
  );
}

