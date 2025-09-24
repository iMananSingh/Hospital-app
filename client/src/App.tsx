import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Billing from "@/pages/billing";
import Patients from "@/pages/patients";
import PatientDetail from "@/pages/patient-detail";
import Pathology from "@/pages/pathology";
import Doctors from "@/pages/doctors";
import DoctorDetail from "@/pages/doctor-detail";
import ServiceManagement from "@/pages/services";
import OpdList from "@/pages/opd-list";
import LabTests from "@/pages/lab-tests";
import Admissions from "@/pages/admissions";
import BedOccupancy from "@/pages/bed-occupancy";
import CurrentlyAdmitted from "@/pages/currently-admitted";
import AdmittedToday from "@/pages/admitted-today";
import DischargedToday from "@/pages/discharged-today";
import Settings from "@/pages/settings";
import Diagnostics from "@/pages/diagnostics";
import NotFound from "@/pages/not-found";
import Sidebar from "@/components/layout/sidebar";
import { useEffect } from "react";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="text-center space-y-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-medical-blue mx-auto"></div>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-muted/30">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Component />
      </main>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/revenue" component={() => <ProtectedRoute component={Billing} />} />
      <Route path="/patients" component={() => <ProtectedRoute component={Patients} />} />
      <Route path="/patients/:id" component={() => <ProtectedRoute component={PatientDetail} />} />
      <Route path="/pathology" component={() => <ProtectedRoute component={Pathology} />} />
      <Route path="/doctors" component={() => <ProtectedRoute component={Doctors} />} />
      <Route path="/doctors/:doctorId" component={() => <ProtectedRoute component={DoctorDetail} />} />
      <Route path="/services" component={() => <ProtectedRoute component={ServiceManagement} />} />
      <Route path="/admissions" component={() => <ProtectedRoute component={Admissions} />} />
      <Route path="/bed-occupancy" component={() => <ProtectedRoute component={BedOccupancy} />} />
      <Route path="/currently-admitted" component={() => <ProtectedRoute component={CurrentlyAdmitted} />} />
      <Route path="/admitted-today" component={() => <ProtectedRoute component={AdmittedToday} />} />
      <Route path="/discharged-today" component={() => <ProtectedRoute component={DischargedToday} />} />
      <Route path="/opd-list" component={() => <ProtectedRoute component={OpdList} />} />
      <Route path="/lab-tests" component={() => <ProtectedRoute component={LabTests} />} />
      <Route path="/settings" component={() => <ProtectedRoute component={Settings} />} />
      <Route path="/diagnostics" component={() => <ProtectedRoute component={Diagnostics} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Set up authorization header for all requests
  useEffect(() => {
    const token = localStorage.getItem("hospital_token");
    if (token) {
      // This will be handled by queryClient interceptor
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;