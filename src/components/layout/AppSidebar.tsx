import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Home,
  Users,
  FileText,
  Info,
  BarChart3,
  Receipt,
  GraduationCap,
  X,
  ChevronDown,
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
}

export function AppSidebar({ open = false, onClose, isDark, toggleDark }: AppSidebarProps) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const navItems = user?.role === "admin" ? adminNavItems : studentNavItems;

  const handleSignOut = () => {
    logout();
    navigate("/");
    onClose?.();
  };

  const handleProfileClick = () => {
    navigate("/profile");
    onClose?.();
  };
  const navigate = useNavigate();
  const [departmentOpen, setDepartmentOpen] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [dbDepartments, setDbDepartments] = useState<string[]>([]);

  useEffect(() => {
    // Load departments from database
    const loadDepartments = async () => {
      if (user?.role === 'admin') {
        try {
          const depts = await getDepartments();
          
          if (depts && depts.length > 0) {
            // Extract department codes from full names
            const deptCodes = depts.map((dept: any) => {
              if (dept.name.includes('Information Systems')) return 'BSIS';
              if (dept.name.includes('Technical-Vocational')) return 'BTVTED';
              if (dept.name.includes('Public Administration')) return 'BPA';
              return dept.name;
            });
            
            const uniqueDepts = Array.from(new Set(deptCodes)).filter(Boolean);
            setDbDepartments(uniqueDepts);
          } else {
            // Fallback to default if empty
            setDbDepartments(DEFAULT_DEPARTMENTS);
          }
        } catch (error) {
          console.error("Error loading departments:", error);
          setDbDepartments(DEFAULT_DEPARTMENTS); // Fallback to default data
        }
      } else {
      }
    };

    loadDepartments();
  }, [user?.role]);

  const handleNavClick = () => {
    // No-op. The sidebar is always open.
  };

  const handleDepartmentSelect = (dept: string) => {
    setSelectedDepartment(dept);
    navigate(`/students?department=${encodeURIComponent(dept)}`);
    setDepartmentOpen(false);
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

            {/* Mobile Department Dropdown - Admin Only */}
            {user?.role === "admin" && (
              <div className="relative">
                <button
                  onClick={() => setDepartmentOpen(!departmentOpen)}
                  className={cn(
                    "sidebar-nav-item w-full",
                    location.pathname === "/students" && "sidebar-nav-item-active"
                  )}
                >
                  <Users className="h-5 w-5" />
                  <span className="truncate">
                    {selectedDepartment ? `Students (${selectedDepartment})` : "Students"}
                  </span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${departmentOpen ? 'rotate-180' : ''}`} />
                </button>

                {departmentOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-sidebar-accent rounded-md shadow-lg z-50 border border-sidebar-border max-h-[300px] overflow-y-auto">
                    {dbDepartments.length > 0 ? (
                      dbDepartments.map((dept) => (
                        <button
                          key={dept}
                          onClick={() => {
                            setSelectedDepartment(dept);
                            navigate(`/students?department=${encodeURIComponent(dept)}`);
                            setDepartmentOpen(false);
                            onClose?.();
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-sidebar-primary/20 transition-colors text-sm text-sidebar-foreground first:rounded-t-md last:rounded-b-md"
                        >
                          {dept}
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-2 text-sm text-muted-foreground">
                        Loading departments...
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
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
  const [departmentOpen, setDepartmentOpen] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [dbDepartments, setDbDepartments] = useState<string[]>([]);

  useEffect(() => {
    // Load departments from database
    const loadDepartments = async () => {
      if (user?.role === 'admin') {
        try {
          console.log('[SidebarContent] Loading departments from database...');
          const depts = await getDepartments();
          console.log('[SidebarContent] Raw departments from DB:', depts);
          
          // Extract department codes from full names
          const deptCodes = depts.map((dept: any) => {
            console.log('[SidebarContent] Processing department:', dept.name);
            if (dept.name.includes('Information Systems')) return 'BSIS';
            if (dept.name.includes('Technical-Vocational')) return 'BTVTED';
            if (dept.name.includes('Public Administration')) return 'BPA';
            return dept.name;
          });
          
          console.log('[SidebarContent] Mapped department codes:', deptCodes);
          setDbDepartments(deptCodes);
        } catch (error) {
          console.error('[SidebarContent] Error loading departments:', error);
          console.log('[SidebarContent] Falling back to mock departments:', DEFAULT_DEPARTMENTS);
          setDbDepartments(DEFAULT_DEPARTMENTS); // Fallback to mock data
        }
      } else {
        console.log('[SidebarContent] User is not admin, skipping department load');
      }
    };

    loadDepartments();
  }, [user?.role]);

  const isExpanded = !!expanded;
  const isAdmin = user?.role === "admin";

  const handleDepartmentSelect = (dept: string) => {
    setSelectedDepartment(dept);
    navigate(`/students?department=${encodeURIComponent(dept)}`);
    setDepartmentOpen(false);
  };

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

        {/* Department Dropdown - Admin Only */}
        {isAdmin && (
          <div className="relative">
            <button
              onClick={() => setDepartmentOpen(!departmentOpen)}
              className={cn(
                "sidebar-nav-item w-full",
                isExpanded ? 'justify-start' : 'justify-center',
                location.pathname === "/students" && "sidebar-nav-item-active"
              )}
            >
              <Users className="h-5 w-5" />
              <span className={`ml-3 truncate transition-opacity duration-200 ${isExpanded ? 'opacity-100' : 'opacity-0'}`}>
                {selectedDepartment ? `Students (${selectedDepartment})` : "Students"}
              </span>
              <ChevronDown className={`h-4 w-4 transition-transform ml-auto ${isExpanded ? 'opacity-100' : 'opacity-0'} ${departmentOpen ? 'rotate-180' : ''}`} />
            </button>

            {departmentOpen && isExpanded && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-sidebar-accent rounded-md shadow-lg z-50 border border-sidebar-border max-h-[300px] overflow-y-auto">
                {dbDepartments.length > 0 ? (
                  dbDepartments.map((dept) => (
                    <button
                      key={dept}
                      onClick={() => handleDepartmentSelect(dept)}
                      className="w-full text-left px-4 py-2 hover:bg-sidebar-primary/20 transition-colors text-sm text-sidebar-foreground first:rounded-t-md last:rounded-b-md"
                    >
                      {dept}
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-2 text-sm text-muted-foreground">
                    Loading departments...
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <div className={`px-4 ${isExpanded ? '' : 'flex justify-center'}`}>
          {/* footer removed per request */}
        </div>
      </div>
    </>
  );
}
