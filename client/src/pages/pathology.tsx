import { useState } from "react";
import React from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import TopBar from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
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

import {
  TestTube,
  Eye,
  Search,
  Plus,
  ShoppingCart,
  Check,
  ChevronsUpDown,
} from "lucide-react";
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
import { insertPathologyOrderSchema } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import AccessRestricted from "@/components/access-restricted";
import type {
  PathologyOrder,
  Patient,
  Doctor,
  Service,
  PathologyCategory,
  PathologyCategoryTest,
} from "@shared/schema";

// Patient Search Combobox Component
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
          data-testid="button-select-patient"
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
            data-testid="input-search-patient"
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
                  data-testid={`option-patient-${patient.id}`}
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

  const getPatientName = (patientId: string) => {
    return orderDetails?.patient?.name || "Unknown Patient";
  };

  const getDoctorName = (doctorId: string | null) => {
    if (!doctorId) return "External Patient";
    return orderDetails?.doctor?.name || "Unknown Doctor";
  };

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
                  {getPatientName(order.patientId)}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium">Doctor</Label>
                <p className="text-sm text-muted-foreground">
                  {getDoctorName(order.doctorId)}
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
                <p className="text-sm text-muted-foreground">{order.remarks}</p>
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
                      <TableHead className="bg-background">Test Name</TableHead>
                      <TableHead className="bg-background">Category</TableHead>
                      <TableHead className="bg-background">Status</TableHead>
                      <TableHead className="bg-background">Price (₹)</TableHead>
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

export default function Pathology() {
  // Get URL parameters for pre-selected patient
  const urlParams = new URLSearchParams(window.location.search);
  const preSelectedPatientId = urlParams.get("patientId");
  const preSelectedPatientName = urlParams.get("patientName");

  const [isNewTestOpen, setIsNewTestOpen] = useState(!!preSelectedPatientId);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedCatalogTests, setSelectedCatalogTests] = useState<any[]>([]);
  const [catalogSearchQuery, setCatalogSearchQuery] = useState("");
  const { toast } = useToast();
  const { user } = useAuth();

  // Check if user has appropriate role for pathology creation
  const currentUserRoles = user?.roles || [user?.role]; // Backward compatibility
  const isBillingStaff =
    currentUserRoles.includes("billing_staff") &&
    !currentUserRoles.includes("admin") &&
    !currentUserRoles.includes("super_user");

  const { data: pathologyOrders = [], isLoading } = useQuery({
    queryKey: ["/api/pathology"],
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

  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({
      orderId,
      status,
    }: {
      orderId: string;
      status: string;
    }) => {
      const response = await fetch(`/api/pathology/${orderId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("hospital_token")}`,
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error("Failed to update order status");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pathology"] });
      toast({
        title: "Status updated",
        description: "Order status updated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error updating status",
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pathology"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/pathology/patient", preSelectedPatientId],
      });
      setIsNewTestOpen(false);
      setSelectedCatalogTests([]);
      form.reset();
      toast({
        title: "Order placed successfully",
        description: "The pathology order has been placed.",
      });

      // Redirect back to patient page if came from there
      if (preSelectedPatientId) {
        setTimeout(() => {
          window.location.href = `/patients/${preSelectedPatientId}#pathology`;
        }, 500);
      }
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
    resolver: zodResolver(insertPathologyOrderSchema),
    defaultValues: {
      patientId: preSelectedPatientId || "",
      doctorId: "",
      orderedDate: "", // Will be set by useEffect
      remarks: "",
    },
  });

  // Set default date based on configured timezone
  const { data: systemSettings } = useQuery({
    queryKey: ["/api/settings/system"],
  });

  // Update ordered date and time when system settings load or timezone changes
  React.useEffect(() => {
    if (systemSettings?.timezone && isNewTestOpen) {
      const timezone = systemSettings.timezone;
      const now = new Date();

      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
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

      form.setValue("orderedDate", currentDateTime);
    }
  }, [systemSettings?.timezone, isNewTestOpen]);

  const onSubmit = (data: any) => {
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

  const filteredOrders = (pathologyOrders || []).filter((orderData: any) => {
    if (!orderData?.order) return false;
    const order = orderData.order;
    const patient = orderData.patient;
    const matchesSearch =
      order.orderId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      patient?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      patient?.patientId?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredCatalog = (testCatalog || []).filter((test: any) => {
    const matchesCategory =
      selectedCategory === "all" || test.category === selectedCategory;
    const matchesSearch = test.test_name
      ?.toLowerCase()
      .includes(catalogSearchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
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
      case "paid":
        return "bg-green-100 text-green-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
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

  const getPatientName = (patientId: string) => {
    const patient = (patients || []).find((p: Patient) => p.id === patientId);
    return patient?.name || "Unknown Patient";
  };

  const getDoctorName = (doctorId: string | null) => {
    if (!doctorId) return "External Patient";
    const doctor = (doctors || []).find((d: Doctor) => d.id === doctorId);
    return doctor?.name || "Unknown Doctor";
  };

  const getAvailableStatusOptions = (currentStatus: string) => {
    switch (currentStatus) {
      case "ordered":
        return ["cancelled"]; // paid only happens automatically on payment
      case "paid":
        return ["cancelled", "collected"];
      case "collected":
        return ["processing"];
      case "processing":
        return ["completed"];
      case "completed":
      case "cancelled":
        return []; // locked, no transitions allowed
      default:
        return [];
    }
  };

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

  return (
    <div>
      <TopBar
        title="Pathology Tests"
        searchPlaceholder="Search tests by name or ID..."
        onSearch={setSearchQuery}
        onNewAction={isBillingStaff ? undefined : () => setIsNewTestOpen(true)}
        newActionLabel={isBillingStaff ? undefined : "Order Test"}
      />

      <div className="px-6 pb-6 pt-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle>Pathology Orders</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Total: {filteredOrders.length} orders
                </p>
              </div>
              <div className="flex items-center flex-wrap gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40" data-testid="filter-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="ordered">Ordered</SelectItem>
                    <SelectItem value="collected">Collected</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-medical-blue mx-auto"></div>
                <p className="text-sm text-muted-foreground mt-2">
                  Loading tests...
                </p>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-8">
                <TestTube className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  No orders found
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  No pathology orders match your current search criteria.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Doctor</TableHead>
                    <TableHead>Date Ordered</TableHead>
                    <TableHead>Total Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((orderData: any) => {
                    const order = orderData.order;
                    const patient = orderData.patient;
                    const doctor = orderData.doctor;

                    return (
                      <TableRow
                        key={order.id}
                        data-testid={`order-row-${order.id}`}
                      >
                        <TableCell className="font-medium">
                          {order.orderId}
                        </TableCell>
                        <TableCell>
                          {patient?.name || "Unknown Patient"}
                        </TableCell>
                        <TableCell>
                          {doctor?.name || "External Patient"}
                        </TableCell>
                        <TableCell>{formatDate(order.orderedDate)}</TableCell>
                        <TableCell>₹{order.totalPrice}</TableCell>
                        <TableCell>
                          <Badge
                            className={getStatusColor(order.status)}
                            variant="secondary"
                          >
                            {order.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedOrder(order)}
                              data-testid={`view-order-${order.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Select
                              value={order.status}
                              onValueChange={(newStatus) =>
                                updateOrderStatusMutation.mutate({
                                  orderId: order.id,
                                  status: newStatus,
                                })
                              }
                              disabled={
                                updateOrderStatusMutation.isPending ||
                                getAvailableStatusOptions(order.status)
                                  .length === 0
                              }
                            >
                              <SelectTrigger
                                className="w-32"
                                data-testid={`status-select-${order.id}`}
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem
                                  value="ordered"
                                  disabled={
                                    !getAvailableStatusOptions(
                                      order.status,
                                    ).includes("ordered")
                                  }
                                >
                                  Ordered
                                </SelectItem>
                                <SelectItem
                                  value="collected"
                                  disabled={
                                    !getAvailableStatusOptions(
                                      order.status,
                                    ).includes("collected")
                                  }
                                >
                                  Collected
                                </SelectItem>
                                <SelectItem
                                  value="processing"
                                  disabled={
                                    !getAvailableStatusOptions(
                                      order.status,
                                    ).includes("processing")
                                  }
                                >
                                  Processing
                                </SelectItem>
                                <SelectItem
                                  value="completed"
                                  disabled={
                                    !getAvailableStatusOptions(
                                      order.status,
                                    ).includes("completed")
                                  }
                                >
                                  Completed
                                </SelectItem>
                                <SelectItem value="paid" disabled={true}>
                                  Paid
                                </SelectItem>
                                <SelectItem
                                  value="cancelled"
                                  disabled={
                                    !getAvailableStatusOptions(
                                      order.status,
                                    ).includes("cancelled")
                                  }
                                >
                                  Cancelled
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Order New Test Dialog */}
      <Dialog open={isNewTestOpen} onOpenChange={setIsNewTestOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Order Pathology Tests</DialogTitle>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="patientId">Patient *</Label>
                <PatientSearchCombobox
                  value={form.watch("patientId")}
                  onValueChange={(value) => form.setValue("patientId", value)}
                  patients={patients || []}
                />
                {form.formState.errors.patientId && (
                  <p className="text-sm text-red-500">
                    {form.formState.errors.patientId.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="doctorId">
                  Doctor (Optional for External Patients)
                </Label>
                <Select
                  onValueChange={(value) => form.setValue("doctorId", value)}
                  data-testid="select-doctor"
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select doctor (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="external">
                      External Patient (No Doctor)
                    </SelectItem>
                    {(doctors || []).map((doctor: Doctor) => (
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
                  {...form.register("orderedDate")}
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
                {...form.register("remarks")}
                placeholder="Enter any additional remarks or instructions"
                data-testid="input-remarks"
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsNewTestOpen(false)}
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
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </div>
  );
}
