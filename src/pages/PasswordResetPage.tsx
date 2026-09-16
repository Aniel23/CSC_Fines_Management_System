import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function PasswordResetPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    const checkRecoverySession = async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const tokenHash = url.searchParams.get("token_hash");
      const type = url.searchParams.get("type");

      if (code) {
        await supabase.auth.exchangeCodeForSession(code);
      } else if (tokenHash && type === "recovery") {
        await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash });
      }

      const { data, error } = await supabase.auth.getSession();
      if (!active) return;

      setReady(Boolean(data.session) && !error);
      setCheckingSession(false);
    };

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;

      if (event === "PASSWORD_RECOVERY" || session) {
        setReady(Boolean(session));
        setCheckingSession(false);
      }
    });

    checkRecoverySession().catch(() => {
      if (active) setCheckingSession(false);
    });

    const timeout = window.setTimeout(() => {
      if (active) setCheckingSession(false);
    }, 5000);

    return () => {
      active = false;
      window.clearTimeout(timeout);
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setSaving(true);
    try {
      const updateRequest = supabase.auth.updateUser({ password });
      const timeout = new Promise<{ error: Error }>((resolve) => {
        window.setTimeout(() => resolve({ error: new Error("Password update timed out. Please request a new reset link and try again.") }), 15000);
      });
      const { error } = await Promise.race([updateRequest, timeout]);

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Password updated successfully");
      void supabase.auth.signOut();
      navigate("/", { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update password");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Set a new password</CardTitle>
        </CardHeader>
        <CardContent>
          {checkingSession ? (
            <p className="text-sm text-muted-foreground">Verifying your reset link...</p>
          ) : !ready ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">This reset link is invalid or has expired.</p>
              <Button type="button" variant="outline" onClick={() => navigate("/")}>
                Return to login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={6}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Hide new password" : "Show new password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm password</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    minLength={6}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((visible) => !visible)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showConfirmPassword ? "Hide confirmed password" : "Show confirmed password"}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? "Updating..." : "Update password"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}