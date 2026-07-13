import { useState, useEffect } from "react";
import { AppSidebar } from "./AppSidebar";
import { Menu, Sun, Moon, User, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { NotificationsMenu } from "./NotificationsMenu";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dark, setDark] = useState<boolean>(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const stored = localStorage.getItem("dark-mode");
    if (stored !== null) {
      const isDark = stored === "true";
      setDark(isDark);
      document.documentElement.classList.toggle("dark", isDark);
    } else {
      const prefers = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      setDark(prefers);
      document.documentElement.classList.toggle("dark", prefers);
    }
  }, []);

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("dark-mode", String(next));
  };

  const { user, logout } = useAuth();

  const signOut = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="h-screen flex w-full bg-background overflow-hidden relative">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage:
            "url('/csc-logo.png'), url('/csc-logo.jpg'), url('/colegio%20de%20naujan%20logo%20csc.jpg'), url('/csc_logo.png'), url('/logo.png'), url('/logo.jpg'), url('/logo.webp'), url('/placeholder.svg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          filter: "blur(3px)",
          opacity: 0.55,
        }}
      />
      <img
        src="/csc-logo.png"
        alt="CSC Watermark"
        className="pointer-events-none select-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.08] dark:opacity-[0.12] transition-opacity duration-500"
        style={{ width: "min(60vmin, 520px)" }}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).src = "/csc-logo.jpg";
        }}
      />
      <div
        className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--bg-gradient-from))] via-[hsl(var(--bg-gradient-via))] to-[hsl(var(--bg-gradient-to))] transition-colors duration-500"
      />
      <AppSidebar 
        open={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
        isDark={dark}
        toggleDark={toggleDark}
      />

      <div className="flex-1 min-h-screen flex flex-col pt-14 md:pt-0 relative z-10 md:ml-72">
        <header className="md:hidden fixed top-0 left-0 right-0 z-40 w-full flex items-center justify-between px-4 py-3 border-b border-border bg-background/80 backdrop-blur-md">
          <button
            aria-label="Toggle menu"
            aria-expanded={sidebarOpen}
            className="p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
            onClick={() => setSidebarOpen((s) => !s)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <img
              src="/csc-logo.png"
              alt="CSC Logo"
              className="h-7 w-7 rounded-full shadow-sm bg-white/80 p-[2px]"
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/csc-logo.jpg'; }}
            />
            <div className="text-lg font-bold text-foreground">CSC Fines Management</div>
          </div>
          <div style={{ width: 32 }} />
        </header>

        {/* Desktop top bar */}
        <header className="hidden md:flex h-16 items-center justify-between gap-3 px-6 border-b border-border bg-card/50 backdrop-blur-md z-20 shadow-sm">
          <div className="flex items-center gap-4">
            {/* Logo and title moved to sidebar */}
          </div>

          <div className="flex items-center gap-3">
            <NotificationsMenu />
            <Button variant="ghost" className="rounded-lg" onClick={toggleDark} aria-label="Toggle dark mode">
              {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>

            <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="p-0 h-10 w-10 rounded-full" title={user?.email || "Profile"}>
                <Avatar 
                  key={user?.avatarUrl || 'no-avatar'} 
                  className="h-10 w-10 ring-2 ring-primary/10"
                >
                  {user?.avatarUrl && (
                    <AvatarImage 
                      src={`${user.avatarUrl}${user.avatarUrl.includes('?') ? '&' : '?'}t=${new Date().getTime()}`} 
                      alt={user?.name || user?.email} 
                      className="object-cover"
                    />
                  )}
                  <AvatarFallback className="bg-primary/10 text-primary font-bold">
                    {user ? (user.name || user.email.split("@")[0]).slice(0, 2).toUpperCase() : <User className="h-4 w-4" />}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => navigate('/profile')}>
                <User className="mr-2 h-4 w-4" /> Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut}>
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-6 bg-blue-950/5 dark:bg-blue-950/10">
          {children}
        </main>
      </div>
    </div>
  );
}
