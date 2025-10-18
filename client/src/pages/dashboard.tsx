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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FakeBillDialog } from "@/components/fake-bill-dialog";
import AccessRestricted from "@/components/access-restricted";
import { insertPatientSchema, insertPathologyOrderSchema } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { TestTubeDiagonal, Search, Check, ChevronsUpDown, Eye, UserPlus, UserX, Stethoscope, ClipboardPlus, UserMinus, UserCheck, Trash2, UserPen, IndianRupee, CircleUser, BedSingle, ClipboardX, Settings, Building2, Database } from "lucide-react";
import { UserStarIcon } from "@/components/ui/user-star-icon";

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
  const [isPathologyOrderOpen, setIsPathologyOrderOpen] = useState(false);
  const [isAccessDeniedPatientOpen, setIsAccessDeniedPatientOpen] = useState(false);
  const [isAccessDeniedLabTestOpen, setIsAccessDeniedLabTestOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [selectedCatalogTests, setSelectedCatalogTests] = useState<any[]>([]);
  const [catalogSearchQuery, setCatalogSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();

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

  const { data: combinedTestData } = useQuery({
    queryKey: ["/api/pathology-tests/combined"],
  });

  // Extract tests and categories from combined data
  const testCatalog = combinedTestData?.categories?.flatMap(cat => 
    cat.tests?.map(test => ({
      ...test,
      category: cat.name
    })) || []
  ) || [];

  const categories = combinedTestData?.categories?.map(cat => cat.name) || [];

  const { data: patients = [] } = useQuery({
    queryKey: ["/api/patients"],
  });

  const { data: doctors } = useQuery({
    queryKey: ["/api/doctors"],
  });

  const createPatientMutation = useMutation({
    mutationFn: async (patientData: any) => {
      const response = await fetch("/api/patients", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
        },
        body: JSON.JSON.stringify(patientData),
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

  const createOrderMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log("Sending order data:", data);
      const response = await fetch("/api/pathology", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error("Order creation failed:", errorData);
        throw new Error(`Failed to create pathology order: ${errorData}`);
      }

      return response.json();
    },
    onSuccess: (createdOrder) => {
      queryClient.invalidateQueries({ queryKey: ["/api/pathology"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/recent-activities"] });
      setIsPathologyOrderOpen(false);
      setSelectedCatalogTests([]);
      pathologyForm.reset();
      toast({
        title: "Order placed successfully",
        description: "The pathology order has been placed.",
      });

      // Automatically open the order details dialog
      setSelectedOrder(createdOrder);
    },
    onError: (error) => {
      console.error("Order mutation error:", error);
      toast({
        title: "Error placing order",
        description: `Please try again. ${error.message}`,
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

  const pathologyForm = useForm({
    resolver: zodResolver(insertPathologyOrderSchema),
    defaultValues: {
      patientId: "",
      doctorId: "",
      orderedDate: (() => {
        // Use local timezone for pathology order date
        const now = new Date();
        return now.getFullYear() + '-' + 
          String(now.getMonth() + 1).padStart(2, '0') + '-' + 
          String(now.getDate()).padStart(2, '0');
      })(),
      remarks: "",
    },
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

  const onPathologySubmit = (data: any) => {
    if (selectedCatalogTests.length === 0) {
      toast({
        title: "No tests selected",
        description: "Please select at least one test from the catalog.",
        variant: "destructive",
      });
      return;
    }

    // Create single order with multiple tests
    const orderData = {
      patientId: data.patientId,
      doctorId: data.doctorId === "external" || data.doctorId === "" ? null : data.doctorId, // Make doctor optional
      orderedDate: data.orderedDate,
      remarks: data.remarks,
    };

    const tests = selectedCatalogTests.map(test => ({
      testName: test.test_name,
      testCategory: test.category,
      price: test.price,
    }));

    createOrderMutation.mutate({ orderData, tests });
  };

  // Patient Search Combobox Component for pathology
  function PatientSearchCombobox({ value, onValueChange, patients }: {
    value: string;
    onValueChange: (value: string) => void;
    patients: any[];
  }) {
    const [open, setOpen] = useState(false);
    const [searchValue, setSearchValue] = useState("");

    const filteredPatients = (patients || []).filter((patient: any) => {
      if (!searchValue.trim()) return true; // Show all patients when no search
      const searchLower = searchValue.toLowerCase().trim();
      return (
        patient.name?.toLowerCase().includes(searchLower) ||
        patient.patientId?.toLowerCase().includes(searchLower) ||
        patient.phone?.includes(searchValue.trim()) ||
        patient.email?.toLowerCase().includes(searchLower)
      );
    });

    const selectedPatient = patients?.find((patient: any) => patient.id === value);

    const formatPatientDisplay = (patient: any) => {
      return `${patient.name}, ${patient.age} ${patient.gender} (${patient.patientId})`;
    };

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between text-left font-normal"
          >
            {selectedPatient ? formatPatientDisplay(selectedPatient) : "Search and select patient..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" style={{ width: "var(--radix-popover-trigger-width)" }}>
          <Command shouldFilter={false}>
            <CommandInput 
              placeholder="Type to search patients..." 
              value={searchValue}
              onValueChange={setSearchValue}
            />
            <CommandList className="max-h-[300px] overflow-y-auto">
              <CommandEmpty>No patients found.</CommandEmpty>
              <CommandGroup>
                {filteredPatients.map((patient: any) => (
                  <CommandItem
                    key={patient.id}
                    value={patient.name}
                    onSelect={() => {
                      onValueChange(patient.id);
                      setOpen(false);
                      setSearchValue("");
                    }}
                    className="cursor-pointer"
                  >
                    <Check
                      className={`mr-2 h-4 w-4 ${
                        value === patient.id ? "opacity-100" : "opacity-0"
                      }`}
                    />
                    <div className="flex flex-col">
                      <span className="font-medium">{patient.name}</span>
                      <span className="text-sm text-muted-foreground">
                        {patient.age} years, {patient.gender} • {patient.patientId}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  }

  // Order Details Dialog Component
  function OrderDetailsDialog({ order, onClose }: { order: any, onClose: () => void }) {
    const { data: orderDetails } = useQuery({
      queryKey: ["/api/pathology", order.id],
      queryFn: async () => {
        const response = await fetch(`/api/pathology/${order.id}`, {
          headers: {
            "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
          },
        });
        if (!response.ok) throw new Error("Failed to fetch order details");
        return response.json();
      },
    });

    const getStatusColor = (status: string) => {
      switch (status) {
        case 'completed':
          return 'bg-green-100 text-green-800';
        case 'processing':
          return 'bg-blue-100 text-blue-800';
        case 'collected':
          return 'bg-yellow-100 text-yellow-800';
        case 'ordered':
          return 'bg-orange-100 text-orange-800';
        default:
          return 'bg-gray-100 text-gray-800';
      }
    };

    const formatDate = (dateString: string) => {
      if (!dateString) return "N/A";
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    };

    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Order Details - {order.orderId}</DialogTitle>
          </DialogHeader>

          <div className="max-h-[calc(90vh-120px)] overflow-y-auto">
            <div className="space-y-4 px-6 pb-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Patient</Label>
                  <p className="text-sm text-muted-foreground">{orderDetails?.patient?.name || "Unknown Patient"}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Doctor</Label>
                  <p className="text-sm text-muted-foreground">{orderDetails?.doctor?.name || "External Patient"}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Status</Label>
                  <Badge className={getStatusColor(order.status)} variant="secondary">
                    {order.status}
                  </Badge>
                </div>
                <div>
                  <Label className="text-sm font-medium">Date Ordered</Label>
                  <p className="text-sm text-muted-foreground">{formatDate(order.orderedDate)}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Total Price</Label>
                  <p className="text-sm text-muted-foreground">₹{order.totalPrice}</p>
                </div>
              </div>
              {order.remarks && (
                <div>
                  <Label className="text-sm font-medium">Remarks</Label>
                  <p className="text-sm text-muted-foreground">{order.remarks}</p>
                </div>
              )}

              <div className="mt-6">
                <Label className="text-sm font-medium">Tests in this Order ({orderDetails?.tests?.length || 0} tests)</Label>
                <div className="mt-2 border rounded-lg max-h-[300px] overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead className="bg-background">Test Name</TableHead>
                        <TableHead className="bg-background">Category</TableHead>
                        <TableHead className="bg-background">Status</TableHead>
                        <TableHead className="bg-background">Price (₹)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orderDetails?.tests ? (
                        orderDetails.tests.map((test: any, index: number) => (
                          <TableRow key={test.id} className={index % 2 === 0 ? "bg-gray-50/50" : ""}>
                            <TableCell className="font-medium">{test.testName}</TableCell>
                            <TableCell>{test.testCategory}</TableCell>
                            <TableCell>
                              <Badge className={getStatusColor(test.status)} variant="secondary">
                                {test.status}
                              </Badge>
                            </TableCell>
                            <TableCell>₹{test.price}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                            Loading test details...
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const toggleTestSelection = (test: any) => {
    const isSelected = selectedCatalogTests.some(t => t.test_name === test.test_name);
    if (isSelected) {
      setSelectedCatalogTests(prev => prev.filter(t => t.test_name !== test.test_name));
    } else {
      setSelectedCatalogTests(prev => [...prev, test]);
    }
  };

  const getTotalPrice = () => {
    return selectedCatalogTests.reduce((total, test) => total + test.price, 0);
  };

  const filteredCatalog = (testCatalog || []).filter((test: any) => {
    const matchesCategory = selectedCategory === "all" || test.category === selectedCategory;
    const matchesSearch = test.test_name?.toLowerCase().includes(catalogSearchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

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
                          return { icon: 'patient_registered', color: 'bg-blue-700' };
                        case 'lab_test_ordered':
                          return { icon: 'lab_ordered', color: 'bg-pink-500' };
                        case 'lab_test_completed':
                          return { icon: 'T', color: 'bg-orange-500' };
                        case 'opd_scheduled':
                          return { icon: 'opd', color: 'bg-blue-500' };
                        case 'service_scheduled':
                          return { icon: 'service_scheduled', color: 'bg-purple-500' };
                        case 'user_created':
                          return { icon: 'U', color: 'bg-green-500' }; // Updated to green
                        case 'user_updated':
                          return { icon: 'user_updated', color: 'bg-amber-700' };
                        case 'user_deleted':
                          return { icon: 'X', color: 'bg-red-500' };
                        case 'payment_added':
                          return { icon: 'payment_added', color: 'bg-emerald-700' };
                        case 'discount_added':
                          return { icon: 'discount_added', color: 'bg-amber-700' };
                        case 'doctor_created':
                          return { icon: 'doctor_created', color: 'bg-green-800' };
                        case 'doctor_deleted':
                        case 'doctor_deactivated':
                          return { icon: 'doctor_deactivated', color: 'bg-red-500' };
                        case 'doctor_restored':
                          return { icon: 'doctor_restored', color: 'bg-green-700' };
                        case 'doctor_permanently_deleted':
                          return { icon: 'doctor_permanently_deleted', color: 'bg-red-700' };
                        case 'patient_admitted':
                          return { icon: 'patient_admitted', color: 'bg-green-700' };
                        case 'patient_discharged':
                          return { icon: 'patient_discharged', color: 'bg-red-700' };
                        case 'system_config_changed':
                          return { icon: 'system_config_changed', color: 'bg-purple-700' };
                        case 'hospital_info_changed':
                          return { icon: 'hospital_info_changed', color: 'bg-teal-600' };
                        case 'backup_created':
                          return { icon: 'backup_created', color: 'bg-indigo-700' };
                        case 'room_type_created':
                        case 'room_type_updated':
                        case 'room_type_deleted':
                          return { icon: 'R', color: 'bg-indigo-600' };
                        case 'room_created':
                        case 'room_updated':
                        case 'room_deleted':
                          return { icon: 'R', color: 'bg-teal-500' };
                        case 'service_created':
                        case 'service_updated':
                        case 'service_deleted':
                          return { icon: 'SV', color: 'bg-pink-500' };
                        default:
                          const firstLetter = type.charAt(0).toUpperCase();
                          return { icon: firstLetter, color: 'bg-gray-600' };
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
                        {activity.activityType === 'user_created' && (
                          <div className="w-8 h-8 rounded-full bg-green-200 flex items-center justify-center">
                            <UserPlus className="w-5 h-5 text-green-700" />
                          </div>
                        )}
                        {activity.activityType === 'user_deleted' && (
                          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                            <UserX className="w-5 h-5 text-red-600" />
                          </div>
                        )}
                        {activity.activityType === 'opd_scheduled' && (
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                            <Stethoscope className="w-5 h-5 text-blue-600" />
                          </div>
                        )}
                        {activity.activityType === 'lab_test_ordered' && (
                          <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center">
                            <TestTubeDiagonal className="w-5 h-5 text-pink-600" />
                          </div>
                        )}
                        {activity.activityType === 'service_scheduled' && (
                          <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                            <ClipboardPlus className="w-5 h-5 text-purple-600" />
                          </div>
                        )}
                        {(activity.activityType === 'doctor_deleted' || activity.activityType === 'doctor_deactivated') && (
                          <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                            <UserMinus className="w-5 h-5 text-orange-600" />
                          </div>
                        )}
                        {activity.activityType === 'doctor_restored' && (
                          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                            <UserCheck className="w-5 h-5 text-green-600" />
                          </div>
                        )}
                        {activity.activityType === 'doctor_created' && (
                          <div className="w-8 h-8 rounded-full bg-green-200 flex items-center justify-center">
                            <UserStarIcon className="w-5 h-5 text-green-800" />
                          </div>
                        )}
                        {activity.activityType === 'doctor_permanently_deleted' && (
                          <div className="w-8 h-8 rounded-full bg-red-200 flex items-center justify-center">
                            <Trash2 className="w-5 h-5 text-red-700" />
                          </div>
                        )}
                        {activity.activityType === 'user_updated' && (
                          <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                            <UserPen className="w-5 h-5 text-amber-700" />
                          </div>
                        )}
                        {activity.activityType === 'payment_added' && (
                          <div className="w-8 h-8 rounded-full bg-green-200 flex items-center justify-center">
                            <IndianRupee className="w-5 h-5 text-green-800" />
                          </div>
                        )}
                        {activity.activityType === 'discount_added' && (
                          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                            <IndianRupee className="w-5 h-5 text-red-700" />
                          </div>
                        )}
                        {activity.activityType === 'patient_registered' && (
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                            <CircleUser className="w-5 h-5 text-blue-700" />
                          </div>
                        )}
                        {activity.activityType === 'patient_admitted' && (
                          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                            <BedSingle className="w-5 h-5 text-green-700" />
                          </div>
                        )}
                        {activity.activityType === 'patient_discharged' && (
                          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                            <ClipboardX className="w-5 h-5 text-red-700" />
                          </div>
                        )}
                        {activity.activityType === 'system_config_changed' && (
                          <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center">
                            <Settings className="w-5 h-5 text-white" />
                          </div>
                        )}
                        {activity.activityType === 'hospital_info_changed' && (
                          <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center">
                            <Settings className="w-5 h-5 text-white" />
                          </div>
                        )}
                        {activity.activityType === 'backup_created' && (
                          <div className="w-8 h-8 rounded-full bg-indigo-700 flex items-center justify-center">
                            <Database className="w-5 h-5 text-white" />
                          </div>
                        )}
                        {activity.activityType !== 'user_created' && activity.activityType !== 'user_updated' && activity.activityType !== 'user_deleted' && activity.activityType !== 'opd_scheduled' && activity.activityType !== 'lab_test_ordered' && activity.activityType !== 'service_scheduled' && activity.activityType !== 'doctor_deleted' && activity.activityType !== 'doctor_deactivated' && activity.activityType !== 'doctor_restored' && activity.activityType !== 'doctor_created' && activity.activityType !== 'doctor_permanently_deleted' && activity.activityType !== 'payment_added' && activity.activityType !== 'discount_added' && activity.activityType !== 'patient_registered' && activity.activityType !== 'patient_admitted' && activity.activityType !== 'patient_discharged' && activity.activityType !== 'system_config_changed' && activity.activityType !== 'hospital_info_changed' && activity.activityType !== 'backup_created' && (
                          <div className={`w-8 h-8 ${color} rounded-full flex items-center justify-center`}>
                            <span className="text-white text-xs">{icon}</span>
                          </div>
                        )}
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
                  onClick={() => {
                    const userRoles = user?.roles || [user?.role];
                    const isBillingStaff = userRoles.includes('billing_staff') && !userRoles.includes('admin') && !userRoles.includes('super_user');

                    if (isBillingStaff) {
                      setIsAccessDeniedPatientOpen(true);
                    } else {
                      setIsNewPatientOpen(true);
                    }
                  }}
                  className="p-4 bg-healthcare-green text-white rounded-lg hover:bg-healthcare-green/90 transition-colors" 
                  data-testid="quick-new-patient"
                >
                  <div className="text-center">
                    <div className="text-lg font-semibold">Add Patient</div>
                    <div className="text-sm opacity-90">Register new</div>
                  </div>
                </button>

                <button 
                  onClick={() => {
                    const userRoles = user?.roles || [user?.role];
                    const isBillingStaff = userRoles.includes('billing_staff') && !userRoles.includes('admin') && !userRoles.includes('super_user');

                    if (isBillingStaff) {
                      setIsAccessDeniedLabTestOpen(true);
                    } else {
                      setIsPathologyOrderOpen(true);
                    }
                  }}
                  className="p-4 bg-purple-500 text-white rounded-lg hover:bg-purple-500/90 transition-colors" 
                  data-testid="quick-new-test"
                >
                  <div className="text-center">
                    <div className="text-lg font-semibold">Lab Test</div>
                    <div className="text-sm opacity-90">Order test</div>
                  </div>
                </button>

                <button 
                  onClick={() => navigate("/pending-bills")}
                  className="p-4 bg-alert-orange text-white rounded-lg hover:bg-alert-orange/90 transition-colors" 
                  data-testid="quick-view-pending"
                >
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

      {/* Order Pathology Tests Dialog */}
      <Dialog open={isPathologyOrderOpen} onOpenChange={setIsPathologyOrderOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Order Pathology Tests</DialogTitle>
          </DialogHeader>

          <form onSubmit={pathologyForm.handleSubmit(onPathologySubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="patientId">Patient *</Label>
                <PatientSearchCombobox
                  value={pathologyForm.watch("patientId")}
                  onValueChange={(value) => pathologyForm.setValue("patientId", value)}
                  patients={patients || []}
                />
                {pathologyForm.formState.errors.patientId && (
                  <p className="text-sm text-red-500">{pathologyForm.formState.errors.patientId.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="doctorId">Doctor (Optional for External Patients)</Label>
                <Select 
                  onValueChange={(value) => pathologyForm.setValue("doctorId", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select doctor (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="external">External Patient (No Doctor)</SelectItem>
                    {(doctors || []).map((doctor: any) => (
                      <SelectItem key={doctor.id} value={doctor.id}>
                        {doctor.name} - {doctor.specialization}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Select Tests from Catalog</Label>
                <div className="flex items-center space-x-2">
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {(categories || []).map((category: string) => (
                        <SelectItem key={category} value={category}>{category}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search tests by name..."
                      value={catalogSearchQuery}
                      onChange={(e) => setCatalogSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>

              <div className="border rounded-lg max-h-64 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Select</TableHead>
                      <TableHead>Test Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Price (₹)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCatalog.map((test: any, index: number) => {
                      const isSelected = selectedCatalogTests.some(t => t.test_name === test.test_name);
                      return (
                        <TableRow 
                          key={`${test.category}-${test.test_name}-${index}`}
                          className={isSelected ? "bg-blue-50" : ""}
                        >
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleTestSelection(test)}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                          </TableCell>
                          <TableCell className="font-medium">{test.test_name}</TableCell>
                          <TableCell>{test.category}</TableCell>
                          <TableCell>₹{test.price}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {selectedCatalogTests.length > 0 && (
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">Selected Tests ({selectedCatalogTests.length})</h4>
                  <div className="space-y-1">
                    {selectedCatalogTests.map((test, index) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span>{test.test_name}</span>
                        <span>₹{test.price}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-blue-200 mt-2 pt-2 font-medium text-blue-900">
                    Total: ₹{getTotalPrice()}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="remarks">Remarks</Label>
              <Textarea
                {...pathologyForm.register("remarks")}
                placeholder="Enter any additional remarks or instructions"
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsPathologyOrderOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createOrderMutation.isPending || selectedCatalogTests.length === 0}
              >
                {createOrderMutation.isPending ? "Ordering..." : `Order ${selectedCatalogTests.length} Test(s)`}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Order Details Dialog */}
      {selectedOrder && (
        <OrderDetailsDialog 
          order={selectedOrder} 
          onClose={() => {
            setSelectedOrder(null);
            // No redirect needed since we're already on dashboard
          }} 
        />
      )}

      {/* Access Denied Dialogs for Billing Staff */}
      <Dialog open={isAccessDeniedPatientOpen} onOpenChange={setIsAccessDeniedPatientOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Access Restricted</DialogTitle>
          </DialogHeader>
          <div className="p-4">
            <AccessRestricted 
              title="Patient Registration Restricted"
              description="Only administrators and super users can register new patients."
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isAccessDeniedLabTestOpen} onOpenChange={setIsAccessDeniedLabTestOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Access Restricted</DialogTitle>
          </DialogHeader>
          <div className="p-4">
            <AccessRestricted 
              title="Lab Test Ordering Restricted"
              description="Only administrators and super users can order lab tests."
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}