import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Home,
  FileText,
  Info,
  BarChart3,
  Receipt,
  GraduationCap,
  X,
  CreditCard,
  PlusCircle,
  User,
  LogOut,
  Building2,
  Mail,
  Sun,
  Moon,
  Ticket,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { DEFAULT_DEPARTMENTS } from "@/lib/constants";
import { getDepartments } from "@/integrations/supabase/queries";

// Admin Navigation
const adminNavItems = [
  { title: "Dashboard", url: "/dashboard", icon: Home },
  { title: "Manage Fines", url: "/manage-fines", icon: PlusCircle },
  { title: "Student Fines", url: "/admin-fines", icon: FileText },
  { title: "Departments", url: "/departments", icon: Building2 },
  { title: "Reports", url: "/reports", icon: BarChart3 },
  { title: "Transactions", url: "/admin-transactions", icon: Receipt },
  { title: "Payment Records", url: "/admin-payment-records", icon: CreditCard },
  { title: "Vouchers", url: "/admin-vouchers", icon: Ticket },
  { title: "Messages", url: "/admin-messages", icon: Mail },
  { title: "Manage About", url: "/manage-about", icon: Info },
];

// Student Navigation
const studentNavItems = [
  { title: "My Dashboard", url: "/student-dashboard", icon: Home },
  { title: "My Fines", url: "/student-fines", icon: FileText },
  { title: "Reports", url: "/reports", icon: BarChart3 },
  { title: "My Transactions", url: "/student-transactions", icon: Receipt },
  { title: "Pay Fines", url: "/student-payment", icon: CreditCard },
];

interface AppSidebarProps {
  open?: boolean;
  onClose?: () => void;
  isDark?: boolean;
  toggleDark?: () => void;
  onRequestSignOut?: () => void;
}

export function AppSidebar({ open = false, onClose, isDark, toggleDark, onRequestSignOut }: AppSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const navItems = user?.role === "admin" ? adminNavItems : studentNavItems;

  const handleSignOut = () => {
    if (typeof onRequestSignOut === "function") {
      onRequestSignOut();
    }
    onClose?.();
  };

  const handleProfileClick = () => {
    navigate("/profile");
    onClose?.();
  };

  const handleNavClick = () => {
    // No-op. The sidebar is always open.
  };

  return (
    <>
      {/* Desktop sidebar: fixed overlay so it doesn't push page content */}
      <aside
        className={`hidden md:flex md:fixed md:top-0 md:left-0 md:h-screen md:z-50 w-72 flex-shrink-0 bg-card/50 backdrop-blur-md flex-col overflow-hidden`}>
        <div className={`h-16 px-6 border-b border-border shadow-sm flex items-center justify-start`}>
          <div className={`flex items-center gap-3`}>
            <img
              src="/csc-logo.png"
              alt="CSC Logo"
              className="h-8 w-8 rounded-full shadow-sm bg-white/80 p-[2px]"
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/csc-logo.jpg'; }}
            />
            <div className="flex flex-col overflow-hidden">
              <h1 className={`font-display font-bold text-sidebar-foreground text-lg leading-none truncate`}>CSC Fines Management</h1>
            </div>
          </div>
        </div>
        <SidebarContent expanded={true} onNavClick={handleNavClick} />
      </aside>

      {/* Mobile sidebar overlay */}
      <div
        className={cn(
          "md:hidden fixed inset-0 z-50",
          open ? "block" : "pointer-events-none"
        )}
        aria-hidden={!open}
      >
        <div
          className={cn(
            "absolute inset-0 bg-black/40 transition-opacity",
            open ? "opacity-100" : "opacity-0"
          )}
          onClick={onClose}
        />

        <aside
          className={cn(
            "absolute left-0 top-0 bottom-0 w-72 min-w-[18rem] max-w-[18rem] flex-shrink-0 bg-sidebar shadow-lg transform transition-transform flex flex-col",
            open ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="p-4 border-b flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-sidebar-primary/20 flex items-center justify-center">
                <GraduationCap className="h-6 w-6 text-sidebar-foreground" />
              </div>
              <div>
                <h1 className="font-display font-bold text-sidebar-foreground text-lg">CSC FMS</h1>
              </div>
            </div>
            <button className="p-2 text-sidebar-foreground hover:bg-sidebar-accent/10 rounded-md" onClick={onClose} aria-label="Close menu">
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto p-4 space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.url;
              return (
                <Link
                  key={item.title}
                  to={item.url}
                  onClick={onClose}
                  className={cn(
                    "sidebar-nav-item",
                    isActive && "sidebar-nav-item-active"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.title}</span>
                </Link>
              );
            })}

          </nav>

          <div className="p-4 border-t border-sidebar-border mt-auto flex-shrink-0 space-y-1 bg-sidebar">
            <button
              onClick={toggleDark}
              className="sidebar-nav-item w-full"
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              <span>{isDark ? "Light Mode" : "Dark Mode"}</span>
            </button>
            <button
              onClick={handleProfileClick}
              className={cn(
                "sidebar-nav-item w-full",
                location.pathname === "/profile" && "sidebar-nav-item-active"
              )}
            >
              <User className="h-5 w-5" />
              <span>Profile</span>
            </button>
            <button
              onClick={handleSignOut}
              className="sidebar-nav-item w-full text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-5 w-5" />
              <span>Sign out</span>
            </button>
          </div>
        </aside>
      </div>
    </>
  );
}

function SidebarContent({ expanded, onNavClick }: { expanded?: boolean; onNavClick?: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const navItems = user?.role === "admin" ? adminNavItems : studentNavItems;
  const isExpanded = !!expanded;
  const isAdmin = user?.role === "admin";

  return (
    <>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.url;
          return (
            <Link
              key={item.title}
              to={item.url}
              className={cn(
                "sidebar-nav-item",
                isExpanded ? 'justify-start' : 'justify-center',
                isActive && "sidebar-nav-item-active"
              )}
              onClick={() => onNavClick && onNavClick()}
            >
              <item.icon className="h-5 w-5" />
              <span className={`ml-3 truncate transition-opacity duration-200 ${isExpanded ? 'opacity-100' : 'opacity-0'}`}>{item.title}</span>
            </Link>
          );
        })}

      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <div className={`px-4 ${isExpanded ? '' : 'flex justify-center'}`}>
          {/* footer removed per request */}
        </div>
      </div>
    </>
  );
}
