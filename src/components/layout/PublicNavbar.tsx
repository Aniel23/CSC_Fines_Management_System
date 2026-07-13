import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PublicNavbar() {
  const [isDark, setIsDark] = useState<boolean>(false);

  useEffect(() => {
    const stored = localStorage.getItem("dark-mode");
    if (stored !== null) {
      const dark = stored === "true";
      setIsDark(dark);
      document.documentElement.classList.toggle("dark", dark);
    } else {
      const prefers = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      setIsDark(prefers);
      document.documentElement.classList.toggle("dark", prefers);
    }
  }, []);

  const toggleDark = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("dark-mode", String(next));
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 md:px-8 py-3 bg-background/60 backdrop-blur-md border-b border-border transition-colors">
      <Link to="/" className="flex items-center gap-3 group">
        <div className="relative">
          <img
            src="/csc-logo.png"
            alt="CSC Logo"
            className="h-9 w-9 rounded-full shadow-sm bg-white/90 p-[2px] group-hover:scale-105 transition-transform"
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/csc-logo.jpg'; }}
          />
          <div className="absolute inset-0 rounded-full bg-primary/10 animate-pulse -z-10 scale-125" />
        </div>
        <span className="font-display font-bold text-lg md:text-xl tracking-tight text-foreground">
          CSC <span className="text-primary">Fines Management System</span>
        </span>
      </Link>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleDark}
          className="rounded-full hover:bg-primary/10 transition-colors flex shrink-0"
          aria-label="Toggle dark mode"
        >
          {isDark ? (
            <Sun className="h-5 w-5 text-yellow-500 transition-all rotate-0 scale-100" />
          ) : (
            <Moon className="h-5 w-5 text-slate-700 transition-all rotate-0 scale-100" />
          )}
        </Button>
      </div>
    </nav>
  );
}
