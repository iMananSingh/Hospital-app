import React, { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { FakeBillDialog } from "@/components/fake-bill-dialog";
import AccessRestricted from "@/components/access-restricted";
import Footer from "@/components/layout/footer";
import {
  insertPatientSchema,
  insertPathologyOrderSchema,
  insertPatientServiceSchema,
} from "@shared/schema";
import { z } from "zod";
import { Checkbox } from "@/components/ui/checkbox";
import { Heart, Calendar, X } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  TestTubeDiagonal,
  Search,
  Check,
  ChevronsUpDown,
  Eye,
  UserPlus,
  UserX,
  Stethoscope,
  ClipboardPlus,
  UserMinus,
  UserCheck,
  Trash2,
  UserPen,
  IndianRupee,
  CircleUser,
  BedSingle,
  ClipboardX,
  Settings,
  Building2,
  Database,
  DatabaseZap,
  Pencil,
} from "lucide-react";
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
  const [isAccessDeniedPatientOpen, setIsAccessDeniedPatientOpen] =
    useState(false);
  const [isAccessDeniedLabTestOpen, setIsAccessDeniedLabTestOpen] =
    useState(false);
  const [isAccessDeniedServiceOpen, setIsAccessDeniedServiceOpen] =
    useState(false);
  const [isAccessDeniedAdmissionOpen, setIsAccessDeniedAdmissionOpen] =
    useState(false);
  const [isServiceDialogOpen, setIsServiceDialogOpen] = useState(false);
  const [isAdmissionDialogOpen, setIsAdmissionDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [selectedCatalogTests, setSelectedCatalogTests] = useState<any[]>([]);
  const [catalogSearchQuery, setCatalogSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedPatientForService, setSelectedPatientForService] =
    useState<string>("");
  const [selectedPatientForAdmission, setSelectedPatientForAdmission] =
    useState<string>("");
  const [selectedServiceType, setSelectedServiceType] = useState("");
  const [selectedServiceCategory, setSelectedServiceCategory] = useState("");
  const [selectedServiceSearchQuery, setSelectedServiceSearchQuery] =
    useState("");
  const [selectedServices, setSelectedServices] = useState<any[]>([]);
  const [selectedCatalogService, setSelectedCatalogService] =
    useState<any>(null);
  const [billingPreview, setBillingPreview] = useState<any>(null);
  const [selectedAdmissionServices, setSelectedAdmissionServices] = useState<
    any[]
  >([]);
  const [
    selectedAdmissionServiceSearchQuery,
    setSelectedAdmissionServiceSearchQuery,
  ] = useState("");
  const [isCreatingAdmission, setIsCreatingAdmission] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const userRoles = user?.roles || (user?.role ? [user.role] : []);
  const hasAnyRole = (allowedRoles: string[]) =>
    allowedRoles.some((role) => userRoles.includes(role));
  const canManagePatients = hasAnyRole([
    "receptionist",
    "admin",
    "super_user",
  ]);

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
    staleTime: -1, // Always consider stale to force refetch
    gcTime: 0, // Don't cache
    refetchOnMount: true, // Always refetch on mount
    refetchOnWindowFocus: true,
    refetchInterval: 30000, // Refetch every 30 seconds for real-time dashboard
    queryFn: async () => {
      const response = await fetch("/api/dashboard/stats", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("hospital_token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch dashboard stats");
      const data = await response.json();
      console.log("[Dashboard] Stats fetched:", data);
      return data;
    },
  });

  const { data: recentActivities = [], isLoading: activitiesLoading } =
    useQuery<Activity[]>({
      queryKey: ["/api/dashboard/recent-activities"],
      staleTime: 0,
      refetchOnMount: true,
      refetchOnWindowFocus: true,
      queryFn: async () => {
        const response = await fetch("/api/dashboard/recent-activities", {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("hospital_token")}`,
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
  const testCatalog =
    combinedTestData?.categories?.flatMap(
      (cat) =>
        cat.tests?.map((test) => ({
          ...test,
          category: cat.name,
        })) || [],
    ) || [];

  const categories = combinedTestData?.categories?.map((cat) => cat.name) || [];

  const { data: patients = [] } = useQuery({
    queryKey: ["/api/patients"],
  });

  const { data: doctors } = useQuery({
    queryKey: ["/api/doctors"],
  });

  const { data: allServices } = useQuery({
    queryKey: ["/api/services"],
  });

  const { data: roomTypes = [] } = useQuery<any[]>({
    queryKey: ["/api/room-types"],
  });

  const { data: rooms = [] } = useQuery<any[]>({
    queryKey: ["/api/rooms"],
  });

  const { data: allCurrentAdmissions = [] } = useQuery({
    queryKey: ["/api/inpatients/currently-admitted"],
  });

  const createPatientMutation = useMutation({
    mutationFn: async (patientData: any) => {
      const response = await fetch("/api/patients", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("hospital_token")}`,
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
      queryClient.invalidateQueries({
        queryKey: ["/api/dashboard/recent-activities"],
      });
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
        description: "New Patient registered successfully.",
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
          Authorization: `Bearer ${localStorage.getItem("hospital_token")}`,
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
      queryClient.invalidateQueries({
        queryKey: ["/api/dashboard/recent-activities"],
      });
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
      orderedDate: "", // Will be set by useEffect
      remarks: "",
    },
  });

  const serviceForm = useForm({
    resolver: zodResolver(
      insertPatientServiceSchema.extend({
        doctorId: z.string().optional(),
        price: z.coerce.number().min(0, "Price must be positive"),
        selectedServicesCount: z.number().default(0),
        serviceId: z.string().optional(),
        serviceType: z.string().optional(),
        serviceName: z.string().optional(),
      }),
    ),
    defaultValues: {
      patientId: "",
      serviceType: "",
      serviceName: "",
      doctorId: "",
      price: 0,
      quantity: 1,
      hours: 1,
      distance: 0,
      notes: "",
      scheduledDate: new Date().toISOString().split("T")[0],
      scheduledTime: new Date().toTimeString().slice(0, 5),
      serviceId: "",
      selectedServicesCount: 0,
    },
  });

  const admissionForm = useForm({
    defaultValues: {
      patientId: "",
      doctorId: "",
      currentWardType: "",
      currentRoomNumber: "",
      admissionDate: "",
      dailyCost: 0,
      initialDeposit: 0,
      reason: "",
    },
  });

  React.useEffect(() => {
    if (isAdmissionDialogOpen) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const currentDateTime = `${year}-${month}-${day}T${hours}:${minutes}`;
      admissionForm.setValue("admissionDate", currentDateTime);
    }
  }, [isAdmissionDialogOpen]);

  // Fetch system settings for timezone
  const { data: systemSettings } = useQuery({
    queryKey: ["/api/settings/system"],
  });

  // Update pathology form date/time when system settings load or dialog opens
  React.useEffect(() => {
    if (!isPathologyOrderOpen) return;

    const now = new Date();
    if (systemSettings?.timezone) {
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: systemSettings.timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

      const parts = formatter.formatToParts(now);
      const year = parts.find((p) => p.type === "year")?.value;
      const month = parts.find((p) => p.type === "month")?.value;
      const day = parts.find((p) => p.type === "day")?.value;
      const hour = parts.find((p) => p.type === "hour")?.value;
      const minute = parts.find((p) => p.type === "minute")?.value;

      const currentDateTime = `${year}-${month}-${day}T${hour}:${minute}`;
      pathologyForm.setValue("orderedDate", currentDateTime);
      return;
    }

    const localDateTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}T${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    pathologyForm.setValue("orderedDate", localDateTime);
  }, [systemSettings?.timezone, isPathologyOrderOpen]);

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
        description: "No tests selected.",
        variant: "destructive",
      });
      return;
    }

    // Create single order with multiple tests
    const orderData = {
      patientId: data.patientId,
      doctorId:
        data.doctorId === "external" || data.doctorId === ""
          ? null
          : data.doctorId, // Make doctor optional
      orderedDate: data.orderedDate,
      remarks: data.remarks,
    };

    const tests = selectedCatalogTests.map((test) => ({
      testName: test.test_name,
      testCategory: test.category,
      price: test.price,
    }));

    createOrderMutation.mutate({ orderData, tests });
  };

  // Patient Search Combobox Component for pathology
  function PatientSearchCombobox({
    value,
    onValueChange,
    patients,
  }: {
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

    const selectedPatient = patients?.find(
      (patient: any) => patient.id === value,
    );

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
            {selectedPatient
              ? formatPatientDisplay(selectedPatient)
              : "Search and select patient..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-full p-0"
          style={{ width: "var(--radix-popover-trigger-width)" }}
        >
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
                        {patient.age} years, {patient.gender} •{" "}
                        {patient.patientId}
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
  function OrderDetailsDialog({
    order,
    onClose,
  }: {
    order: any;
    onClose: () => void;
  }) {
    const { data: orderDetails } = useQuery({
      queryKey: ["/api/pathology", order.id],
      queryFn: async () => {
        const response = await fetch(`/api/pathology/${order.id}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("hospital_token")}`,
          },
        });
        if (!response.ok) throw new Error("Failed to fetch order details");
        return response.json();
      },
    });

    const getStatusColor = (status: string) => {
      switch (status) {
        case "completed":
          return "bg-green-100 text-green-800";
        case "processing":
          return "bg-blue-100 text-blue-800";
        case "collected":
          return "bg-yellow-100 text-yellow-800";
        case "ordered":
          return "bg-orange-100 text-orange-800";
        default:
          return "bg-gray-100 text-gray-800";
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
                  <p className="text-sm text-muted-foreground">
                    {orderDetails?.patient?.name || "Unknown Patient"}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Doctor</Label>
                  <p className="text-sm text-muted-foreground">
                    {orderDetails?.doctor?.name || "External Patient"}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Status</Label>
                  <Badge
                    className={getStatusColor(order.status)}
                    variant="secondary"
                  >
                    {order.status}
                  </Badge>
                </div>
                <div>
                  <Label className="text-sm font-medium">Date Ordered</Label>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(order.orderedDate)}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Total Price</Label>
                  <p className="text-sm text-muted-foreground">
                    ₹{order.totalPrice}
                  </p>
                </div>
              </div>
              {order.remarks && (
                <div>
                  <Label className="text-sm font-medium">Remarks</Label>
                  <p className="text-sm text-muted-foreground">
                    {order.remarks}
                  </p>
                </div>
              )}

              <div className="mt-6">
                <Label className="text-sm font-medium">
                  Tests in this Order ({orderDetails?.tests?.length || 0} tests)
                </Label>
                <div className="mt-2 border rounded-lg max-h-[300px] overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead className="bg-background">
                          Test Name
                        </TableHead>
                        <TableHead className="bg-background">
                          Category
                        </TableHead>
                        <TableHead className="bg-background">Status</TableHead>
                        <TableHead className="bg-background">
                          Price (₹)
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orderDetails?.tests ? (
                        orderDetails.tests.map((test: any, index: number) => (
                          <TableRow
                            key={test.id}
                            className={index % 2 === 0 ? "bg-gray-50/50" : ""}
                          >
                            <TableCell className="font-medium">
                              {test.testName}
                            </TableCell>
                            <TableCell>{test.testCategory}</TableCell>
                            <TableCell>
                              <Badge
                                className={getStatusColor(test.status)}
                                variant="secondary"
                              >
                                {test.status}
                              </Badge>
                            </TableCell>
                            <TableCell>₹{test.price}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell
                            colSpan={4}
                            className="text-center text-muted-foreground py-8"
                          >
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
    const isSelected = selectedCatalogTests.some(
      (t) => t.test_name === test.test_name,
    );
    if (isSelected) {
      setSelectedCatalogTests((prev) =>
        prev.filter((t) => t.test_name !== test.test_name),
      );
    } else {
      setSelectedCatalogTests((prev) => [...prev, test]);
    }
  };

  const getTotalPrice = () => {
    return selectedCatalogTests.reduce((total, test) => total + test.price, 0);
  };

  const filteredCatalog = (testCatalog || []).filter((test: any) => {
    const matchesCategory =
      selectedCategory === "all" || test.category === selectedCategory;
    const matchesSearch = test.test_name
      ?.toLowerCase()
      .includes(catalogSearchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Service categories mapping
  const serviceCategories = [
    { key: "diagnostics", label: "Diagnostic Services", icon: Heart },
    { key: "procedures", label: "Medical Procedures", icon: Stethoscope },
    { key: "operations", label: "Surgical Operations", icon: X },
    { key: "consultation", label: "Consultation", icon: Calendar },
    { key: "misc", label: "Miscellaneous Services", icon: Settings },
  ];

  // Filter services by category and search query
  const getFilteredServices = (category: string) => {
    if (!allServices) return [];

    let filtered = allServices.filter((s: any) => s.isActive);
    filtered = filtered.filter((s: any) => s.category !== "pathology");
    filtered = filtered.filter((s: any) => s.category !== "admissions");

    if (category && category !== "all") {
      filtered = filtered.filter((s: any) => s.category === category);
    }

    if (selectedServiceSearchQuery.trim()) {
      filtered = filtered.filter(
        (s: any) =>
          s.name
            ?.toLowerCase()
            .includes(selectedServiceSearchQuery.toLowerCase()) ||
          (s.description &&
            s.description
              ?.toLowerCase()
              .includes(selectedServiceSearchQuery.toLowerCase())),
      );
    }

    return filtered;
  };

  // Map service categories to valid database service types
  const mapCategoryToServiceType = (category: string) => {
    switch (category) {
      case "diagnostics":
        return "diagnostic";
      case "procedures":
        return "procedure";
      case "operations":
        return "operation";
      case "consultation":
        return "opd";
      case "misc":
        return "service";
      default:
        return "service";
    }
  };

  // Service creation mutation
  const createServiceMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/patient-services/batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("hospital_token")}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create service");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-services"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/dashboard/recent-activities"],
      });
      setIsServiceDialogOpen(false);
      setSelectedServiceType("");
      setSelectedServiceCategory("");
      setSelectedServices([]);
      setSelectedCatalogService(null);
      setBillingPreview(null);
      setSelectedPatientForService("");
      serviceForm.reset();
      toast({
        title: "Service scheduled successfully",
        description: "Services added to patient's schedule.",
      });
    },
    onError: () => {
      toast({
        title: "Error scheduling service",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Service submission handler
  const onServiceSubmit = async (data: any) => {
    try {
      if (!selectedPatientForService) {
        toast({
          title: "Error",
          description: "Please select a patient",
          variant: "destructive",
        });
        return;
      }

      if (!data.scheduledDate || !data.scheduledTime) {
        toast({
          title: "Error",
          description: "Please select date and time",
          variant: "destructive",
        });
        return;
      }

      const servicesToCreate = [];

      if (selectedServices.length > 0) {
        selectedServices.forEach((service: any) => {
          servicesToCreate.push({
            patientId: selectedPatientForService,
            serviceType: mapCategoryToServiceType(service.category),
            serviceName: service.name,
            serviceId: service.id,
            price: service.price * (service.quantity || 1),
            quantity: service.quantity || 1,
            notes: data.notes || "",
            scheduledDate: data.scheduledDate,
            scheduledTime: data.scheduledTime,
            status: "scheduled",
            doctorId:
              data.doctorId && data.doctorId !== "none" ? data.doctorId : null,
            billingType: service.billingType || "per_instance",
            calculatedAmount: service.price * (service.quantity || 1),
            billingQuantity: service.quantity || 1,
          });
        });
      }

      if (servicesToCreate.length === 0) {
        toast({
          title: "Error",
          description: "Please select at least one service",
          variant: "destructive",
        });
        return;
      }

      createServiceMutation.mutate(servicesToCreate);
    } catch (error) {
      console.error("Error in onServiceSubmit:", error);
      toast({
        title: "Form Submission Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Helper function for API requests
  const apiRequest = async (url: string, options: any) => {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("hospital_token")}`,
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    return response.json();
  };

  const onAdmissionSubmit = async (data: any) => {
    const requiredFields = [
      "patientId",
      "doctorId",
      "currentWardType",
      "currentRoomNumber",
      "admissionDate",
      "dailyCost",
    ];
    const missingFields = requiredFields.filter(
      (field) => !data[field] || data[field] === "",
    );

    if (missingFields.length > 0) {
      toast({
        title: "Missing Required Fields",
        description: `Please fill in all required fields: ${missingFields.join(", ")}`,
        variant: "destructive",
      });
      return;
    }

    setIsCreatingAdmission(true);

    try {
      const selectedDate = new Date(data.admissionDate);
      const now = new Date();
      selectedDate.setSeconds(now.getSeconds());
      selectedDate.setMilliseconds(now.getMilliseconds());
      const utcAdmissionDate = selectedDate.toISOString();

      const admissionData = {
        ...data,
        admissionId: `ADM-${Date.now()}`,
        admissionDate: utcAdmissionDate,
      };

      const admissionResult = await apiRequest("/api/admissions", {
        method: "POST",
        body: admissionData,
      });

      // Create admission services in the new admission_services table
      if (selectedAdmissionServices.length > 0) {
        const servicesToCreate = [];
        const selectedDoctorId = data.doctorId;

        for (const service of selectedAdmissionServices) {
          servicesToCreate.push({
            patientId: data.patientId,
            admissionId: admissionResult.id,
            serviceName: service.name,
            serviceId: service.id,
            price: service.price,
            notes: `Admission service - ${service.name}`,
            scheduledDate: data.admissionDate.split("T")[0],
            scheduledTime: data.admissionDate.split("T")[1] || "00:00",
            status: "scheduled",
            doctorId: selectedDoctorId,
            billingType: service.billingType || "per_instance",
          });
        }

        if (servicesToCreate.length > 0) {
          if (servicesToCreate.length === 1) {
            await apiRequest("/api/admission-services", {
              method: "POST",
              body: servicesToCreate[0],
            });
          } else {
            await apiRequest("/api/admission-services/batch", {
              method: "POST",
              body: servicesToCreate,
            });
          }
        }
      }

      queryClient.invalidateQueries({ queryKey: ["/api/admission-services"] });
      queryClient.invalidateQueries({ queryKey: ["/api/patients"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/inpatients/currently-admitted"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/rooms"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/dashboard/recent-activities"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });

      setIsAdmissionDialogOpen(false);
      setSelectedPatientForAdmission("");
      setSelectedAdmissionServices([]);
      setSelectedAdmissionServiceSearchQuery("");
      admissionForm.reset();

      toast({
        title: "Patient Admitted Successfully",
        description: `Patient admitted${selectedAdmissionServices.length > 0 ? ` (${selectedAdmissionServices.length} service${selectedAdmissionServices.length !== 1 ? "s" : ""})` : ""}.`,
      });
    } catch (error) {
      console.error("Error admitting patient:", error);
      toast({
        title: "Error Admitting Patient",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreatingAdmission(false);
    }
  };

  // Note: Removed top-level loading check - using statsLoading for individual stats cards instead
  // This allows the rest of the dashboard to render while stats are loading

  // Get current greeting based on time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 5) return "Good Evening";
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  // Get formatted current date
  const getCurrentDate = () => {
    const date = new Date();
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Extract first name from full name
  const getFirstName = () => {
    if (!user?.fullName) return "User";
    const firstName = user.fullName.split(" ")[0];
    return firstName || "User";
  };

  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{ height: "calc(100vh)" }}
    >
      <TopBar
        title="Dashboard & Reports"
        showNotifications={true}
        notificationCount={3}
      />

      <div className="flex-1 flex flex-col px-6 pt-4 pb-6 overflow-hidden">
        {/* Greeting Header - Fixed Height */}
        <div className="flex justify-between items-center mb-4 flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-text-dark">
              {getGreeting()}, {getFirstName()} 👋
            </h1>
            <p className="text-sm text-text-muted mt-0.5">
              Here's today's overview.
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-text-dark">
              {getCurrentDate()}
            </p>
          </div>
        </div>

        {/* Stats Cards - Fixed Height */}
        <div className="mb-4 flex-shrink-0">
          {statsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="bg-white dark:bg-slate-950 rounded-lg shadow-sm p-6"
                >
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-8 w-12" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <StatsCards
              stats={
                stats || {
                  opdPatients: 0,
                  inpatients: 0,
                  labTests: 0,
                  diagnostics: 0,
                }
              }
            />
          )}
        </div>

        {/* Recent Activity and Quick Actions - Flexible Height */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
          <Card className="flex flex-col h-full overflow-hidden">
            <CardHeader className="flex-shrink-0">
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 flex flex-col">
              {activitiesLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={i}
                      className="flex items-center space-x-3 p-3 bg-muted rounded-lg"
                    >
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
                <div className="space-y-3 overflow-y-auto pr-2 flex-1 min-h-0">
                  {recentActivities.map((activity) => {
                    const getActivityIcon = (type: string) => {
                      switch (type) {
                        case "bill_created":
                          return { icon: "B", color: "bg-medical-blue" };
                        case "patient_registered":
                          return {
                            icon: "patient_registered",
                            color: "bg-blue-700",
                          };
                        case "lab_test_ordered":
                          return { icon: "lab_ordered", color: "bg-pink-500" };
                        case "lab_test_completed":
                          return { icon: "T", color: "bg-orange-500" };
                        case "opd_scheduled":
                          return { icon: "opd", color: "bg-blue-500" };
                        case "service_scheduled":
                          return {
                            icon: "service_scheduled",
                            color: "bg-purple-500",
                          };
                        case "user_created":
                          return { icon: "U", color: "bg-green-500" }; // Updated to green
                        case "user_updated":
                          return {
                            icon: "user_updated",
                            color: "bg-amber-700",
                          };
                        case "user_deleted":
                          return { icon: "X", color: "bg-red-500" };
                        case "payment_added":
                          return {
                            icon: "payment_added",
                            color: "bg-emerald-700",
                          };
                        case "discount_added":
                          return {
                            icon: "discount_added",
                            color: "bg-amber-700",
                          };
                        case "doctor_created":
                          return {
                            icon: "doctor_created",
                            color: "bg-green-800",
                          };
                        case "doctor_deleted":
                        case "doctor_deactivated":
                          return {
                            icon: "doctor_deactivated",
                            color: "bg-red-500",
                          };
                        case "doctor_restored":
                          return {
                            icon: "doctor_restored",
                            color: "bg-green-700",
                          };
                        case "doctor_permanently_deleted":
                          return {
                            icon: "doctor_permanently_deleted",
                            color: "bg-red-700",
                          };
                        case "patient_admitted":
                          return {
                            icon: "patient_admitted",
                            color: "bg-green-700",
                          };
                        case "patient_discharged":
                          return {
                            icon: "patient_discharged",
                            color: "bg-red-700",
                          };
                        case "system_config_changed":
                          return {
                            icon: "system_config_changed",
                            color: "bg-purple-700",
                          };
                        case "hospital_info_changed":
                          return {
                            icon: "hospital_info_changed",
                            color: "bg-teal-600",
                          };
                        case "backup_created":
                          return {
                            icon: "backup_created",
                            color: "bg-indigo-700",
                          };
                        case "room_type_created":
                        case "room_type_updated":
                        case "room_type_deleted":
                          return { icon: "R", color: "bg-indigo-600" };
                        case "room_created":
                        case "room_updated":
                        case "room_deleted":
                          return { icon: "R", color: "bg-teal-500" };
                        case "service_created":
                        case "service_updated":
                        case "service_deleted":
                          return { icon: "SV", color: "bg-pink-500" };
                        default:
                          const firstLetter = type.charAt(0).toUpperCase();
                          return { icon: firstLetter, color: "bg-gray-600" };
                      }
                    };

                    const formatTimeAgo = (dateString: string) => {
                      const now = new Date();
                      // Parse the UTC timestamp from backend - ensure it's treated as UTC
                      const date = new Date(
                        dateString.endsWith("Z")
                          ? dateString
                          : dateString + "Z",
                      );

                      // Calculate difference in milliseconds using current local time
                      const diffInMs = now.getTime() - date.getTime();
                      const diffInMins = Math.floor(diffInMs / (1000 * 60));
                      const diffInHours = Math.floor(diffInMins / 60);
                      const diffInDays = Math.floor(diffInHours / 24);

                      if (diffInDays > 0)
                        return `${diffInDays} day${diffInDays > 1 ? "s" : ""} ago`;
                      if (diffInHours > 0)
                        return `${diffInHours} hour${diffInHours > 1 ? "s" : ""} ago`;
                      if (diffInMins > 0)
                        return `${diffInMins} min${diffInMins > 1 ? "s" : ""} ago`;
                      return "Just now";
                    };

                    const { icon, color } = getActivityIcon(
                      activity.activityType,
                    );

                    return (
                      <div
                        key={activity.id}
                        className="flex items-center space-x-3 p-3 bg-muted rounded-lg"
                      >
                        {activity.activityType === "user_created" && (
                          <div className="w-8 h-8 rounded-full bg-green-200 flex items-center justify-center">
                            <UserPlus className="w-5 h-5 text-green-700" />
                          </div>
                        )}
                        {activity.activityType === "user_deleted" && (
                          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                            <UserX className="w-5 h-5 text-red-600" />
                          </div>
                        )}
                        {activity.activityType === "opd_scheduled" && (
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                            <Stethoscope className="w-5 h-5 text-blue-600" />
                          </div>
                        )}
                        {activity.activityType === "lab_test_ordered" && (
                          <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center">
                            <TestTubeDiagonal className="w-5 h-5 text-pink-600" />
                          </div>
                        )}
                        {activity.activityType === "service_scheduled" && (
                          <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                            <ClipboardPlus className="w-5 h-5 text-purple-600" />
                          </div>
                        )}
                        {(activity.activityType === "doctor_deleted" ||
                          activity.activityType === "doctor_deactivated") && (
                          <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                            <UserMinus className="w-5 h-5 text-orange-600" />
                          </div>
                        )}
                        {activity.activityType === "doctor_restored" && (
                          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                            <UserCheck className="w-5 h-5 text-green-600" />
                          </div>
                        )}
                        {activity.activityType === "doctor_created" && (
                          <div className="w-8 h-8 rounded-full bg-green-200 flex items-center justify-center">
                            <UserStarIcon className="w-5 h-5 text-green-800" />
                          </div>
                        )}
                        {activity.activityType === "doctor_updated" && (
                          <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                            <UserPen className="w-5 h-5 text-amber-700" />
                          </div>
                        )}
                        {activity.activityType ===
                          "doctor_permanently_deleted" && (
                          <div className="w-8 h-8 rounded-full bg-red-200 flex items-center justify-center">
                            <Trash2 className="w-5 h-5 text-red-700" />
                          </div>
                        )}
                        {activity.activityType === "user_updated" && (
                          <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                            <UserPen className="w-5 h-5 text-amber-700" />
                          </div>
                        )}
                        {activity.activityType === "payment_added" && (
                          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                            <IndianRupee className="w-5 h-5 text-emerald-700" />
                          </div>
                        )}
                        {activity.activityType === "discount_added" && (
                          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                            <IndianRupee className="w-5 h-5 text-red-700" />
                          </div>
                        )}
                        {activity.activityType === "patient_registered" && (
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                            <CircleUser className="w-5 h-5 text-blue-700" />
                          </div>
                        )}
                        {activity.activityType === "patient_admitted" && (
                          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                            <BedSingle className="w-5 h-5 text-green-700" />
                          </div>
                        )}
                        {activity.activityType === "patient_discharged" && (
                          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                            <ClipboardX className="w-5 h-5 text-red-700" />
                          </div>
                        )}
                        {activity.activityType === "system_config_changed" && (
                          <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center">
                            <Settings className="w-5 h-5 text-white" />
                          </div>
                        )}
                        {activity.activityType === "hospital_info_changed" && (
                          <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center">
                            <Settings className="w-5 h-5 text-white" />
                          </div>
                        )}
                        {activity.activityType === "backup_created" && (
                          <div className="w-8 h-8 rounded-full bg-indigo-700 flex items-center justify-center">
                            <DatabaseZap className="w-5 h-5 text-white" />
                          </div>
                        )}
                        {activity.activityType === "room_created" && (
                          <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center">
                            <Pencil className="w-5 h-5 text-teal-700" />
                          </div>
                        )}
                        {activity.activityType === "room_deleted" && (
                          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                            <Pencil className="w-5 h-5 text-red-700" />
                          </div>
                        )}
                        {activity.activityType === "service_created" && (
                          <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center">
                            <Pencil className="w-5 h-5 text-teal-700" />
                          </div>
                        )}
                        {activity.activityType === "service_deleted" && (
                          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                            <Pencil className="w-5 h-5 text-red-700" />
                          </div>
                        )}
                        {activity.activityType !== "user_created" &&
                          activity.activityType !== "user_updated" &&
                          activity.activityType !== "user_deleted" &&
                          activity.activityType !== "opd_scheduled" &&
                          activity.activityType !== "lab_test_ordered" &&
                          activity.activityType !== "service_scheduled" &&
                          activity.activityType !== "doctor_deleted" &&
                          activity.activityType !== "doctor_deactivated" &&
                          activity.activityType !== "doctor_restored" &&
                          activity.activityType !== "doctor_created" &&
                          activity.activityType !== "doctor_updated" &&
                          activity.activityType !==
                            "doctor_permanently_deleted" &&
                          activity.activityType !== "payment_added" &&
                          activity.activityType !== "discount_added" &&
                          activity.activityType !== "patient_registered" &&
                          activity.activityType !== "patient_admitted" &&
                          activity.activityType !== "patient_discharged" &&
                          activity.activityType !== "system_config_changed" &&
                          activity.activityType !== "hospital_info_changed" &&
                          activity.activityType !== "backup_created" &&
                          activity.activityType !== "room_created" &&
                          activity.activityType !== "room_deleted" &&
                          activity.activityType !== "service_created" &&
                          activity.activityType !== "service_deleted" && (
                            <div
                              className={`w-8 h-8 ${color} rounded-full flex items-center justify-center`}
                            >
                              <span className="text-white text-xs">{icon}</span>
                            </div>
                          )}
                        <div className="flex-1">
                          <p className="text-sm font-medium">
                            {activity.title}
                          </p>
                          <p className="text-xs text-text-muted">
                            {activity.description}
                          </p>
                        </div>
                        <p className="text-xs text-text-muted">
                          {formatTimeAgo(activity.createdAt)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="flex flex-col h-full">
            <CardHeader className="flex-shrink-0">
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto">
              <div className="grid grid-cols-3 gap-4 h-full content-start">
                <button
                  onClick={() => {
                    if (!canManagePatients) {
                      setIsAccessDeniedPatientOpen(true);
                    } else {
                      setIsNewPatientOpen(true);
                    }
                  }}
                  className="p-4 bg-medical-blue text-white rounded-lg hover:bg-blue-800 transition-colors shadow-sm"
                  data-testid="quick-new-patient"
                >
                  <div className="text-center">
                    <div className="text-lg font-semibold">Add Patient</div>
                    <div className="text-sm opacity-90">Register new</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    if (!canManagePatients) {
                      setIsAccessDeniedLabTestOpen(true);
                    } else {
                      setIsPathologyOrderOpen(true);
                    }
                  }}
                  className="p-4 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors shadow-sm"
                  data-testid="quick-new-test"
                >
                  <div className="text-center">
                    <div className="text-lg font-semibold">Lab Test</div>
                    <div className="text-sm opacity-90">Order test</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    if (!canManagePatients) {
                      setIsAccessDeniedServiceOpen(true);
                    } else {
                      setSelectedPatientForService("");
                      setIsServiceDialogOpen(true);
                    }
                  }}
                  className="p-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors shadow-sm"
                  data-testid="quick-add-service"
                >
                  <div className="text-center">
                    <div className="text-lg font-semibold">Add Service</div>
                    <div className="text-sm opacity-90">Schedule Service</div>
                  </div>
                </button>

                <button
                  onClick={() => navigate("/bed-occupancy")}
                  className="p-4 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors shadow-sm"
                  data-testid="quick-bed-occupancy"
                >
                  <div className="text-center">
                    <div className="text-lg font-semibold">Occupancy</div>
                    <div className="text-sm opacity-90">Check Beds</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    if (!canManagePatients) {
                      setIsAccessDeniedAdmissionOpen(true);
                    } else {
                      setSelectedPatientForAdmission("");
                      setIsAdmissionDialogOpen(true);
                    }
                  }}
                  className="p-4 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors shadow-sm"
                  data-testid="quick-admit-patient"
                >
                  <div className="text-center">
                    <div className="text-lg font-semibold">Admit Patient</div>
                    <div className="text-sm opacity-90">New Admission</div>
                  </div>
                </button>

                <button
                  onClick={() => navigate("/pending-bills")}
                  className="p-4 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors shadow-sm"
                  data-testid="quick-view-pending"
                >
                  <div className="text-center">
                    <div className="text-lg font-semibold">Pending</div>
                    <div className="text-sm opacity-90">View bills</div>
                  </div>
                </button>

                <button
                  onClick={() => setIsFakeBillDialogOpen(true)}
                  className="p-4 bg-slate-500 text-white rounded-lg hover:bg-slate-600 transition-colors shadow-sm"
                  data-testid="quick-new-bill"
                >
                  <div className="text-center">
                    <div className="text-lg font-semibold">New Bill</div>
                    <div className="text-sm opacity-90">Create invoice</div>
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
                  <p className="text-sm text-destructive">
                    {form.formState.errors.name.message}
                  </p>
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
                  <p className="text-sm text-destructive">
                    {form.formState.errors.age.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="gender">Gender *</Label>
                <Select
                  value={form.watch("gender")}
                  onValueChange={(value) =>
                    form.setValue("gender", value, { shouldValidate: true })
                  }
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
                  <p className="text-sm text-destructive">
                    {form.formState.errors.gender.message}
                  </p>
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
                  <p className="text-sm text-destructive">
                    {form.formState.errors.phone.message}
                  </p>
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
                disabled={
                  createPatientMutation.isPending || !form.formState.isValid
                }
                className="bg-medical-blue hover:bg-medical-blue/90"
                data-testid="button-save-patient"
              >
                {createPatientMutation.isPending
                  ? "Saving..."
                  : "Register Patient"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Order Pathology Tests Dialog */}
      <Dialog
        open={isPathologyOrderOpen}
        onOpenChange={setIsPathologyOrderOpen}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Order Pathology Tests</DialogTitle>
          </DialogHeader>

          <form
            onSubmit={pathologyForm.handleSubmit(onPathologySubmit)}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="patientId">Patient *</Label>
                <PatientSearchCombobox
                  value={pathologyForm.watch("patientId")}
                  onValueChange={(value) =>
                    pathologyForm.setValue("patientId", value)
                  }
                  patients={patients || []}
                />
                {pathologyForm.formState.errors.patientId && (
                  <p className="text-sm text-red-500">
                    {pathologyForm.formState.errors.patientId.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="doctorId">
                  Doctor (Optional for External Patients)
                </Label>
                <Select
                  onValueChange={(value) =>
                    pathologyForm.setValue("doctorId", value)
                  }
                  data-testid="select-doctor"
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select doctor (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="external">
                      External Patient (No Doctor)
                    </SelectItem>
                    {(doctors || []).map((doctor: any) => (
                      <SelectItem key={doctor.id} value={doctor.id}>
                        {doctor.name} - {doctor.specialization}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="orderedDate">Order Date & Time *</Label>
                <Input
                  type="datetime-local"
                  {...pathologyForm.register("orderedDate")}
                  data-testid="input-ordered-datetime"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Select Tests from Catalog</Label>
                <div className="flex items-center space-x-2">
                  <Select
                    value={selectedCategory}
                    onValueChange={setSelectedCategory}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {(categories || []).map((category: string) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
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
                      data-testid="search-catalog-tests"
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
                      const isSelected = selectedCatalogTests.some(
                        (t) => t.test_name === test.test_name,
                      );
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
                          <TableCell className="font-medium">
                            {test.test_name}
                          </TableCell>
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
                  <h4 className="font-medium text-blue-900 mb-2">
                    Selected Tests ({selectedCatalogTests.length})
                  </h4>
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
                data-testid="input-remarks"
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsPathologyOrderOpen(false)}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  createOrderMutation.isPending ||
                  selectedCatalogTests.length === 0
                }
                data-testid="button-order-tests"
              >
                {createOrderMutation.isPending
                  ? "Ordering..."
                  : `Order ${selectedCatalogTests.length} Test(s)`}
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
      <Dialog
        open={isAccessDeniedPatientOpen}
        onOpenChange={setIsAccessDeniedPatientOpen}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Access Restricted</DialogTitle>
          </DialogHeader>
          <div className="p-4">
            <AccessRestricted
              title="Patient Registration Restricted"
              description="Only receptionists can register new patients."
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isAccessDeniedLabTestOpen}
        onOpenChange={setIsAccessDeniedLabTestOpen}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Access Restricted</DialogTitle>
          </DialogHeader>
          <div className="p-4">
            <AccessRestricted
              title="Lab Test Ordering Restricted"
              description="Only receptionists can order lab tests."
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isAccessDeniedServiceOpen}
        onOpenChange={setIsAccessDeniedServiceOpen}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Access Restricted</DialogTitle>
          </DialogHeader>
          <div className="p-4">
            <AccessRestricted
              title="Service Scheduling Restricted"
              description="Only receptionists can schedule services."
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isAccessDeniedAdmissionOpen}
        onOpenChange={setIsAccessDeniedAdmissionOpen}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Access Restricted</DialogTitle>
          </DialogHeader>
          <div className="p-4">
            <AccessRestricted
              title="Admission Restricted"
              description="Only receptionists can admit patients."
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Schedule Service Dialog */}
      <Dialog open={isServiceDialogOpen} onOpenChange={setIsServiceDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Schedule Patient Service</DialogTitle>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = serviceForm.getValues();
              onServiceSubmit(formData);
            }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="patientId">Patient *</Label>
                <PatientSearchCombobox
                  value={selectedPatientForService}
                  onValueChange={(value) => {
                    setSelectedPatientForService(value);
                    serviceForm.setValue("patientId", value);
                  }}
                  patients={patients || []}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="doctorId">Assigned Doctor (Optional)</Label>
                <Select
                  value={serviceForm.watch("doctorId") || ""}
                  onValueChange={(value) =>
                    serviceForm.setValue("doctorId", value)
                  }
                  data-testid="select-doctor"
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select doctor (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No doctor assigned</SelectItem>
                    {(doctors || []).map((doctor: any) => (
                      <SelectItem key={doctor.id} value={doctor.id}>
                        {doctor.name} - {doctor.specialization}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="scheduledDateTime">
                  Scheduled Date & Time *
                </Label>
                <Input
                  type="datetime-local"
                  value={
                    serviceForm.watch("scheduledDate") &&
                    serviceForm.watch("scheduledTime")
                      ? `${serviceForm.watch("scheduledDate")}T${serviceForm.watch("scheduledTime")}`
                      : ""
                  }
                  onChange={(e) => {
                    if (e.target.value) {
                      const [date, time] = e.target.value.split("T");
                      serviceForm.setValue("scheduledDate", date);
                      serviceForm.setValue("scheduledTime", time);
                    }
                  }}
                  data-testid="input-scheduled-datetime"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Select Services from Catalog</Label>
                <div className="flex items-center space-x-2">
                  <Select
                    value={selectedServiceCategory || "all"}
                    onValueChange={(value) => {
                      setSelectedServiceCategory(value === "all" ? "" : value);
                      setSelectedServices([]);
                    }}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {serviceCategories.map((category) => (
                        <SelectItem key={category.key} value={category.key}>
                          <div className="flex items-center gap-2">
                            <category.icon className="h-4 w-4" />
                            {category.label}
                          </div>
                        </SelectItem>
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
                      placeholder="Search services by name..."
                      value={selectedServiceSearchQuery}
                      onChange={(e) =>
                        setSelectedServiceSearchQuery(e.target.value)
                      }
                      className="pl-10"
                      data-testid="search-services"
                    />
                  </div>
                </div>
              </div>

              <div className="border rounded-lg max-h-64 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Select</TableHead>
                      <TableHead>Service Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Price (₹)</TableHead>
                      <TableHead className="text-right w-24">
                        Quantity
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getFilteredServices(selectedServiceCategory).length ===
                    0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center text-muted-foreground py-8"
                        >
                          No services found. Try adjusting your search or
                          category filter.
                        </TableCell>
                      </TableRow>
                    ) : (
                      getFilteredServices(selectedServiceCategory).map(
                        (service: any) => {
                          const isSelected = selectedServices.some(
                            (s) => s.id === service.id,
                          );
                          return (
                            <TableRow
                              key={service.id}
                              className={isSelected ? "bg-blue-50" : ""}
                            >
                              <TableCell>
                                <Checkbox
                                  checked={isSelected}
                                  data-testid={`checkbox-service-${service.id}`}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSelectedServices([
                                        ...selectedServices,
                                        { ...service, quantity: 1 },
                                      ]);
                                    } else {
                                      setSelectedServices(
                                        selectedServices.filter(
                                          (s) => s.id !== service.id,
                                        ),
                                      );
                                    }
                                  }}
                                />
                              </TableCell>
                              <TableCell className="font-medium">
                                {service.name}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {serviceCategories.find(
                                    (cat) => cat.key === service.category,
                                  )?.label || service.category}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                {service.price === 0 ? (
                                  <Badge variant="secondary">Variable</Badge>
                                ) : (
                                  `₹${service.price}`
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {isSelected ? (
                                  <Input
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={
                                      selectedServices.find(
                                        (s) => s.id === service.id,
                                      )?.quantity || 1
                                    }
                                    onChange={(e) => {
                                      const quantity =
                                        parseInt(e.target.value) || 1;
                                      setSelectedServices(
                                        selectedServices.map((s) =>
                                          s.id === service.id
                                            ? { ...s, quantity }
                                            : s,
                                        ),
                                      );
                                    }}
                                    className="w-20 h-8"
                                    placeholder="qty"
                                  />
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        },
                      )
                    )}
                  </TableBody>
                </Table>
              </div>

              {selectedServices.length > 0 && (
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">
                    Selected Services ({selectedServices.length})
                  </h4>
                  <div className="space-y-1">
                    {selectedServices.map((service) => (
                      <div
                        key={service.id}
                        className="flex justify-between text-sm"
                      >
                        <span>
                          {service.name} (x{service.quantity})
                        </span>
                        <span>₹{service.price * service.quantity}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-blue-200 mt-2 pt-2 font-medium text-blue-900">
                    Total: ₹
                    {selectedServices.reduce(
                      (total, s) => total + s.price * s.quantity,
                      0,
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                {...serviceForm.register("notes")}
                placeholder="Enter any additional notes or instructions"
                data-testid="input-notes"
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsServiceDialogOpen(false);
                  setSelectedPatientForService("");
                  setSelectedServices([]);
                  setSelectedServiceCategory("");
                  setSelectedServiceSearchQuery("");
                  serviceForm.reset();
                }}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  createServiceMutation.isPending ||
                  selectedServices.length === 0 ||
                  !selectedPatientForService
                }
                data-testid="button-schedule-service"
              >
                {createServiceMutation.isPending
                  ? "Scheduling..."
                  : `Schedule ${selectedServices.length} Service(s)`}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Admit Patient Dialog */}
      <Dialog
        open={isAdmissionDialogOpen}
        onOpenChange={setIsAdmissionDialogOpen}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Admit Patient</DialogTitle>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = admissionForm.getValues();
              formData.patientId = selectedPatientForAdmission;
              onAdmissionSubmit(formData);
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Patient *</Label>
                <PatientSearchCombobox
                  value={selectedPatientForAdmission}
                  onValueChange={(value) => {
                    setSelectedPatientForAdmission(value);
                    admissionForm.setValue("patientId", value);
                  }}
                  patients={patients || []}
                />
              </div>

              <div className="space-y-2">
                <Label>Doctor *</Label>
                <Select
                  value={admissionForm.watch("doctorId")}
                  onValueChange={(value) =>
                    admissionForm.setValue("doctorId", value)
                  }
                  data-testid="select-admission-doctor"
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select attending doctor" />
                  </SelectTrigger>
                  <SelectContent>
                    {(doctors || []).map((doctor: any) => (
                      <SelectItem key={doctor.id} value={doctor.id}>
                        {doctor.name} - {doctor.specialization}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Admission Date & Time *</Label>
                <Input
                  type="datetime-local"
                  value={admissionForm.watch("admissionDate")}
                  onChange={(e) =>
                    admissionForm.setValue("admissionDate", e.target.value)
                  }
                  data-testid="input-admission-date"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-9 gap-4">
              <div className="space-y-2 col-span-3">
                <Label>Ward/Room Type *</Label>
                <Select
                  value={admissionForm.watch("currentWardType")}
                  onValueChange={(value) => {
                    admissionForm.setValue("currentWardType", value);
                    admissionForm.setValue("currentRoomNumber", "");

                    const selectedRoomType = roomTypes.find(
                      (rt: any) => rt.name === value,
                    );

                    if (selectedRoomType) {
                      const updatedServices = selectedAdmissionServices.map(
                        (service) => {
                          if (
                            service.name === "Bed Charges" ||
                            service.name.toLowerCase().includes("bed charges")
                          ) {
                            return {
                              ...service,
                              price: selectedRoomType.dailyCost,
                            };
                          }
                          return service;
                        },
                      );
                      setSelectedAdmissionServices(updatedServices);

                      const totalServicesCost = updatedServices.reduce(
                        (total, service) => {
                          return total + (service.price || 0);
                        },
                        0,
                      );

                      admissionForm.setValue("dailyCost", totalServicesCost);
                    }
                  }}
                  data-testid="select-ward-type"
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select ward/room type" />
                  </SelectTrigger>
                  <SelectContent>
                    {roomTypes.map((roomType: any) => (
                      <SelectItem key={roomType.id} value={roomType.name}>
                        {roomType.name} ({roomType.category}) - ₹
                        {roomType.dailyCost}/day
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 col-span-2">
                <Label>Room Number *</Label>
                <Select
                  value={admissionForm.watch("currentRoomNumber")}
                  onValueChange={(value) =>
                    admissionForm.setValue("currentRoomNumber", value)
                  }
                  disabled={!admissionForm.watch("currentWardType")}
                  data-testid="select-room-number"
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        admissionForm.watch("currentWardType")
                          ? "Select available room"
                          : "Select ward type first"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {(() => {
                      const selectedWardType =
                        admissionForm.watch("currentWardType");
                      const selectedRoomType = roomTypes.find(
                        (rt: any) => rt.name === selectedWardType,
                      );

                      if (!selectedRoomType) return null;

                      const allRoomsForType = rooms.filter(
                        (room: any) =>
                          room.roomTypeId === selectedRoomType.id &&
                          room.isActive,
                      );

                      if (allRoomsForType.length === 0) {
                        return (
                          <SelectItem value="" disabled>
                            No rooms available in {selectedWardType}
                          </SelectItem>
                        );
                      }

                      const occupiedRoomNumbers = new Set(
                        allCurrentAdmissions
                          .filter(
                            (admission: any) =>
                              admission.currentWardType === selectedWardType &&
                              admission.status === "admitted",
                          )
                          .map((admission: any) => admission.currentRoomNumber),
                      );

                      return allRoomsForType.map((room: any) => {
                        const isOccupied = occupiedRoomNumbers.has(
                          room.roomNumber,
                        );

                        return (
                          <SelectItem
                            key={room.id}
                            value={room.roomNumber}
                            disabled={isOccupied}
                            className={
                              isOccupied
                                ? "text-gray-500 bg-gray-200 dark:bg-gray-800 dark:text-gray-400 cursor-not-allowed opacity-60 hover:bg-gray-200 dark:hover:bg-gray-800"
                                : ""
                            }
                          >
                            {room.roomNumber}
                            {isOccupied ? " (Occupied)" : ""}
                          </SelectItem>
                        );
                      });
                    })()}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 col-span-2">
                <Label>Daily Cost (₹) *</Label>
                <Input
                  type="number"
                  value={admissionForm.watch("dailyCost")}
                  onChange={(e) =>
                    admissionForm.setValue(
                      "dailyCost",
                      parseFloat(e.target.value) || 0,
                    )
                  }
                  placeholder="Total cost of selected services"
                  data-testid="input-daily-cost"
                  readOnly={true}
                  className="bg-gray-50"
                />
                <p className="text-xs text-muted-foreground">
                  Automatically calculated from selected admission services
                </p>
              </div>

              <div className="space-y-2 col-span-2">
                <Label>Initial Deposit (₹)</Label>
                <Input
                  type="number"
                  value={admissionForm.watch("initialDeposit")}
                  onChange={(e) =>
                    admissionForm.setValue(
                      "initialDeposit",
                      parseFloat(e.target.value) || 0,
                    )
                  }
                  placeholder="Initial deposit amount"
                  data-testid="input-initial-deposit"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-lg font-semibold">
                  Select Admission Services
                </Label>
                <div className="flex items-center space-x-2">
                  <Input
                    placeholder="Search admission services..."
                    value={selectedAdmissionServiceSearchQuery}
                    onChange={(e) => {
                      setSelectedAdmissionServiceSearchQuery(e.target.value);
                    }}
                    className="w-64"
                    data-testid="search-admission-services"
                  />
                </div>
              </div>

              <div className="border rounded-lg max-h-64 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Select</TableHead>
                      <TableHead>Service Name</TableHead>
                      <TableHead>Billing Type</TableHead>
                      <TableHead className="text-right">Price (₹)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      const admissionServices =
                        allServices?.filter(
                          (service: any) =>
                            service.category === "admissions" &&
                            service.isActive,
                        ) || [];

                      const filteredServices =
                        selectedAdmissionServiceSearchQuery.trim()
                          ? admissionServices.filter(
                              (service: any) =>
                                service.name
                                  .toLowerCase()
                                  .includes(
                                    selectedAdmissionServiceSearchQuery.toLowerCase(),
                                  ) ||
                                (service.description &&
                                  service.description
                                    .toLowerCase()
                                    .includes(
                                      selectedAdmissionServiceSearchQuery.toLowerCase(),
                                    )),
                            )
                          : admissionServices;

                      if (filteredServices.length === 0) {
                        return (
                          <TableRow>
                            <TableCell
                              colSpan={4}
                              className="text-center text-muted-foreground py-8"
                            >
                              No admission services found.{" "}
                              {selectedAdmissionServiceSearchQuery
                                ? "Try adjusting your search."
                                : "Create admission services in the Services page first."}
                            </TableCell>
                          </TableRow>
                        );
                      }

                      return filteredServices.map((service: any) => {
                        const isSelected = selectedAdmissionServices.some(
                          (s) => s.id === service.id,
                        );
                        const selectedService = selectedAdmissionServices.find(
                          (s) => s.id === service.id,
                        );

                        let displayPrice = service.price;
                        if (
                          (service.name === "Bed Charges" ||
                            service.name
                              .toLowerCase()
                              .includes("bed charges")) &&
                          selectedService
                        ) {
                          displayPrice = selectedService.price;
                        }

                        return (
                          <TableRow
                            key={service.id}
                            className={isSelected ? "bg-blue-50" : ""}
                          >
                            <TableCell>
                              <Checkbox
                                checked={isSelected}
                                data-testid={`checkbox-admission-service-${service.id}`}
                                onCheckedChange={(checked) => {
                                  let updatedServices;
                                  if (checked) {
                                    const currentWardType =
                                      admissionForm.watch("currentWardType");
                                    const selectedRoomType = roomTypes.find(
                                      (rt: any) => rt.name === currentWardType,
                                    );

                                    let serviceToAdd = {
                                      ...service,
                                      quantity: 1,
                                    };

                                    if (
                                      (service.name === "Bed Charges" ||
                                        service.name
                                          .toLowerCase()
                                          .includes("bed charges")) &&
                                      selectedRoomType
                                    ) {
                                      serviceToAdd.price =
                                        selectedRoomType.dailyCost;
                                    }

                                    updatedServices = [
                                      ...selectedAdmissionServices,
                                      serviceToAdd,
                                    ];
                                  } else {
                                    updatedServices =
                                      selectedAdmissionServices.filter(
                                        (s) => s.id !== service.id,
                                      );
                                  }

                                  setSelectedAdmissionServices(updatedServices);

                                  const totalServicesCost =
                                    updatedServices.reduce(
                                      (total, selectedService) => {
                                        return (
                                          total + (selectedService.price || 0)
                                        );
                                      },
                                      0,
                                    );

                                  admissionForm.setValue(
                                    "dailyCost",
                                    totalServicesCost,
                                  );
                                }}
                              />
                            </TableCell>
                            <TableCell className="font-medium">
                              {service.name}
                              {service.description && (
                                <div className="text-sm text-muted-foreground">
                                  {service.description}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={
                                  service.billingType === "per_date"
                                    ? "bg-indigo-100 text-indigo-800"
                                    : service.billingType === "per_24_hours"
                                      ? "bg-green-100 text-green-800"
                                      : "bg-gray-100 text-gray-800"
                                }
                              >
                                {service.billingType === "per_date"
                                  ? "Per Date"
                                  : service.billingType === "per_24_hours"
                                    ? "Per 24 Hours"
                                    : service.billingType || "Per Instance"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              ₹{displayPrice}
                              {(service.billingType === "per_date" ||
                                service.billingType === "per_24_hours") && (
                                <div className="text-xs text-muted-foreground">
                                  Auto-billed during stay
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      });
                    })()}
                  </TableBody>
                </Table>
              </div>

              {selectedAdmissionServices.length > 0 && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium mb-3">
                    Selected Admission Services
                  </h4>
                  <div className="space-y-2">
                    {selectedAdmissionServices.map((service) => (
                      <div
                        key={service.id}
                        className="flex justify-between items-center text-sm"
                      >
                        <span className="font-medium">{service.name}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {service.billingType === "per_date"
                              ? "Per Date"
                              : service.billingType === "per_24_hours"
                                ? "Per 24 Hours"
                                : service.billingType || "Per Instance"}
                          </Badge>
                          <span>₹{service.price}</span>
                        </div>
                      </div>
                    ))}
                    <div className="border-t pt-2 mt-2 flex justify-between items-center font-semibold">
                      <span>Total Daily Cost:</span>
                      <span>
                        ₹
                        {selectedAdmissionServices.reduce(
                          (total, service) => total + (service.price || 0),
                          0,
                        )}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      * Services with per_date/per_24_hours billing will be
                      automatically charged during the admission period
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Reason for Admission</Label>
              <Input
                value={admissionForm.watch("reason")}
                onChange={(e) =>
                  admissionForm.setValue("reason", e.target.value)
                }
                placeholder="Brief reason for admission (optional)"
                data-testid="input-admission-reason"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsAdmissionDialogOpen(false);
                  setSelectedPatientForAdmission("");
                  setSelectedAdmissionServices([]);
                  setSelectedAdmissionServiceSearchQuery("");
                }}
                data-testid="button-cancel-admission"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isCreatingAdmission || !selectedPatientForAdmission}
                data-testid="button-admit"
              >
                {isCreatingAdmission ? "Admitting..." : "Admit Patient"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Footer />
    </div>
  );
}
