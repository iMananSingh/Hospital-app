import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import TopBar from "@/components/layout/topbar";
import StatsCards from "@/components/stats-cards";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FakeBillDialog } from "@/components/fake-bill-dialog";
import { insertPatientSchema } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface DashboardStats {
  opdPatients: number;
  inpatients: number;
  labTests: number;
  diagnostics: number;
}

interface Activity {
  id: string;
  activityType: string;
  title: string;
  description: string;
  entityType: string;
  createdAt: string;
  userName: string;
}

export default function Dashboard() {
  const [isFakeBillDialogOpen, setIsFakeBillDialogOpen] = useState(false);
  const [isNewPatientOpen, setIsNewPatientOpen] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
    staleTime: 0, // Always refetch for real-time data
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const response = await fetch("/api/dashboard/stats", {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch dashboard stats");
      return response.json();
    },
  });

  const { data: recentActivities = [], isLoading: activitiesLoading } = useQuery<Activity[]>({
    queryKey: ["/api/dashboard/recent-activities"],
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const response = await fetch("/api/dashboard/recent-activities", {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch recent activities");
      return response.json();
    },
  });

  const createPatientMutation = useMutation({
    mutationFn: async (patientData: any) => {
      const response = await fetch("/api/patients", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
        },
        body: JSON.stringify(patientData),
      });
      
      if (!response.ok) {
        throw new Error("Failed to create patient");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/recent-activities"] });
      setIsNewPatientOpen(false);
      form.reset({
        name: "",
        age: 0,
        gender: "",
        phone: "",
        address: "",
        email: "",
        emergencyContact: "",
      });
      toast({
        title: "Patient created successfully",
        description: "The patient has been registered in the system.",
      });
      // Navigate to the patient's detail page
      navigate(`/patients/${data.id}`);
    },
    onError: () => {
      toast({
        title: "Error creating patient",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const form = useForm({
    resolver: zodResolver(insertPatientSchema),
    defaultValues: {
      name: "",
      age: undefined,
      gender: "",
      phone: "",
      address: "",
      email: "",
      emergencyContact: "",
    },
    mode: "onChange",
  });

  const onSubmit = (data: any) => {
    console.log("Form submitted with data:", data);
    console.log("Form errors:", form.formState.errors);
    
    // Validate required fields explicitly
    if (!data.name?.trim()) {
      form.setError("name", { message: "Name is required" });
      return;
    }
    if (!data.age || data.age <= 0) {
      form.setError("age", { message: "Valid age is required" });
      return;
    }
    if (!data.gender?.trim()) {
      form.setError("gender", { message: "Gender is required" });
      return;
    }
    if (!data.phone?.trim()) {
      form.setError("phone", { message: "Phone number is required" });
      return;
    }
    
    createPatientMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <TopBar 
          title="Dashboard & Reports"
          showNotifications={true}
          notificationCount={3}
        />
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <TopBar 
        title="Dashboard & Reports"
        showNotifications={true}
        notificationCount={3}
      />
      
      <div className="p-6 space-y-6">
        <StatsCards stats={stats || { opdPatients: 0, inpatients: 0, labTests: 0, diagnostics: 0 }} />
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {activitiesLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
                      <Skeleton className="w-8 h-8 rounded-full" />
                      <div className="flex-1 space-y-1">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-3 w-2/3" />
                      </div>
                      <Skeleton className="h-3 w-16" />
                    </div>
                  ))}
                </div>
              ) : recentActivities.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  <p>No recent activities</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentActivities.map((activity) => {
                    const getActivityIcon = (type: string) => {
                      switch (type) {
                        case 'bill_created':
                          return { icon: 'B', color: 'bg-medical-blue' };
                        case 'patient_registered':
                          return { icon: 'P', color: 'bg-healthcare-green' };
                        case 'lab_test_ordered':
                          return { icon: 'L', color: 'bg-purple-500' };
                        case 'lab_test_completed':
                          return { icon: 'T', color: 'bg-orange-500' };
                        case 'opd_scheduled':
                          return { icon: 'O', color: 'bg-blue-500' };
                        case 'service_scheduled':
                          return { icon: 'S', color: 'bg-indigo-500' };
                        case 'room_type_created':
                        case 'room_type_updated':
                        case 'room_type_deleted':
                          return { icon: 'RT', color: 'bg-green-500' };
                        case 'room_created':
                        case 'room_updated':
                        case 'room_deleted':
                          return { icon: 'R', color: 'bg-teal-500' };
                        case 'service_created':
                        case 'service_updated':
                        case 'service_deleted':
                          return { icon: 'SV', color: 'bg-pink-500' };
                        default:
                          return { icon: 'A', color: 'bg-gray-500' };
                      }
                    };

                    const formatTimeAgo = (dateString: string) => {
                      const now = new Date();
                      const date = new Date(dateString);
                      const diffInMs = now.getTime() - date.getTime();
                      const diffInMins = Math.floor(diffInMs / (1000 * 60));
                      const diffInHours = Math.floor(diffInMins / 60);
                      const diffInDays = Math.floor(diffInHours / 24);

                      if (diffInDays > 0) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
                      if (diffInHours > 0) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
                      if (diffInMins > 0) return `${diffInMins} min${diffInMins > 1 ? 's' : ''} ago`;
                      return 'Just now';
                    };

                    const { icon, color } = getActivityIcon(activity.activityType);

                    return (
                      <div key={activity.id} className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
                        <div className={`w-8 h-8 ${color} rounded-full flex items-center justify-center`}>
                          <span className="text-white text-xs">{icon}</span>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{activity.title}</p>
                          <p className="text-xs text-text-muted">{activity.description}</p>
                        </div>
                        <p className="text-xs text-text-muted">{formatTimeAgo(activity.createdAt)}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setIsFakeBillDialogOpen(true)}
                  className="p-4 bg-medical-blue text-white rounded-lg hover:bg-medical-blue/90 transition-colors" 
                  data-testid="quick-new-bill"
                >
                  <div className="text-center">
                    <div className="text-lg font-semibold">New Bill</div>
                    <div className="text-sm opacity-90">Create invoice</div>
                  </div>
                </button>
                
                <button 
                  onClick={() => setIsNewPatientOpen(true)}
                  className="p-4 bg-healthcare-green text-white rounded-lg hover:bg-healthcare-green/90 transition-colors" 
                  data-testid="quick-new-patient"
                >
                  <div className="text-center">
                    <div className="text-lg font-semibold">Add Patient</div>
                    <div className="text-sm opacity-90">Register new</div>
                  </div>
                </button>
                
                <button className="p-4 bg-purple-500 text-white rounded-lg hover:bg-purple-500/90 transition-colors" data-testid="quick-new-test">
                  <div className="text-center">
                    <div className="text-lg font-semibold">Lab Test</div>
                    <div className="text-sm opacity-90">Order test</div>
                  </div>
                </button>
                
                <button className="p-4 bg-alert-orange text-white rounded-lg hover:bg-alert-orange/90 transition-colors" data-testid="quick-view-pending">
                  <div className="text-center">
                    <div className="text-lg font-semibold">Pending</div>
                    <div className="text-sm opacity-90">View bills</div>
                  </div>
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Fake Bill Dialog */}
      <FakeBillDialog 
        isOpen={isFakeBillDialogOpen}
        onClose={() => setIsFakeBillDialogOpen(false)}
      />

      {/* New Patient Dialog */}
      <Dialog open={isNewPatientOpen} onOpenChange={setIsNewPatientOpen}>
        <DialogContent className="max-w-2xl" data-testid="new-patient-dialog">
          <DialogHeader>
            <DialogTitle>Register New Patient</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  {...form.register("name")}
                  placeholder="Enter patient's full name"
                  data-testid="input-patient-name"
                />
                {form.formState.errors.name && (
                  <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="age">Age *</Label>
                <Input
                  id="age"
                  type="number"
                  {...form.register("age", { valueAsNumber: true })}
                  placeholder="Enter age"
                  data-testid="input-patient-age"
                />
                {form.formState.errors.age && (
                  <p className="text-sm text-destructive">{form.formState.errors.age.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="gender">Gender *</Label>
                <Select 
                  value={form.watch("gender")}
                  onValueChange={(value) => form.setValue("gender", value, { shouldValidate: true })}
                >
                  <SelectTrigger data-testid="select-patient-gender">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                {form.formState.errors.gender && (
                  <p className="text-sm text-destructive">{form.formState.errors.gender.message}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  {...form.register("phone")}
                  placeholder="+91 XXXXX XXXXX"
                  data-testid="input-patient-phone"
                />
                {form.formState.errors.phone && (
                  <p className="text-sm text-destructive">{form.formState.errors.phone.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                {...form.register("email")}
                placeholder="patient@example.com"
                data-testid="input-patient-email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                {...form.register("address")}
                placeholder="Enter complete address"
                rows={3}
                data-testid="input-patient-address"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="emergencyContact">Emergency Contact</Label>
              <Input
                id="emergencyContact"
                {...form.register("emergencyContact")}
                placeholder="+91 XXXXX XXXXX"
                data-testid="input-patient-emergency"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsNewPatientOpen(false)}
                data-testid="button-cancel-patient"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createPatientMutation.isPending || !form.formState.isValid}
                className="bg-medical-blue hover:bg-medical-blue/90"
                data-testid="button-save-patient"
              >
                {createPatientMutation.isPending ? "Saving..." : "Register Patient"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
