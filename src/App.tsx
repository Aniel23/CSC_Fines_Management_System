import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route } from "react-router-dom";
import { RequireAuth } from "@/contexts/AuthContext";
import { lazy, Suspense } from "react";
import { Loader } from "lucide-react";

// Lazy load pages for better performance
const LoginPage = lazy(() => import("./pages/LoginPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const StudentsPage = lazy(() => import("./pages/StudentsPage"));
const FinesPage = lazy(() => import("./pages/FinesPage"));
const AdminFinesPage = lazy(() => import("./pages/AdminFinesPage"));
const StudentFinesPage = lazy(() => import("./pages/StudentFinesPage"));
const StudentDashboardPage = lazy(() => import("./pages/StudentDashboardPage"));
const AdminTransactionsPage = lazy(() => import("./pages/AdminTransactionsPage"));
const StudentTransactionsPage = lazy(() => import("./pages/StudentTransactionsPage"));
const StudentPaymentPage = lazy(() => import("./pages/StudentPaymentPage"));
const AdminPaymentRecordsPage = lazy(() => import("./pages/AdminPaymentRecordsPage"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const TransactionsPage = lazy(() => import("./pages/TransactionsPage"));
const ManageFinesPage = lazy(() => import("./pages/ManageFinesPage"));
const ManageAboutPage = lazy(() => import("./pages/ManageAboutPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess"));
const PaymentFailed = lazy(() => import("./pages/PaymentFailed"));
const DepartmentManagement = lazy(() => import("./pages/admin/DepartmentManagement"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const ContactAdminPage = lazy(() => import("./pages/ContactAdminPage"));
const AdminMessagesPage = lazy(() => import("./pages/AdminMessagesPage"));
const AdminVouchersPage = lazy(() => import("./pages/AdminVouchersPage"));
const AdminBucketManagerPage = lazy(() => import("./pages/AdminBucketManagerPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

const PageLoader = () => (
  <div className="h-screen w-full flex items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-3">
      <Loader className="h-8 w-8 animate-spin text-primary" />
      <p className="text-muted-foreground animate-pulse">Loading...</p>
    </div>
  </div>
);

const AppRoutes = () => {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/dashboard" element={<RequireAuth><DashboardPage /></RequireAuth>} />
        <Route path="/student-dashboard" element={<RequireAuth><StudentDashboardPage /></RequireAuth>} />
        <Route path="/students" element={<RequireAuth><StudentsPage /></RequireAuth>} />
        <Route path="/fines" element={<RequireAuth><FinesPage /></RequireAuth>} />
        <Route path="/admin-fines" element={<RequireAuth><AdminFinesPage /></RequireAuth>} />
        <Route path="/student-fines" element={<RequireAuth><StudentFinesPage /></RequireAuth>} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/reports" element={<RequireAuth><ReportsPage /></RequireAuth>} />
        <Route path="/transactions" element={<RequireAuth><TransactionsPage /></RequireAuth>} />
        <Route path="/admin-transactions" element={<RequireAuth><AdminTransactionsPage /></RequireAuth>} />
        <Route path="/student-transactions" element={<RequireAuth><StudentTransactionsPage /></RequireAuth>} />
        <Route path="/student-payment" element={<RequireAuth><StudentPaymentPage /></RequireAuth>} />
        <Route path="/admin-payment-records" element={<RequireAuth><AdminPaymentRecordsPage /></RequireAuth>} />
        <Route path="/admin-messages" element={<RequireAuth><AdminMessagesPage /></RequireAuth>} />
        <Route path="/admin-vouchers" element={<RequireAuth><AdminVouchersPage /></RequireAuth>} />
        <Route path="/admin-bucket-manager" element={<RequireAuth><AdminBucketManagerPage /></RequireAuth>} />
        <Route path="/payment/success" element={<PaymentSuccess />} />
        <Route path="/payment/failed" element={<PaymentFailed />} />
        <Route path="/manage-fines" element={<RequireAuth><ManageFinesPage /></RequireAuth>} />
        <Route path="/manage-about" element={<RequireAuth><ManageAboutPage /></RequireAuth>} />
        <Route path="/departments" element={<RequireAuth><DepartmentManagement /></RequireAuth>} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/contact-admin" element={<ContactAdminPage />} />
        <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AppRoutes />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
