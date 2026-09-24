import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type User = {
  id: string;
  email: string;
  name?: string;
  role?: "admin" | "student";
  studentId?: string;
  studentCode?: string;
  avatarUrl?: string;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  metadataLoading: boolean;
  authenticating: boolean;
  login: (email: string, password: string) => Promise<"admin" | "student" | undefined>;
  loginStudent: (studentId: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  signup: (email: string, password: string, name: string, role: "admin" | "student") => Promise<void>;
  refreshUserData: () => Promise<void>;
  lastVisitedPage: string | null;
  updateLastVisitedPage: (path: string) => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const [lastVisitedPage, setLastVisitedPage] = useState<string | null>(null);
  const location = useLocation();

  const purgeStaleSupabaseSessions = () => {
    try {
      const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
      if (!url) return;
      
      // Use URL parsing carefully
      let host = "";
      try {
        host = new URL(url).hostname;
      } catch {
        // If URL is invalid (like in local dev), try a simpler approach
        if (url.includes("localhost")) host = "localhost";
        else if (url.includes("127.0.0.1")) host = "127.0.0.1";
        else return; // give up
      }
      
      const currentRef = host.split(".")[0];
      if (!currentRef) return;
      
      const prefix = `sb-${currentRef}`;
      const removeMismatchedKeys = (storage: Storage) => {
        const keysToRemove: string[] = [];
        for (let i = 0; i < storage.length; i++) {
          const k = storage.key(i);
          if (!k) continue;
          // Only remove Supabase keys that definitely don't belong to this project
          // and aren't the generic 'sb-localhost'
          if (k.startsWith("sb-") && !k.startsWith(prefix) && !k.includes("localhost")) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach((k) => {
          console.log(`[Auth] Purging stale storage key: ${k}`);
          storage.removeItem(k);
        });
      };
      removeMismatchedKeys(localStorage);
      removeMismatchedKeys(sessionStorage);
    } catch (err) {
      console.warn("[Auth] Failed to purge stale sessions:", err);
    }
  };

  const updateLastVisitedPage = (path: string) => {
    if (user && path !== "/" && !path.startsWith("/login") && !path.startsWith("/auth")) {
      try {
        localStorage.setItem("lastVisitedPage", path);
        setLastVisitedPage(path);
      } catch (err) {
      }
    }
  };

  useEffect(() => {
    if (user) {
      updateLastVisitedPage(location.pathname);
    }
  }, [location.pathname, user]);

  useEffect(() => {
    // FAILSAFE: Force loading to false after 5 seconds no matter what.
    // This prevents the user from being stuck on the splash screen if Supabase or network hangs.
    const failsafe = setTimeout(() => {
      if (loading) {
        setLoading(false);
      }
    }, 5000);

    const initAuth = async () => {
      try {
        // Use a race to prevent getSession from hanging indefinitely
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise<{ data: { session: null } }>((resolve) => 
          setTimeout(() => resolve({ data: { session: null } }), 3000)
        );

        const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]);

        if (session?.user) {
          console.log("[Auth] Local session found, identifying user...");
          // We set basic user state immediately so RequireAuth doesn't kick them out
          const baseName = session.user.email?.split("@")[0] || "User";
          setUser({ id: session.user.id, email: session.user.email || "", name: baseName });
          
          // Release loading screen immediately after basic identification
          setLoading(false);
          clearTimeout(failsafe);

          // Fetch full metadata (role, photo) in the background without blocking
          loadUserData(session.user.id, session.user.email || "");
        } else {
          console.log("[Auth] No local session found.");
          setLoading(false);
          clearTimeout(failsafe);
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
        setLoading(false);
        clearTimeout(failsafe);
      }
    };

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
        setUser(null);
        setLastVisitedPage(null);
        loadedUserId.current = null;
        try {
          localStorage.removeItem("lastVisitedPage");
        } catch (err) {
        }
        setLoading(false); // Just in case
        return;
      }

      if (session?.user) {
        // Background load user data
        loadUserData(session.user.id, session.user.email || "");
      }
    });

    return () => {
      subscription?.unsubscribe();
      clearTimeout(failsafe);
    };
  }, []); // Only run once on mount

  // Heartbeat in a separate effect
  useEffect(() => {
    if (!user) return;

    const heartbeatInterval = setInterval(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setUser(null);
        setLoading(false);
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(heartbeatInterval);
  }, [user]);

  const loadedUserId = useRef<string | null>(null);
  const loadingUserData = useRef<string | null>(null);

  const withTimeout = async <T,>(promise: Promise<T>, ms = 30000, message = "Request timed out") => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(message)), ms);
    });

    try {
      const result = await Promise.race([promise as Promise<T>, timeout]);
      if (timeoutId) clearTimeout(timeoutId);
      return result as T;
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId);
      throw err;
    }
  };

  const loadUserData = async (userId: string, email: string, preloadedStudentId?: string, force = false) => {
    if (!force && loadedUserId.current === userId && user) {
      return;
    }
    
    // Prevent concurrent loads for the same user
    if (loadingUserData.current === userId && !force) {
      return;
    }
    
    loadingUserData.current = userId;
    setMetadataLoading(true);
    console.log("[loadUserData] Loading data for:", userId);

    // Step 1: Set basic user state immediately so the UI can render
    // This prevents the "stuck on loading" issue if the database is slow.
    const baseName = email.split("@")[0];
    const initialUser: User = { id: userId, email, name: baseName };
    
    // Only update if it's a new user or forced
    if (!user || user.id !== userId || force) {
      setUser(initialUser);
    }

    // Step 2: Fetch additional metadata (role, avatar, student info) in the background
    try {
      let currentName = baseName;
      let studentId: string | undefined = preloadedStudentId;
      let studentCode: string | undefined;
      let avatarUrl: string | undefined = undefined;
      let roleData: { role: "admin" | "student"; student_id: string | null; avatar_url: string | null } | null = null;

      // Fetch user role data
      const { data, error: roleError } = await supabase
        .from("user_roles")
        .select("role, student_id, avatar_url")
        .eq("user_id", userId)
        .maybeSingle();
      
      if (!roleError && data) {
        roleData = data;
        studentId = preloadedStudentId || roleData.student_id || undefined;
        avatarUrl = roleData.avatar_url || undefined;
        const role = roleData.role as "admin" | "student";

        if (role === "student" && studentId) {
          const { data: student, error: studentError } = await supabase
            .from("students")
            .select("student_id, name")
            .eq("id", studentId)
            .maybeSingle();

          if (!studentError && student) {
            currentName = (student as { name?: string } | null)?.name || currentName;
            studentCode = (student as { student_id?: string } | null)?.student_id;
          }
        }

        // Enrich the user state with fetched metadata
        setUser({ id: userId, email, role, name: currentName, studentId, studentCode, avatarUrl });
      }
      
      loadedUserId.current = userId;
    } catch (error) {
    } finally {
      loadingUserData.current = null;
      setMetadataLoading(false);
    }
  };

  const refreshUserData = async () => {
    if (user) {
      await loadUserData(user.id, user.email, user.studentId, true);
    }
  };

  const login = async (email: string, password: string) => {
    setAuthenticating(true);
    try {
      purgeStaleSupabaseSessions();
      
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        throw error;
      }

      if (data?.user) {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", data.user.id)
          .maybeSingle();
        await loadUserData(data.user.id, data.user.email || "");
        return roleData?.role as "admin" | "student" | undefined;
      }
      return undefined;
    } catch (error: unknown) {
      console.error("login caught:", error);
      throw error;
    } finally {
      setAuthenticating(false);
    }
  };

  const loginStudent = async (studentId: string, password: string) => {
    setAuthenticating(true);
    try {
      purgeStaleSupabaseSessions();
      const trimmedStudentId = studentId.trim().replace(/\s+/g, "");
      const { data: registeredEmail, error: lookupError } = await supabase.rpc("get_student_auth_email", {
        p_student_id: trimmedStudentId,
      });

      // Fall back to the students table when the new RPC has not been deployed yet.
      let studentEmail = registeredEmail;
      if (!studentEmail && lookupError) {
        console.warn("Student email RPC unavailable; using direct student lookup.", lookupError.message);
        const { data: student } = await supabase
          .from("students")
          .select("email")
          .eq("student_id", trimmedStudentId)
          .maybeSingle();
        studentEmail = student?.email || null;
      }

      // Keep legacy accounts working until their synthetic email is migrated.
      studentEmail = studentEmail || `${trimmedStudentId}@student.local`;
      
      // Attempt sign in directly
      const { data, error } = await supabase.auth.signInWithPassword({ 
        email: studentEmail, 
        password 
      });

      if (error) {
        throw error;
      }

      if (data?.user) {
        // Fetch student details AFTER successful login
        // We can find the student record linked to this user
        await loadUserData(data.user.id, data.user.email || studentEmail);
      }
    } catch (error: unknown) {
      throw error;
    } finally {
      setAuthenticating(false);
    }
  };

  const signup = async (email: string, password: string, name: string, role: "admin" | "student") => {
    setAuthenticating(true);
    try {
      const { data, error } = await withTimeout(supabase.auth.signUp({ email, password }), 45000, "Network timeout during signup");

      if (error) throw error;

      if (data.user) {
        const { error: roleError } = await supabase.from("user_roles").insert({
          user_id: data.user.id,
          role,
        });

        if (roleError) throw roleError;

        await loadUserData(data.user.id, email);
        toast.success("Account created successfully");
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Sign up failed";
      toast.error(msg);
      throw error;
    } finally {
      setAuthenticating(false);
    }
  };

  const logout = async () => {
    setAuthenticating(true);
    try {
      const { error } = await withTimeout(supabase.auth.signOut(), 20000, "Network timeout during sign out");
      if (error) throw error;
      setUser(null);
      setLastVisitedPage(null);
      try {
        localStorage.removeItem("lastVisitedPage");
      } catch (err) {
      }
      toast.success("Signed out successfully");
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Sign out failed";
      toast.error(msg);
      throw error;
    } finally {
      setAuthenticating(false);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      metadataLoading,
      authenticating, 
      login, 
      loginStudent, 
      logout, 
      signup,
      refreshUserData,
      lastVisitedPage,
      updateLastVisitedPage
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-muted-foreground animate-pulse">Initializing Hub...</p>
      </div>
    );
  }
  
  if (!user) return <Navigate to="/" replace />;
  
  return <>{children}</>;
}

export default AuthContext;
