import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  User,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Stethoscope,
  TestTube,
  X,
  Heart,
  Bed,
  FileText,
  ClipboardList,
  Plus,
  Eye,
  Clock,
  Minus,
  Edit,
  Settings,
  Printer,
  Search,
  DollarSign,
} from "lucide-react";
import {
  insertPatientServiceSchema,
  insertAdmissionSchema,
} from "@shared/schema";
import { z } from "zod";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ReceiptTemplate } from "@/components/receipt-template";
// Removed SmartBillingDialog import as it's no longer used
import { parseTimestamp, calcStayDays } from "@/lib/time";
import type {
  Patient,
  PatientService,
  Admission,
  AdmissionEvent,
  Doctor,
} from "@shared/schema";
import { Checkbox } from "@/components/ui/checkbox";
import { ComprehensiveBillTemplate } from "@/components/comprehensive-bill-template"; // Import ComprehensiveBillTemplate
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";

// Define Service interface with quantity
interface Service {
  id: string;
  name: string;
  category: string;
  price: number;
  description?: string;
  isActive?: boolean;
  billingType?: string;
  billingParameters?: string;
  quantity?: number; // Added quantity property
}

export default function PatientDetail() {
  const params = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const patientId = params.id;

  const [isServiceDialogOpen, setIsServiceDialogOpen] = useState(false);
  const [selectedServiceType, setSelectedServiceType] = useState("opd");
  const [selectedServiceCategory, setSelectedServiceCategory] =
    useState<string>("");
  const [selectedServiceSearchQuery, setSelectedServiceSearchQuery] =
    useState(""); // Renamed from serviceSearchQuery to avoid conflict
  const [selectedServiceCategorySearchQuery, setSelectedServiceCategorySearchQuery] =
    useState(""); // Added for filtering services by category name
  const [selectedCatalogService, setSelectedCatalogService] =
    useState<any>(null);
  const [billingPreview, setBillingPreview] = useState<any>(null);
  const [isAdmissionDialogOpen, setIsAdmissionDialogOpen] = useState(false);
  const [isDischargeDialogOpen, setIsDischargeDialogOpen] = useState(false);
  const [isRoomUpdateDialogOpen, setIsRoomUpdateDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [selectedAdmissionForPayment, setSelectedAdmissionForPayment] =
    useState("");
  const [isDiscountDialogOpen, setIsDiscountDialogOpen] = useState(false);
  const [discountAmount, setDiscountAmount] = useState("");
  const [discountReason, setDiscountReason] = useState("");
  const [dischargeDateTime, setDischargeDateTime] = useState("");
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);

  // For Comprehensive Bill
  const [isComprehensiveBillOpen, setIsComprehensiveBillOpen] = useState(false);
  const [comprehensiveBillData, setComprehensiveBillData] = useState<any>(null);
  const [isLoadingBill, setIsLoadingBill] = useState(false);
  const [isOpdVisitDialogOpen, setIsOpdVisitDialogOpen] = useState(false);

  // Fetch hospital settings for receipts and other uses with proper error handling
  const {
    data: hospitalSettings,
    isLoading: isHospitalSettingsLoading,
    error: hospitalSettingsError,
  } = useQuery({
    queryKey: ["/api/settings/hospital"],
    queryFn: async () => {
      console.log("Fetching hospital settings...");
      const response = await fetch("/api/settings/hospital", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("hospital_token")}`,
        },
      });
      if (!response.ok) {
        console.error(
          "Failed to fetch hospital settings:",
          response.status,
          response.statusText,
        );
        throw new Error("Failed to fetch hospital settings");
      }
      const data = await response.json();
      console.log("Fetched hospital settings data:", data);
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 3,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  // Create hospital info object from settings - exactly like receipts
  const hospitalInfo = React.useMemo(() => {
    console.log("=== Hospital Info Creation ===");
    console.log("Hospital settings in patient detail:", hospitalSettings);
    console.log("Hospital settings loading:", isHospitalSettingsLoading);
    console.log("Hospital settings error:", hospitalSettingsError);

    // Always create hospital info object, preferring saved settings over defaults
    const info = {
      name:
        hospitalSettings?.name || "Health Care Hospital and Diagnostic Center",
      address:
        hospitalSettings?.address ||
        "In front of Maheshwari Garden, Binjhiya, Jabalpur Road, Mandla, Madhya Pradesh - 482001",
      phone: hospitalSettings?.phone || "8889762101, 9826325958",
      email: hospitalSettings?.email || "hospital@healthcare.in",
      registrationNumber:
        hospitalSettings?.registrationNumber || "NH/3613/JUL-2021",
      logo: hospitalSettings?.logoPath || undefined,
    };

    console.log(
      "Final hospital info constructed for comprehensive bill:",
      info,
    );
    console.log("=== End Hospital Info Creation ===");
    return info;
  }, [hospitalSettings, isHospitalSettingsLoading, hospitalSettingsError]);

  // Helper function to determine service type for receipt numbering
  const getServiceType = (eventType: string, event: any) => {
    switch (eventType) {
      case "service":
        // Check if it's OPD service
        if (
          event.serviceType === "opd" ||
          event.serviceName === "OPD Consultation"
        ) {
          return "opd";
        }
        // Check specific service categories
        const category = event.category?.toLowerCase();
        if (
          category === "discharge" ||
          event.description?.toLowerCase().includes("discharge")
        ) {
          return "discharge";
        }
        if (
          category === "room_transfer" ||
          event.description?.toLowerCase().includes("transfer")
        ) {
          return "room_transfer";
        }
        return "service";
      case "pathology":
        return "pathology";
      case "admission":
        return "admission";
      case "payment":
        return "payment";
      case "discount":
        return "discount";
      case "opd_visit": // Handle OPD visits
        return "opd";
      default:
        return eventType;
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

  // Helper function to get daily count for receipt numbering from API
  const getDailyCountFromAPI = async (
    eventType: string,
    eventDate: string,
    currentEvent: any,
  ): Promise<number> => {
    try {
      const serviceType = getServiceType(eventType, currentEvent);
      const response = await fetch(
        `/api/receipts/daily-count/${serviceType}/${eventDate}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("hospital_token")}`,
          },
        },
      );

      if (!response.ok) {
        console.error("Failed to get daily count from API");
        return 1;
      }

      const data = await response.json();
      return data.count;
    } catch (error) {
      console.error("Error fetching daily count:", error);
      return 1;
    }
  };

  const generateReceiptData = (event: any, eventType: string) => {
    // Helper function to get receipt number from different sources
    const getReceiptNumber = () => {
      // For services, always use the stored receiptNumber
      if (eventType === "service" && event.receiptNumber) {
        return event.receiptNumber;
      }

      // For pathology, try to get from order data
      if (eventType === "pathology") {
        if (event.rawData?.order?.receiptNumber) {
          return event.rawData.order.receiptNumber;
        }
        if (event.order?.receiptNumber) {
          return event.order.receiptNumber;
        }
        if (event.receiptNumber) {
          return event.receiptNumber;
        }
      }

      // For admission events, try to get from admission event data
      if (eventType === "admission_event") {
        if (event.rawData?.event?.receiptNumber) {
          return event.rawData.event.receiptNumber;
        }
        if (event.receiptNumber) {
          return event.receiptNumber;
        }
      }

      // For admission fallback, try to get from admission data
      if (eventType === "admission" && event.rawData?.admission?.receiptNumber) {
        return event.rawData.admission.receiptNumber;
      }
      if (eventType === "admission" && event.receiptNumber) {
        return event.receiptNumber;
      }

      // For OPD visits, use the ID as a temporary receipt reference if available
      if (eventType === "opd_visit" && event.id) {
        return `OPD-${event.id}`;
      }

      // For other event types, try direct access
      if (event.receiptNumber) {
        return event.receiptNumber;
      }

      return "RECEIPT-NOT-FOUND";
    };

    // Helper function to get doctor name from doctor ID
    const getDoctorName = () => {
      // First try to get doctor name from event directly
      if (event.doctorName) {
        return event.doctorName;
      }

      // Try to get from nested doctor object
      if (event.doctor?.name) {
        return event.doctor.name;
      }

      // Try to resolve doctor ID from the doctors array
      if (event.doctorId && doctors && doctors.length > 0) {
        const doctor = doctors.find((d: Doctor) => d.id === event.doctorId);
        if (doctor) {
          return doctor.name;
        }
      }

      // Try to get from rawData for pathology orders
      if (eventType === "pathology" && event.rawData?.order?.doctorId) {
        const doctor = doctors.find(
          (d: Doctor) => d.id === event.rawData.order.doctorId,
        );
        if (doctor) {
          return doctor.name;
        }
      }

      // Try to get from rawData for admission events
      if (eventType === "admission_event" && event.rawData?.event?.doctorId) {
        const doctor = doctors.find(
          (d: Doctor) => d.id === event.rawData.event.doctorId,
        );
        if (doctor) {
          return doctor.name;
        }
      }

      // Try to get from rawData for admission fallback
      if (eventType === "admission" && event.rawData?.admission?.doctorId) {
        const doctor = doctors.find(
          (d: Doctor) => d.id === event.rawData.admission.doctorId,
        );
        if (doctor) {
          return doctor.name;
        }
      }

      // For OPD visits, use the doctor name from rawData if available
      if (eventType === "opd_visit" && event.rawData?.doctor?.name) {
        return event.rawData.doctor.name;
      }

      return "No Doctor Assigned";
    };

    // Base receipt data structure
    const baseReceiptData = {
      type: eventType as
        | "service"
        | "pathology"
        | "admission"
        | "payment"
        | "discount"
        | "opd_visit",
      id: event.id,
      title:
        event.title ||
        event.serviceName ||
        event.testName ||
        event.description ||
        "Service",
      date: event.sortTimestamp,
      amount: event.amount || event.price || event.totalPrice || 0,
      description:
        event.description || event.serviceName || event.testName || "",
      patientName: patient?.name || "Unknown Patient",
      patientId: patient?.patientId || "Unknown ID",
      details: {
        ...event,
        patientAge: patient?.age,
        patientGender: patient?.gender,
        doctorName: getDoctorName(),
        receiptNumber: getReceiptNumber(),
      },
    };

    return baseReceiptData;
  };

  // Fetch patient details
  const { data: patient } = useQuery<Patient>({
    queryKey: ["/api/patients", patientId],
    queryFn: async () => {
      const response = await fetch(`/api/patients/${patientId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("hospital_token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch patient");
      return response.json();
    },
  });

  // Fetch patient services history
  const { data: services } = useQuery<PatientService[]>({
    queryKey: ["/api/patient-services", patientId],
    queryFn: async () => {
      const response = await fetch(
        `/api/patient-services?patientId=${patientId}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("hospital_token")}`,
          },
        },
      );
      if (!response.ok) throw new Error("Failed to fetch patient services");
      return response.json();
    },
  });

  // Fetch OPD visits for this patient
  const { data: opdVisits = [] } = useQuery({
    queryKey: ["/api/opd-visits", patientId],
    queryFn: async () => {
      const response = await fetch(`/api/opd-visits?patientId=${patientId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("hospital_token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch OPD visits");
      return response.json();
    },
    refetchInterval: 5000, // Refetch every 5 seconds to get latest visits
  });

  // Fetch all services for service selection
  const { data: allServices } = useQuery<Service[]>({
    // Use Service interface
    queryKey: ["/api/services"],
    queryFn: async () => {
      const response = await fetch("/api/services", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("hospital_token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch services");
      return response.json();
    },
  });

  // Fetch patient admissions history
  const { data: admissions = [] } = useQuery({
    queryKey: ["/api/admissions", patientId],
    queryFn: async () => {
      const response = await fetch(`/api/admissions?patientId=${patientId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("hospital_token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch patient admissions");
      return response.json();
    },
  });

  // Fetch pathology orders for this patient
  const { data: pathologyOrders = [] } = useQuery({
    queryKey: ["/api/pathology/patient", patientId],
    queryFn: async () => {
      const response = await fetch(`/api/pathology/patient/${patientId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("hospital_token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch pathology orders");
      return response.json();
    },
    refetchInterval: 5000, // Refetch every 5 seconds to get latest orders
  });

  // Patient financial summary query
  const { data: financialSummary, isLoading: isFinancialLoading } = useQuery({
    queryKey: ["/api/patients", patientId, "financial-summary"],
    queryFn: async () => {
      const response = await fetch(
        `/api/patients/${patientId}/financial-summary`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("hospital_token")}`,
          },
        },
      );
      if (!response.ok) throw new Error("Failed to fetch financial summary");
      return response.json();
    },
    enabled: !!patientId,
    refetchInterval: 10000, // Refetch every 10 seconds for financial updates
  });

  // Fetch admission events for detailed history
  const { data: admissionEventsMap = {} } = useQuery({
    queryKey: ["/api/admission-events", patientId],
    queryFn: async () => {
      const eventsMap: Record<string, AdmissionEvent[]> = {};

      if (admissions && admissions.length > 0) {
        await Promise.all(
          admissions.map(async (admission: Admission) => {
            try {
              const response = await fetch(
                `/api/admissions/${admission.id}/events`,
                {
                  headers: {
                    Authorization: `Bearer ${localStorage.getItem("hospital_token")}`,
                  },
                },
              );
              if (response.ok) {
                const events = await response.json();
                eventsMap[admission.id] = events;
              }
            } catch (error) {
              console.error(
                `Failed to fetch events for admission ${admission.id}:`,
                error,
              );
            }
          }),
        );
      }

      return eventsMap;
    },
    enabled: !!admissions && admissions.length > 0,
  });

  // Fetch doctors for service assignment
  const { data: doctors = [] } = useQuery<Doctor[]>({
    queryKey: ["/api/doctors"],
  });

  // Fetch room types for admission form
  const { data: roomTypes = [] } = useQuery<any[]>({
    queryKey: ["/api/room-types"],
  });

  // Fetch rooms for admission form
  const { data: rooms = [] } = useQuery<any[]>({
    queryKey: ["/api/rooms"],
  });

  // Fetch all current admissions to check room occupancy in real-time
  const { data: allCurrentAdmissions = [] } = useQuery<any[]>({
    queryKey: ["/api/inpatients/currently-admitted"],
  });

  const serviceForm = useForm({
    resolver: zodResolver(
      insertPatientServiceSchema.extend({
        doctorId: z.string().optional(),
        price: z.coerce.number().min(0, "Price must be positive"),
        selectedServicesCount: z.number().default(0),
        serviceId: z.string().optional(), // Add serviceId to the form schema
        serviceType: z.string().optional(), // Make serviceType optional for catalog services
        serviceName: z.string().optional(), // Make serviceName optional for catalog services
        consultationFee: z.number().optional(), // Added for OPD consultation fee
      }),
    ),
    defaultValues: {
      patientId: patientId || "",
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
      serviceId: "", // Initialize serviceId to empty string
      selectedServicesCount: 0, // Add selectedServicesCount to default values
      consultationFee: 0, // Initialize consultationFee
    },
  });

  // OPD Visit Form (separate from services)
  const opdVisitForm = useForm({
    resolver: zodResolver(z.object({
      patientId: z.string().min(1),
      doctorId: z.string().min(1, "Doctor is required"),
      scheduledDate: z.string().min(1, "Date is required"),
      scheduledTime: z.string().min(1, "Time is required"),
      consultationFee: z.number().optional(), // Added for OPD consultation fee
      symptoms: z.string().optional(),
    })),
    defaultValues: {
      patientId: patientId || "",
      doctorId: "",
      scheduledDate: "",
      scheduledTime: "",
      consultationFee: 0, // Initialize consultationFee
      symptoms: "",
    },
  });

  const watchedServiceValues = serviceForm.watch();

  // Sync form fields with component state
  useEffect(() => {
    serviceForm.setValue("serviceType", selectedServiceType);
    serviceForm.setValue("selectedServicesCount", selectedServices.length);
  }, [selectedServiceType, selectedServices.length]);

  // Calculate billing preview when service or parameters change
  useEffect(() => {
    if (
      selectedCatalogService &&
      selectedCatalogService.billingType
    ) {
      calculateBillingPreview();
    } else if (selectedServiceType === "opd" || selectedServiceType === "") {
      // Reset billing preview if it's OPD or no service type selected
      setBillingPreview(null);
    }
  }, [
    selectedServiceType,
    watchedServiceValues.quantity,
    watchedServiceValues.hours,
    watchedServiceValues.distance,
    watchedServiceValues.price,
    selectedCatalogService,
  ]);

  const calculateBillingPreview = () => {
    if (!selectedCatalogService) return;

    let totalAmount = 0;
    let breakdown = "";
    let quantity = 1;

    switch (selectedCatalogService.billingType) {
      case "per_instance":
        quantity = watchedServiceValues.quantity || 1;
        totalAmount = selectedCatalogService.price * quantity;
        breakdown = `₹${selectedCatalogService.price} × ${quantity} instance${quantity > 1 ? "s" : ""} = ₹${totalAmount}`;
        break;

      case "per_24_hours":
        quantity = watchedServiceValues.quantity || 1;
        totalAmount = selectedCatalogService.price * quantity;
        breakdown = `₹${selectedCatalogService.price} × ${quantity} day${quantity > 1 ? "s" : ""} = ₹${totalAmount}`;
        break;

      case "per_hour":
        quantity = watchedServiceValues.hours || 1;
        totalAmount = selectedCatalogService.price * quantity;
        breakdown = `₹${selectedCatalogService.price} × ${quantity} hour${quantity > 1 ? "s" : ""} = ₹${totalAmount}`;
        break;

      case "composite":
        const params = selectedCatalogService.billingParameters
          ? JSON.parse(selectedCatalogService.billingParameters)
          : {};
        const fixedCharge = params.fixedCharge || selectedCatalogService.price;
        const perKmRate = params.perKmRate || 0;
        const distance = watchedServiceValues.distance || 0;

        const distanceCharge = perKmRate * distance;
        totalAmount = fixedCharge + distanceCharge;
        breakdown = `Fixed: ₹${fixedCharge}${distance > 0 ? ` + Distance: ₹${perKmRate} × ${distance}km = ₹${distanceCharge}` : ""} = ₹${totalAmount}`;
        quantity = 1;
        break;

      case "variable":
        quantity = 1;
        totalAmount = watchedServiceValues.price || 0; // Use the entered price from the form
        breakdown = `Variable price: ₹${totalAmount}`;
        break;

      case "per_date":
        quantity = watchedServiceValues.quantity || 1;
        totalAmount = selectedCatalogService.price * quantity;
        breakdown = `₹${selectedCatalogService.price} × ${quantity} date${quantity > 1 ? "s" : ""} = ₹${totalAmount}`;
        break;

      default:
        quantity = watchedServiceValues.quantity || 1;
        totalAmount = selectedCatalogService.price * quantity;
        breakdown = `₹${selectedCatalogService.price} × ${quantity} = ₹${totalAmount}`;
    }

    setBillingPreview({
      totalAmount,
      quantity,
      breakdown,
      billingType: selectedCatalogService.billingType,
    });

    // Update the form price field (but not for variable billing to avoid overwriting user input)
    if (selectedCatalogService.billingType !== "variable") {
      serviceForm.setValue("price", totalAmount);
    }
  };

  const admissionForm = useForm({
    // Remove zodResolver to handle validation manually since reason is now optional
    defaultValues: {
      patientId: patientId,
      doctorId: "",
      currentWardType: "",
      currentRoomNumber: "",
      admissionDate: "", // Will be set dynamically when dialog opens
      reason: "",
      diagnosis: "",
      notes: "",
      dailyCost: 0,
      initialDeposit: 0,
    },
  });

  const roomUpdateForm = useForm({
    defaultValues: {
      roomNumber: "",
      wardType: "",
    },
  });

  const createServiceMutation = useMutation({
    mutationFn: async (data: any) => {
      // Generate receipt number before sending to API with correct format
      const serviceType = getServiceType("service", data[0]); // Assuming data is an array of services
      const eventDate = new Date(data[0].scheduledDate)
        .toISOString()
        .split("T")[0];
      const count = await getDailyCountFromAPI("service", eventDate, data[0]);

      // Format: YYMMDD-TYPE-NNNN (correct format)
      const dateObj = new Date(eventDate);
      const yymmdd = dateObj
        .toISOString()
        .slice(2, 10)
        .replace(/-/g, "")
        .slice(0, 6);

      let typeCode = "";
      if (serviceType === "opd") {
        typeCode = "OPD";
      } else {
        typeCode = "SER";
      }

      const receiptNumber = `${yymmdd}-${typeCode}-${String(count).padStart(4, "0")}`;

      // Map services to include the generated receipt number and other details
      const servicesWithReceipt = data.map((service: any) => ({
        ...service,
        receiptNumber: receiptNumber,
        // Include doctorId for OPD services, otherwise null
        doctorId: service.serviceType === "opd" ? service.doctorId : null,
      }));

      const response = await fetch("/api/patient-services/batch", {
        // Use batch endpoint
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("hospital_token")}`,
        },
        body: JSON.stringify(servicesWithReceipt),
      });
      if (!response.ok) throw new Error("Failed to create service");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/patient-services", patientId],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId] });
      setIsServiceDialogOpen(false);
      setSelectedServiceType("");
      setSelectedServiceCategory("");
      setSelectedCatalogService(null);
      setBillingPreview(null);
      serviceForm.reset({
        patientId: patientId || "",
        serviceType: "",
        serviceName: "",
        scheduledDate: "",
        scheduledTime: "",
        doctorId: "",
        serviceId: "", // Reset serviceId
        notes: "",
        price: 0,
        quantity: 1,
        hours: 1,
        distance: 0,
      });
      toast({
        title: "Service scheduled successfully",
        description: "The service has been added to the patient's schedule.",
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

  // OPD Visit Creation Mutation
  const createOpdVisitMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log("Creating OPD visit with data:", data);
      return apiRequest("/api/opd-visits", {
        method: "POST",
        body: data,
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "OPD appointment scheduled successfully!",
        className: "bg-green-50 border-green-200 text-green-800",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/opd-visits"] });
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId] });
      setIsOpdVisitDialogOpen(false);
      opdVisitForm.reset();
    },
    onError: (error: any) => {
      console.error("Error creating OPD visit:", error);
      toast({
        title: "Error",
        description: "Failed to schedule OPD appointment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const createAdmissionMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/admissions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("hospital_token")}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create admission");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admissions", patientId],
      });
      setIsAdmissionDialogOpen(false);
      admissionForm.reset();
      toast({
        title: "Admission created successfully",
        description: "The patient has been admitted.",
      });
    },
    onError: (error: any) => {
      console.error("Admission creation error:", error);

      // Handle room occupancy error specifically
      let errorMessage = "Please try again.";
      if (error.message && error.message.includes("already occupied")) {
        errorMessage = error.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast({
        title: "Error creating admission",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const onServiceSubmit = async (data: any) => {
    try {
      console.log("Submit button clicked");
      console.log("Form data:", data);

      // Manual validation for required fields
      if (!data.patientId) {
        toast({
          title: "Error",
          description: "Patient ID is required",
          variant: "destructive",
        });
        return;
      }

      if (!data.scheduledDate) {
        toast({
          title: "Error",
          description: "Scheduled date is required",
          variant: "destructive",
        });
        return;
      }

      if (!data.scheduledTime) {
        toast({
          title: "Error",
          description: "Scheduled time is required",
          variant: "destructive",
        });
        return;
      }

      const servicesToCreate = [];
      const selectedDoctorId = serviceForm.watch("doctorId");
      const selectedDoctor = doctors.find(
        (d: Doctor) => d.id === selectedDoctorId,
      );
      const consultationFee = selectedDoctor
        ? selectedDoctor.consultationFee
        : 0;

      if (selectedServiceType === "opd") {
        // Get selected doctor and consultation fee
        console.log('Selected Doctor ID from form:', selectedDoctorId);

        if (!selectedDoctorId || selectedDoctorId === "none" || selectedDoctorId === "" || selectedDoctorId === "external") {
          console.log('No doctor selected for OPD consultation');
          toast({
            title: "Doctor Required",
            description: "Please select a doctor for OPD consultation",
            variant: "destructive",
          });
          return; // Stop execution if no doctor selected for OPD
        }

        // Validate consultation fee is positive
        if (!consultationFee || consultationFee <= 0) {
          console.log('Invalid consultation fee:', consultationFee);
          toast({
            title: "Invalid Fee",
            description: "Consultation fee must be greater than 0. Please select a valid doctor.",
            variant: "destructive",
          });
          return;
        }

        console.log('=== OPD SERVICE CREATION ===');
        console.log('Selected Doctor ID:', selectedDoctorId);
        console.log('Consultation Fee:', consultationFee);

        servicesToCreate.push({
          patientId: patientId,
          serviceType: "opd",
          serviceName: "OPD Consultation",
          serviceId: "opd_consultation_service", // Add a consistent service ID
          price: consultationFee,
          quantity: 1,
          notes: data.notes || "",
          scheduledDate: data.scheduledDate,
          scheduledTime: data.scheduledTime,
          status: "scheduled",
          doctorId: selectedDoctorId,
          billingType: "per_instance",
          calculatedAmount: Number(data.price),
          billingQuantity: 1,
        });
      } else {
        // Handle selected catalog services
        if (selectedServices.length > 0) {
          selectedServices.forEach((service) => {
            console.log('=== CATALOG SERVICE CREATION ===');
            console.log('Service:', service.name);
            console.log('Doctor ID from form:', data.doctorId);

            // Get the actual doctor ID from the form - use same method as OPD
            const actualDoctorId = serviceForm.watch("doctorId");
            console.log('Actual doctor ID to use:', actualDoctorId);

            let serviceData: any = {
              patientId: patientId,
              serviceType: mapCategoryToServiceType(service.category),
              serviceName: service.name,
              serviceId: service.id,
              price: service.price * (service.quantity || 1),
              quantity: service.quantity || 1,
              notes: data.notes,
              scheduledDate: data.scheduledDate,
              scheduledTime: data.scheduledTime,
              status: "scheduled",
              doctorId:
                actualDoctorId && actualDoctorId !== "none" && actualDoctorId !== ""
                  ? actualDoctorId
                  : null,
              billingType: "per_instance",
              calculatedAmount: Number(data.price),
            };

            console.log('Final service data doctor ID:', serviceData.doctorId);

            // Add smart billing parameters if service has special billing type
            if (service.billingType) {
              serviceData.billingType = service.billingType;
              serviceData.billingQuantity = service.quantity || 1;

              if (service.billingType === "composite") {
                // For composite billing (ambulance), use quantity as distance
                serviceData.billingParameters = JSON.stringify({
                  distance: service.quantity || 0,
                });
              } else if (service.billingType === "per_hour") {
                serviceData.billingParameters = JSON.stringify({
                  hours: service.quantity || 1,
                });
              } else if (service.billingType === "variable") {
                // For variable billing, use the entered price from form data
                const variablePrice = data.price || service.price || 0;
                serviceData.billingParameters = JSON.stringify({
                  price: variablePrice,
                });
              }

              // Calculate billing amount based on service type and quantity
              if (service.billingType === "composite") {
                const params = service.billingParameters
                  ? JSON.parse(service.billingParameters)
                  : {};
                const fixedCharge = params.fixedCharge || service.price;
                const perKmRate = params.perKmRate || 0;
                const distance = service.quantity || 0;
                const calculatedAmount = fixedCharge + perKmRate * distance;

                serviceData.calculatedAmount = calculatedAmount;
                serviceData.price = calculatedAmount;
              } else if (service.billingType === "per_hour") {
                const calculatedAmount = service.price * (service.quantity || 1);
                serviceData.calculatedAmount = calculatedAmount;
                serviceData.price = calculatedAmount;
              } else if (service.billingType === "variable") {
                // For variable billing, use the exact price entered from form (quantity is always 1)
                const variablePrice = data.price || service.price || 0;
                serviceData.calculatedAmount = variablePrice;
                serviceData.price = variablePrice;
                serviceData.billingQuantity = 1;
              } else if (service.billingType === "per_date") {
                const calculatedAmount = service.price * (service.quantity || 1);
                serviceData.calculatedAmount = calculatedAmount;
                serviceData.price = calculatedAmount;
              }
            }

            servicesToCreate.push(serviceData);
          });
        } else if (data.serviceName && data.price > 0) {
          // Custom service
          console.log('=== CUSTOM SERVICE CREATION ===');
          console.log('Doctor ID from form:', data.doctorId);

          // Get the actual doctor ID from the form - use same method as OPD
          const actualDoctorId = serviceForm.watch("doctorId");
          console.log('Actual doctor ID to use for custom service:', actualDoctorId);

          servicesToCreate.push({
            patientId: patientId,
            serviceType: "service",
            serviceName: data.serviceName,
            price: data.price,
            quantity: 1,
            notes: data.notes,
            scheduledDate: data.scheduledDate,
            scheduledTime: data.scheduledTime,
            status: "scheduled",
            doctorId:
              actualDoctorId && actualDoctorId !== "none" && actualDoctorId !== ""
                ? actualDoctorId
                : null,
          });

          console.log('Custom service doctor ID:', servicesToCreate[servicesToCreate.length - 1].doctorId);
        }
      }

      // Call the mutation function with the services to create
      // The createServiceMutation handles the batch or single API call logic internally
      if (servicesToCreate.length === 0) {
        toast({
          title: "Error",
          description: "No services to create",
          variant: "destructive",
        });
        return;
      }

      try {
        console.log("Creating services:", servicesToCreate);

        if (servicesToCreate.length === 1) {
          // Single service - use the regular API
          console.log("Creating single service:", servicesToCreate[0]);
          const response = await fetch("/api/patient-services", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
            },
            body: JSON.stringify(servicesToCreate[0]),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error("Single service creation failed:", errorText);
            throw new Error(`Server error: ${response.status} ${errorText}`);
          }

          const result = await response.json();
          console.log("Service created:", result);
        } else if (servicesToCreate.length > 1) {
          // Multiple services - use the batch API
          console.log("Creating batch services:", servicesToCreate);
          const response = await fetch("/api/patient-services/batch", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
            },
            body: JSON.stringify(servicesToCreate),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error("Batch service creation failed:", errorText);
            throw new Error(`Batch service creation failed: ${response.status} ${errorText}`);
          }

          const result = await response.json();
          console.log("Batch services created:", result);
        }

        // Success
        queryClient.invalidateQueries({ queryKey: ["/api/patient-services"] });
        queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });

        toast({
          title: "Success",
          description: `${selectedServiceType === "opd" ? "OPD appointment" : "Service"} scheduled successfully`,
        });

        setIsServiceDialogOpen(false);
        serviceForm.reset();
        setSelectedServices([]);
        setSelectedServiceType("");
        setBillingPreview(null);
        setSelectedServiceCategory("");
        setSelectedCatalogService(null);
      } catch (error) {
        console.error("Error creating service:", error);
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to schedule service",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error in onServiceSubmit:", error);
      toast({
        title: "Form Submission Error",
        description: "An unexpected error occurred during form submission. Please check your inputs.",
        variant: "destructive",
      });
    }
  };

  const onAdmissionSubmit = (data: any) => {
    // Validate required fields (reason is now optional)
    const requiredFields = [
      "doctorId",
      "currentWardType",
      "currentRoomNumber", // Added room number validation
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

    const admissionData = {
      ...data,
      admissionId: `ADM-${Date.now()}`,
    };
    createAdmissionMutation.mutate(admissionData);
  };

  const dischargePatientMutation = useMutation({
    mutationFn: async (data: {
      currentAdmissionId: string;
      dischargeDateTime: string;
    }) => {
      const response = await fetch(
        `/api/admissions/${data.currentAdmissionId}/discharge`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("hospital_token")}`,
          },
          body: JSON.stringify({ dischargeDateTime: data.dischargeDateTime }),
        },
      );

      if (!response.ok) throw new Error("Failed to discharge patient");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admission-events"] });
      setIsDischargeDialogOpen(false);
      setDischargeDateTime(""); // Reset the date/time state
      toast({
        title: "Patient discharged successfully",
        description:
          "The patient has been discharged and the event has been recorded.",
      });
    },
    onError: () => {
      toast({
        title: "Error discharging patient",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateRoomMutation = useMutation({
    mutationFn: async (data: any) => {
      const currentAdmission = admissions?.find(
        (adm: any) => adm.status === "admitted",
      );
      if (!currentAdmission) throw new Error("No active admission found");

      const response = await fetch(
        `/api/admissions/${currentAdmission.id}/transfer`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("hospital_token")}`,
          },
          body: JSON.stringify({
            roomNumber: data.roomNumber,
            wardType: data.wardType,
          }),
        },
      );

      if (!response.ok) throw new Error("Failed to transfer room");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admission-events"] });
      setIsRoomUpdateDialogOpen(false);
      roomUpdateForm.reset();
      toast({
        title: "Room transfer completed",
        description: "Patient has been transferred to the new room.",
      });
    },
  });

  const addPaymentMutation = useMutation({
    mutationFn: async (data: {
      amount: number;
      paymentMethod: string;
      reason?: string;
    }) => {
      const response = await fetch(`/api/patients/${patientId}/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("hospital_token")}`,
        },
        body: JSON.stringify({
          amount: data.amount,
          paymentMethod: data.paymentMethod,
          reason: data.reason || "Payment",
          paymentDate: new Date().toISOString(),
        }),
      });

      if (!response.ok) throw new Error("Failed to add payment");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/patients", patientId, "financial-summary"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/patients", patientId, "payments"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId] });
      setIsPaymentDialogOpen(false);
      setPaymentAmount("");
      setSelectedAdmissionForPayment("");
      toast({
        title: "Payment added successfully",
        description: "The payment has been recorded.",
      });
    },
    onError: () => {
      toast({
        title: "Error adding payment",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const addDiscountMutation = useMutation({
    mutationFn: async (data: {
      amount: number;
      reason: string;
      discountType?: string;
    }) => {
      const response = await fetch(`/api/patients/${patientId}/discounts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("hospital_token")}`,
        },
        body: JSON.stringify({
          amount: data.amount,
          reason: data.reason,
          discountType: data.discountType || "manual",
          discountDate: new Date().toISOString(),
        }),
      });

      if (!response.ok) throw new Error("Failed to add discount");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/patients", patientId, "financial-summary"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/patients", patientId, "discounts"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId] });
      setIsDiscountDialogOpen(false);
      setDiscountAmount("");
      setDiscountReason("");
      toast({
        title: "Discount added successfully",
        description: "The discount has been applied.",
      });
    },
    onError: () => {
      toast({
        title: "Error adding discount",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const onDischargePatient = (dischargeDateTime: string) => {
    const currentAdmission = admissions?.find(
      (adm: any) => adm.status === "admitted",
    );
    if (!currentAdmission) {
      toast({
        title: "Error",
        description: "No active admission found to discharge.",
        variant: "destructive",
      });
      return;
    }

    if (!dischargeDateTime) {
      toast({
        title: "Error",
        description: "Please select a discharge date and time.",
        variant: "destructive",
      });
      return;
    }

    dischargePatientMutation.mutate({
      currentAdmissionId: currentAdmission.id,
      dischargeDateTime,
    });
  };

  const onRoomUpdate = (data: any) => {
    // Validate required fields
    const requiredFields = ["wardType", "roomNumber"];
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

    updateRoomMutation.mutate(data);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "in-progress":
        return "bg-blue-100 text-blue-800";
      case "scheduled":
        return "bg-yellow-100 text-yellow-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";

    // Handle datetime-local format: "YYYY-MM-DDTHH:MM"
    if (dateString.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)) {
      const parts = dateString.split("T");
      const dateParts = parts[0].split("-");
      const timeParts = parts[1].split(":");

      // Create date object in local timezone
      const localDate = new Date(
        parseInt(dateParts[0]), // year
        parseInt(dateParts[1]) - 1, // month (0-indexed)
        parseInt(dateParts[2]), // day
        parseInt(timeParts[0]), // hour
        parseInt(timeParts[1]), // minute
      );

      // Check if date is valid
      if (isNaN(localDate.getTime())) return "N/A";

      return localDate.toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
    }

    // Handle different date formats and ensure local timezone
    const date = new Date(dateString);

    // Check if date is valid
    if (isNaN(date.getTime())) return "N/A";

    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  };

  // Service categories mapping (matching service management)
  const serviceCategories = [
    { key: "diagnostics", label: "Diagnostic Services", icon: Heart },
    { key: "procedures", label: "Medical Procedures", icon: Stethoscope },
    { key: "operations", label: "Surgical Operations", icon: X },
    { key: "consultation", label: "Consultation", icon: Calendar }, // Added Consultation category
    { key: "misc", label: "Miscellaneous Services", icon: Settings },
  ];

  // Filter services by category and search query
  const getFilteredServices = (category: string) => {
    if (!allServices) return [];

    let filtered = allServices.filter((s) => s.isActive);

    // Filter by category
    if (category && category !== "all") {
      filtered = filtered.filter((s) => s.category === category);
    }

    // Filter by search query
    if (selectedServiceSearchQuery.trim()) {
      filtered = filtered.filter(
        (s) =>
          s.name.toLowerCase().includes(selectedServiceSearchQuery.toLowerCase()) ||
          (s.description &&
            s.description
              .toLowerCase()
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

  const openServiceDialog = (serviceType: string) => {
    setSelectedServiceType(serviceType);
    setSelectedServices([]);
    setSelectedServiceCategory("");
    setSelectedCatalogService(null);
    setBillingPreview(null);
    setIsServiceDialogOpen(true);

    // Set the current time as default
    const now = new Date();
    const timeString = now.toTimeString().slice(0, 5); // HH:MM format
    const currentDate = now.toISOString().split('T')[0];

    // Reset form but preserve doctor selection if it exists
    const currentDoctorId = serviceForm.getValues("doctorId");

    serviceForm.reset({
      patientId: patientId || "",
      serviceType: serviceType,
      serviceName: serviceType === "opd" ? "OPD Consultation" : "", // Default to OPD Consultation for OPD
      scheduledDate: currentDate,
      scheduledTime: timeString,
      doctorId: currentDoctorId || "", // Preserve existing doctor selection
      serviceId: "",
      notes: "",
      price: 0,
      quantity: 1,
      hours: 1,
      distance: 0,
    });
  };

  // Function to open the comprehensive bill dialog
  const handleOpenComprehensiveBill = async () => {
    if (!patient) {
      toast({
        title: "Error",
        description:
          "Patient data not loaded yet. Please wait a moment and try again.",
        variant: "destructive",
      });
      return;
    }

    // Wait for hospital settings to load before generating bill
    if (isHospitalSettingsLoading) {
      toast({
        title: "Loading...",
        description: "Please wait for hospital settings to load.",
      });
      return;
    }

    if (hospitalSettingsError) {
      console.warn(
        "Hospital settings error, proceeding with defaults:",
        hospitalSettingsError,
      );
      toast({
        title: "Warning",
        description:
          "Hospital settings could not be loaded. Using default values.",
        variant: "destructive",
      });
    }

    try {
      setIsLoadingBill(true);

      console.log("=== Comprehensive Bill Generation ===");
      console.log("Patient ID:", patient.id);
      console.log("Hospital info being passed:", hospitalInfo);

      const response = await fetch(
        `/api/patients/${patient.id}/comprehensive-bill`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("hospital_token")}`,
          },
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          "Comprehensive bill API error:",
          response.status,
          errorText,
        );
        throw new Error(
          `Failed to fetch comprehensive bill: ${response.status}`,
        );
      }

      const billData = await response.json();
      console.log("Comprehensive bill data received:", billData);
      console.log("=== End Comprehensive Bill Generation ===");

      setComprehensiveBillData(billData);
      setIsComprehensiveBillOpen(true);
    } catch (error) {
      console.error("Error fetching comprehensive bill:", error);
      toast({
        title: "Error",
        description: "Failed to generate comprehensive bill",
        variant: "destructive",
      });
    } finally {
      setIsLoadingBill(false);
    }
  };

  if (!patient) {
    return (
      <div className="flex items-center justify-center h-64">
        Loading patient details...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <TopBar
        title={`Patient: ${patient.name}`}
        actions={
          <Button
            onClick={handleOpenComprehensiveBill}
            disabled={isLoadingBill || isHospitalSettingsLoading}
            className="flex items-center gap-2"
            data-testid="button-comprehensive-bill"
          >
            {isLoadingBill || isHospitalSettingsLoading ? (
              isHospitalSettingsLoading ? (
                "Loading Settings..."
              ) : (
                "Generating..."
              )
            ) : (
              <>
                <FileText className="h-4 w-4" />
                Comprehensive Bill
              </>
            )}
          </Button>
        }
      />

      <div className="p-6">
        {/* Patient Info Header */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Patient Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="font-medium">{patient.name}</p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Age</p>
                <p className="font-medium">{patient.age} years</p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Gender</p>
                <p className="font-medium capitalize">{patient.gender}</p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Phone</p>
                <p className="font-medium">{patient.phone}</p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Patient ID</p>
                <p className="font-medium">{patient.patientId}</p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">
                  Emergency Contact
                </p>
                <p className="font-medium">
                  {patient.emergencyContact || "N/A"}
                </p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{patient.email || "N/A"}</p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Address</p>
                <p className="font-medium">{patient.address || "N/A"}</p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Room No</p>
                <p className="font-medium">
                  {(() => {
                    const currentAdmission = admissions?.find(
                      (adm: any) => adm.status === "admitted",
                    );
                    return currentAdmission?.currentRoomNumber || "N/A";
                  })()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => {
                  console.log("OPD button clicked");
                  const now = new Date();
                  // Use current local time for OPD appointment scheduling
                  const currentDate = now.toISOString().split("T")[0];
                  const currentTime = now.toTimeString().split(" ")[0].slice(0, 5);

                  setIsOpdVisitDialogOpen(true);
                  opdVisitForm.reset({
                    patientId: patientId || "",
                    doctorId: "",
                    scheduledDate: currentDate,
                    scheduledTime: currentTime,
                    consultationFee: 0, // Added for OPD consultation fee
                    symptoms: "",
                  });

                  console.log(
                    `Set current date/time: ${currentDate} ${currentTime}`,
                  );
                }}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                data-testid="button-schedule-opd"
              >
                <Stethoscope className="h-4 w-4" />
                Schedule OPD
              </Button>

              <Button
                onClick={() =>
                  navigate(
                    `/pathology?patientId=${patientId}&patientName=${encodeURIComponent(patient?.name || "")}`,
                  )
                }
                className="flex items-center gap-2 bg-pink-600 hover:bg-pink-700 text-white"
                data-testid="button-pathology-tests"
              >
                <TestTube className="h-4 w-4" />
                Order Pathology Tests
              </Button>

              <Button
                onClick={() => {
                  // Set current LOCAL date and time when opening service dialog
                  const now = new Date();
                  const currentDate =
                    now.getFullYear() +
                    "-" +
                    String(now.getMonth() + 1).padStart(2, "0") +
                    "-" +
                    String(now.getDate()).padStart(2, "0");
                  const currentTime =
                    String(now.getHours()).padStart(2, "0") +
                    ":" +
                    String(now.getMinutes()).padStart(2, "0");

                  // Reset service type and category for general service
                  setSelectedServiceType("");
                  setSelectedServiceCategory("");
                  setSelectedCatalogService(null); // Reset selected service
                  setBillingPreview(null); // Reset billing preview
                  // Reset form completely first
                  serviceForm.reset({
                    patientId: patientId || "",
                    serviceType: "",
                    serviceName: "",
                    scheduledDate: currentDate,
                    scheduledTime: currentTime,
                    doctorId: "",
                    notes: "",
                    price: 0,
                    quantity: 1,
                    hours: 1,
                    distance: 0,
                  });

                  setIsServiceDialogOpen(true);
                }}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white"
                data-testid="button-add-medical-service"
              >
                <Plus className="h-4 w-4" />
                Add Service
              </Button>

              {/* Admission/Discharge Button */}
              {(() => {
                const currentAdmission = admissions?.find(
                  (adm: any) => adm.status === "admitted",
                );

                if (currentAdmission) {
                  // Patient is admitted - show discharge button
                  return (
                    <Button
                      onClick={() => {
                        // Set current LOCAL date and time when opening discharge dialog
                        const now = new Date();
                        const currentDateTime =
                          now.getFullYear() +
                          "-" +
                          String(now.getMonth() + 1).padStart(2, "0") +
                          "-" +
                          String(now.getDate()).padStart(2, "0") +
                          "T" +
                          String(now.getHours()).padStart(2, "0") +
                          ":" +
                          String(now.getMinutes()).padStart(2, "0");

                        setDischargeDateTime(currentDateTime);
                        setIsDischargeDialogOpen(true);
                      }}
                      className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white"
                      data-testid="button-discharge-patient"
                    >
                      <Bed className="h-4 w-4" />
                      Discharge Patient
                    </Button>
                  );
                } else {
                  // Patient is not admitted - show admit button
                  return (
                    <Button
                      onClick={() => {
                        // Set current LOCAL date and time when opening admission dialog
                        const now = new Date();
                        const currentDateTime =
                          now.getFullYear() +
                          "-" +
                          String(now.getMonth() + 1).padStart(2, "0") +
                          "-" +
                          String(now.getDate()).padStart(2, "0") +
                          "T" +
                          String(now.getHours()).padStart(2, "0") +
                          ":" +
                          String(now.getMinutes()).padStart(2, "0");

                        admissionForm.setValue(
                          "admissionDate",
                          currentDateTime,
                        );
                        setIsAdmissionDialogOpen(true);
                      }}
                      className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
                      data-testid="button-admit-patient"
                    >
                      <Bed className="h-4 w-4" />
                      Admit Patient
                    </Button>
                  );
                }
              })()}

              {/* Smart Billing Button is removed as its functionality is integrated into "Add Service" */}
            </div>
          </CardContent>
        </Card>

        {/* Financial Monitoring */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                Financial Summary
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    setDiscountAmount("");
                    setDiscountReason("");
                    setIsDiscountDialogOpen(true);
                  }}
                  className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white"
                >
                  <Minus className="h-4 w-4" />
                  Add Discount
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setPaymentAmount("");
                    setSelectedAdmissionForPayment("");
                    setIsPaymentDialogOpen(true);
                  }}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
                >
                  <Plus className="h-4 w-4" />
                  Add Payment
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">
                  Total Charges
                </p>
                <p className="text-2xl font-bold text-blue-700">
                  {isFinancialLoading ? (
                    <span className="text-sm">Loading...</span>
                  ) : (
                    `₹${(financialSummary?.totalCharges || 0).toLocaleString()}`
                  )}
                </p>
              </div>

              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Paid</p>
                <p className="text-2xl font-bold text-green-700">
                  {isFinancialLoading ? (
                    <span className="text-sm">Loading...</span>
                  ) : (
                    `₹${(financialSummary?.totalPaid || 0).toLocaleString()}`
                  )}
                </p>
              </div>

              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Discounts</p>
                <p className="text-2xl font-bold text-purple-700">
                  {isFinancialLoading ? (
                    <span className="text-sm">Loading...</span>
                  ) : (
                    `₹${(financialSummary?.totalDiscounts || 0).toLocaleString()}`
                  )}
                </p>
              </div>

              <div
                className={`text-center p-4 rounded-lg ${(financialSummary?.balance || 0) < 0 ? "bg-red-50" : "bg-orange-50"}`}
              >
                <p className="text-sm text-muted-foreground mb-1">Balance</p>
                <p
                  className={`text-2xl font-bold ${(financialSummary?.balance || 0) < 0 ? "text-red-700" : "text-orange-700"}`}
                >
                  {isFinancialLoading ? (
                    <span className="text-sm">Loading...</span>
                  ) : (
                    `₹${(financialSummary?.balance || 0).toLocaleString()}`
                  )}
                </p>
                {(financialSummary?.balance || 0) < 0 && (
                  <p className="text-xs text-red-600 mt-1">
                    Hospital owes patient
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Patient History Tabs */}
        <Tabs
          defaultValue={
            window.location.hash === "#pathology" ? "pathology" : "opd"
          }
          className="space-y-4"
        >
          <TabsList>
            <TabsTrigger value="opd">OPD</TabsTrigger>
            <TabsTrigger value="pathology">Pathology</TabsTrigger>
            <TabsTrigger value="admissions">Admissions</TabsTrigger>
            <TabsTrigger value="services">Services</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>

          <TabsContent value="opd">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>OPD Consultation History</CardTitle>
                <Button
                  onClick={() => {
                    const now = new Date();
                    // Use current local time for OPD appointment scheduling
                    const currentDate = now.toISOString().split("T")[0];
                    const currentTime = now.toTimeString().split(" ")[0].slice(0, 5);

                    setIsOpdVisitDialogOpen(true);
                    opdVisitForm.reset({
                      patientId: patientId || "",
                      doctorId: "",
                      scheduledDate: currentDate,
                      scheduledTime: currentTime,
                      consultationFee: 0, // Added for OPD consultation fee
                      symptoms: "",
                    });
                  }}
                  size="sm"
                  className="flex items-center gap-2"
                  data-testid="button-schedule-opd"
                >
                  <Plus className="h-4 w-4" />
                  Schedule OPD
                </Button>
              </CardHeader>
              <CardContent>
                {opdVisits && opdVisits.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Doctor</TableHead>
                        <TableHead>Scheduled Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Symptoms</TableHead>
                        <TableHead>Fee</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {opdVisits
                        .sort((a: any, b: any) => {
                          // Sort by scheduled date descending (latest first)
                          const dateA = new Date(a.scheduledDate || a.createdAt);
                          const dateB = new Date(b.scheduledDate || b.createdAt);
                          return dateB.getTime() - dateA.getTime();
                        })
                        .map((visit: any) => {
                        // Find doctor details
                        const doctor = doctors?.find(
                          (d: Doctor) => d.id === visit.doctorId,
                        );
                        const doctorName = doctor ? doctor.name : "Unknown Doctor";
                        const consultationFee = doctor ? doctor.consultationFee : 0;

                        return (
                          <TableRow key={visit.id}>
                            <TableCell className="font-medium">
                              {doctorName}
                              {doctor && (
                                <div className="text-sm text-muted-foreground">
                                  {doctor.specialization}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              {(() => {
                                // Format date and time to match the dialog display (local time)
                                if (!visit.scheduledDate) return "N/A";

                                // Create a proper date object for the scheduled date and time
                                let displayDateTime;
                                if (visit.scheduledTime) {
                                  // Combine date and time to create a complete datetime
                                  const datetimeString = `${visit.scheduledDate}T${visit.scheduledTime}:00`;
                                  displayDateTime = new Date(datetimeString);

                                  // Use local time without adjustment to match the dialog
                                } else {
                                  displayDateTime = new Date(visit.scheduledDate);
                                }

                                // Format the date part
                                const dateDisplay = displayDateTime.toLocaleDateString("en-US", {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric"
                                });

                                if (!visit.scheduledTime) {
                                  return dateDisplay;
                                }

                                // Format the time part
                                const timeDisplay = displayDateTime.toLocaleTimeString("en-US", {
                                  hour: "numeric",
                                  minute: "2-digit",
                                  hour12: true
                                });

                                return (
                                  <>
                                    {dateDisplay}
                                    <span className="text-muted-foreground ml-2">
                                      at {timeDisplay}
                                    </span>
                                  </>
                                );
                              })()}
                            </TableCell>
                            <TableCell>
                              <Badge className={getStatusColor(visit.status)}>
                                {visit.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {visit.symptoms || "No symptoms noted"}
                            </TableCell>
                            <TableCell>₹{visit.consultationFee || consultationFee}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8">
                    <Stethoscope className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      No OPD consultations scheduled
                    </p>
                    <Button
                      onClick={() => {
                        const now = new Date();
                        // Use current local time for OPD appointment scheduling
                        const currentDate = now.toISOString().split("T")[0];
                        const currentTime = now.toTimeString().split(" ")[0].slice(0, 5);

                        setIsOpdVisitDialogOpen(true);
                        opdVisitForm.reset({
                          patientId: patientId || "",
                          doctorId: "",
                          scheduledDate: currentDate,
                          scheduledTime: currentTime,
                          consultationFee: 0, // Added for OPD consultation fee
                          symptoms: "",
                        });
                      }}
                      className="mt-4"
                    >
                      Schedule First OPD Consultation
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>



          <TabsContent value="services">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Service History</CardTitle>
                <Button
                  onClick={() => {
                    // Set current LOCAL date and time when opening any service dialog
                    const now = new Date();
                    const currentDate =
                      now.getFullYear() +
                      "-" +
                      String(now.getMonth() + 1).padStart(2, "0") +
                      "-" +
                      String(now.getDate()).padStart(2, "0");
                    const currentTime =
                      String(now.getHours()).padStart(2, "0") +
                      ":" +
                      String(now.getMinutes()).padStart(2, "0");

                    // Reset service type and category
                    setSelectedServiceType("");
                    setSelectedServiceCategory("");
                    setSelectedCatalogService(null); // Reset selected service
                    setBillingPreview(null); // Reset billing preview
                    // Reset form completely first
                    serviceForm.reset({
                      patientId: patientId || "",
                      serviceType: "",
                      serviceName: "",
                      scheduledDate: currentDate,
                      scheduledTime: currentTime,
                      doctorId: "",
                      notes: "",
                      price: 0,
                      quantity: 1,
                      hours: 1,
                      distance: 0,
                    });

                    setIsServiceDialogOpen(true);
                  }}
                  size="sm"
                  className="flex items-center gap-2"
                  data-testid="button-add-service"
                >
                  <Plus className="h-4 w-4" />
                  Add Service
                </Button>
              </CardHeader>
              <CardContent>
                {services && services.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Service</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Doctor</TableHead>
                        <TableHead>Scheduled Date</TableHead>
                        <TableHead>Cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {services.map((service: any) => {
                        // Determine doctor name with robust logic
                        let doctorName = "No Doctor Assigned";

                        // Check if service has a valid doctor ID (not null, undefined, or empty)
                        if (service.doctorId && service.doctorId !== "" && service.doctorId !== "none") {
                          // First try doctorName from the joined query (fastest)
                          if (service.doctorName && service.doctorName.trim() !== "") {
                            doctorName = service.doctorName;
                          } else {
                            // Fall back to lookup from doctors array
                            const doctor = doctors?.find(
                              (d: Doctor) => d.id === service.doctorId,
                            );
                            doctorName = doctor ? doctor.name : "Unknown Doctor";
                          }
                        }

                        // Calculate total cost: use calculatedAmount if available, otherwise price * billingQuantity
                        const totalCost =
                          service.calculatedAmount ||
                          service.price * (service.quantity || 1);

                        return (
                          <TableRow key={service.id}>
                            <TableCell className="font-medium">
                              {service.serviceName}
                            </TableCell>
                            <TableCell>
                              {service.billingQuantity || 1}
                            </TableCell>
                            <TableCell>{doctorName}</TableCell>
                            <TableCell>
                              {formatDate(service.scheduledDate)}
                              {service.scheduledTime && (
                                <span className="text-muted-foreground ml-2">
                                  at{" "}
                                  {(() => {
                                    // Convert 24-hour format to 12-hour format
                                    const [hours, minutes] =
                                      service.scheduledTime.split(":");
                                    const hour = parseInt(hours, 10);
                                    const ampm = hour >= 12 ? "PM" : "AM";
                                    const displayHour =
                                      hour === 0
                                        ? 12
                                        : hour > 12
                                          ? hour - 12
                                          : hour;
                                    return `${displayHour}:${minutes} ${ampm}`;
                                  })()}
                                </span>
                              )}
                            </TableCell>
                            <TableCell>₹{totalCost}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground">
                      No services scheduled
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="admissions">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Admission History</CardTitle>
                <div className="flex items-center gap-2">
                  {(() => {
                    // Check if patient is currently admitted
                    const currentAdmission = admissions?.find(
                      (adm: any) => adm.status === "admitted",
                    );

                    if (currentAdmission) {
                      return (
                        <>
                          <div className="flex items-center gap-2 px-3 py-2 bg-green-100 text-green-800 rounded-lg text-sm">
                            <div className="w-2 h-2 bg-green-500 rounded-full" />
                            Admitted - Room {currentAdmission.currentRoomNumber}
                          </div>
                          <Button
                            onClick={() => setIsDischargeDialogOpen(true)}
                            size="sm"
                            variant="outline"
                            className="flex items-center gap-2 text-red-600 hover:text-red-700"
                            data-testid="button-discharge-patient"
                          >
                            <Minus className="h-4 w-4" />
                            Discharge Patient
                          </Button>
                          <Button
                            onClick={() => setIsRoomUpdateDialogOpen(true)}
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-2"
                            data-testid="button-update-room"
                          >
                            <Edit className="h-4 w-4" />
                            Update Room
                          </Button>
                        </>
                      );
                    } else {
                      // Patient is not admitted - show admit button
                      return (
                        <Button
                          onClick={() => {
                            // Set current LOCAL date and time when opening admission dialog
                            const now = new Date();
                            const currentDateTime =
                              now.getFullYear() +
                              "-" +
                              String(now.getMonth() + 1).padStart(2, "0") +
                              "-" +
                              String(now.getDate()).padStart(2, "0") +
                              "T" +
                              String(now.getHours()).padStart(2, "0") +
                              ":" +
                              String(now.getMinutes()).padStart(2, "0");

                            admissionForm.setValue(
                              "admissionDate",
                              currentDateTime,
                            );
                            setIsAdmissionDialogOpen(true);
                          }}
                          size="sm"
                          className="flex items-center gap-2"
                          data-testid="button-add-admission"
                        >
                          <Plus className="h-4 w-4" />
                          New Admission
                        </Button>
                      );
                    }
                  })()}
                </div>
              </CardHeader>
              <CardContent>
                {admissions && admissions.length > 0 ? (
                  <div className="space-y-6">
                    {admissions.map((admission: any) => {
                      const events = admissionEventsMap[admission.id] || [];
                      const doctor = doctors.find(
                        (d: Doctor) => d.id === admission.doctorId,
                      );

                      return (
                        <div
                          key={admission.id}
                          className="border rounded-lg p-4"
                        >
                          {/* Admission Episode Header */}
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-4">
                              <h3 className="font-semibold text-lg">
                                {admission.admissionId}
                              </h3>
                              <Badge
                                className={
                                  admission.status === "admitted"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-gray-100 text-gray-800"
                                }
                                variant="secondary"
                              >
                                {admission.status}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {doctor ? doctor.name : "No Doctor Assigned"}
                            </div>
                          </div>

                          {/* Admission Summary */}
                          <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">
                                Current Room:
                              </span>
                              <div className="font-medium">
                                {admission.currentWardType &&
                                admission.currentRoomNumber
                                  ? `${admission.currentWardType} (${admission.currentRoomNumber})`
                                  : "Not assigned"}
                              </div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">
                                Admission Date:
                              </span>
                              <div className="font-medium">
                                {(() => {
                                  let admissionDateStr = admission.admissionDate;

                                  // Handle different date formats and correct IST display
                                  if (
                                    admissionDateStr.match(
                                      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/,
                                    )
                                  ) {
                                    // Datetime-local format: "YYYY-MM-DDTHH:MM"
                                    const parts = admissionDateStr.split("T");
                                    const dateParts = parts[0].split("-");
                                    const timeParts = parts[1].split(":");

                                    // Create date object and subtract 5.5 hours to correct IST display
                                    const localDate = new Date(
                                      parseInt(dateParts[0]), // year
                                      parseInt(dateParts[1]) - 1, // month (0-indexed)
                                      parseInt(dateParts[2]), // day
                                      parseInt(timeParts[0]), // hour
                                      parseInt(timeParts[1]), // minute
                                    );

                                    // Subtract 5.5 hours (19800000 ms) to correct IST display
                                    const correctedDate = new Date(localDate.getTime() - (5.5 * 60 * 60 * 1000));

                                    return correctedDate.toLocaleString("en-US", {
                                      year: "numeric",
                                      month: "short",
                                      day: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                      hour12: true,
                                    });
                                  } else if (
                                    admissionDateStr.match(
                                      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/,
                                    )
                                  ) {
                                    // Full datetime format: "YYYY-MM-DD HH:MM:SS"
                                    const parts = admissionDateStr.split(" ");
                                    const dateParts = parts[0].split("-");
                                    const timeParts = parts[1].split(":");

                                    // Create date object and subtract 5.5 hours to correct IST display
                                    const localDate = new Date(
                                      parseInt(dateParts[0]), // year
                                      parseInt(dateParts[1]) - 1, // month (0-indexed)
                                      parseInt(dateParts[2]), // day
                                      parseInt(timeParts[0]), // hour
                                      parseInt(timeParts[1]), // minute
                                      parseInt(timeParts[2]), // second
                                    );

                                    // Subtract 5.5 hours (19800000 ms) to correct IST display
                                    const correctedDate = new Date(localDate.getTime() - (5.5 * 60 * 60 * 1000));

                                    return correctedDate.toLocaleString("en-US", {
                                      year: "numeric",
                                      month: "short",
                                      day: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                      hour12: true,
                                    });
                                  } else if (
                                    admissionDateStr.match(
                                      /^\d{4}-\d{2}-\d{2}$/,
                                    )
                                  ) {
                                    // Date only format: "YYYY-MM-DD"
                                    const dateParts = admissionDateStr.split("-");
                                    const localDate = new Date(
                                      parseInt(dateParts[0]), // year
                                      parseInt(dateParts[1]) - 1, // month (0-indexed)
                                      parseInt(dateParts[2]), // day
                                    );

                                    return localDate.toLocaleDateString("en-US", {
                                      year: "numeric",
                                      month: "short",
                                      day: "numeric",
                                    });
                                  }

                                  // Fallback for other formats (including ISO strings)
                                  const date = new Date(admissionDateStr);
                                  if (!isNaN(date.getTime())) {
                                    // For ISO strings, also subtract 5.5 hours to correct IST display
                                    const correctedDate = new Date(date.getTime() - (5.5 * 60 * 60 * 1000));

                                    return correctedDate.toLocaleString("en-US", {
                                      year: "numeric",
                                      month: "short",
                                      day: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                      hour12: true,
                                    });
                                  }

                                  return admissionDateStr; // Return as-is if parsing fails
                                })()}
                              </div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">
                                {admission.status === "discharged"
                                  ? "Discharge Date:"
                                  : "Days Admitted:"}
                              </span>
                              <div className="font-medium">
                                {admission.dischargeDate
                                  ? (() => {
                                      // Handle SQLite datetime format as local time (no timezone conversion)
                                      let dischargeDateStr =
                                        admission.dischargeDate;
                                      if (
                                        dischargeDateStr.match(
                                          /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/,
                                        )
                                      ) {
                                        // Parse as local time without adding 'Z' or timezone info
                                        const parts =
                                          dischargeDateStr.split(" ");
                                        const dateParts = parts[0].split("-");
                                        const timeParts = parts[1].split(":");

                                        // Create date object in local timezone
                                        const localDate = new Date(
                                          parseInt(dateParts[0]), // year
                                          parseInt(dateParts[1]) - 1, // month (0-indexed)
                                          parseInt(dateParts[2]), // day
                                          parseInt(timeParts[0]), // hour
                                          parseInt(timeParts[1]), // minute
                                          parseInt(timeParts[2]), // second
                                        );

                                        return localDate.toLocaleString(
                                          "en-US",
                                          {
                                            year: "numeric",
                                            month: "short",
                                            day: "numeric",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                            hour12: true,
                                          },
                                        );
                                      }

                                      // Fallback for other formats
                                      return new Date(
                                        dischargeDateStr,
                                      ).toLocaleString("en-US", {
                                        year: "numeric",
                                        month: "short",
                                        day: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                        hour12: true,
                                      });
                                    })()
                                  : calcStayDays(admission.admissionDate)}
                              </div>
                            </div>
                          </div>

                          {/* Event Timeline */}
                          {events.length > 0 && (
                            <div>
                              <h4 className="font-medium mb-2 text-sm text-muted-foreground">
                                Event History:
                              </h4>
                              <div className="space-y-2">
                                {events.map((event: AdmissionEvent) => (
                                  <div
                                    key={event.id}
                                    className="flex items-start gap-3 text-sm"
                                  >
                                    <div
                                      className={`w-2 h-2 rounded-full mt-2 ${
                                        event.eventType === "admit"
                                          ? "bg-green-500"
                                          : event.eventType === "room_change"
                                            ? "bg-blue-500"
                                            : "bg-gray-500"
                                      }`}
                                    />
                                    <div className="flex-1">
                                      <div className="flex items-center justify-between">
                                        <span className="font-medium capitalize">
                                          {event.eventType.replace("_", " ")}
                                          {event.roomNumber &&
                                            event.wardType &&
                                            ` - ${event.wardType} (${event.roomNumber})`}
                                        </span>
                                        <span className="text-muted-foreground text-xs">
                                          {new Date(
                                            event.eventTime,
                                          ).toLocaleString("en-US", {
                                            month: "short",
                                            day: "numeric",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                            hour12: true,
                                          })}
                                        </span>
                                      </div>
                                      {event.notes && (
                                        <div className="text-muted-foreground text-xs mt-1">
                                          {event.notes}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground">
                      No admissions recorded
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pathology">
            <Card>
              <CardHeader>
                <CardTitle>Pathology Tests</CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  // Extract individual tests from all orders
                  const allTests: any[] = [];

                  if (pathologyOrders && pathologyOrders.length > 0) {
                    pathologyOrders.forEach((orderItem: any) => {
                      // The API returns objects with 'order' and 'tests' properties at the top level
                      const order = orderItem.order;
                      const tests = orderItem.tests;

                      if (!order) {
                        return;
                      }

                      // Get tests from the order data
                      if (tests && Array.isArray(tests) && tests.length > 0) {
                        tests.forEach((test: any) => {
                          // Prefer the field that actually contains time information
                          const rawOrdered = order.orderedDate;
                          const rawCreated = order.createdAt;
                          const orderDateRaw =
                            rawOrdered && /[:T]/.test(rawOrdered)
                              ? rawOrdered
                              : rawCreated || rawOrdered;

                          allTests.push({
                            ...test,
                            orderId: order.orderId || order.id,
                            orderDate: orderDateRaw,
                            orderStatus: order.status,
                            receiptNumber: order.receiptNumber,
                          });
                        });
                      }
                    });
                  }

                  return allTests.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Test Name</TableHead>
                          <TableHead>Price (₹)</TableHead>
                          <TableHead>Order ID</TableHead>
                          <TableHead>Ordered Date</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allTests.map((test: any, index: number) => (
                          <TableRow key={`${test.orderId}-${test.id || index}`}>
                            <TableCell className="font-medium">
                              {test.testName}
                            </TableCell>
                            <TableCell>₹{test.price || 0}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {test.orderId}
                            </TableCell>
                            <TableCell>
                              {(() => {
                                if (test.orderDate) {
                                  const result = parseTimestamp(
                                    test.orderDate,
                                    "Asia/Kolkata",
                                  );

                                  if (result.hasTime) {
                                    // Split the display to add styling
                                    const parts = result.display.split(" at ");
                                    if (parts.length === 2) {
                                      return (
                                        <>
                                          {parts[0]}
                                          <span className="text-muted-foreground ml-2">
                                            at {parts[1]}
                                          </span>
                                        </>
                                      );
                                    }
                                  }

                                  return result.display;
                                }
                                return "N/A";
                              })()}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate(`/pathology`)}
                                data-testid={`view-test-${test.id || index}`}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-sm text-muted-foreground">
                        No pathology tests found
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Debug: {pathologyOrders?.length || 0} orders received
                      </p>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="timeline">
            <Card>
              <CardHeader>
                <CardTitle>Patient Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(() => {
                    // Simple function to get timestamp for any date input
                    const getEventTimestamp = (dateInput: any, fallbackDate?: any) => {
                      if (!dateInput && fallbackDate) dateInput = fallbackDate;
                      if (!dateInput) return new Date().getTime();

                      // Handle string dates
                      if (typeof dateInput === 'string') {
                        // SQLite format: "YYYY-MM-DD HH:MM:SS"
                        if (dateInput.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
                          const timestamp = new Date(dateInput.replace(' ', 'T')).getTime();
                          return isNaN(timestamp) ? new Date().getTime() : timestamp;
                        }
                        // Date with time: "YYYY-MM-DDTHH:MM:SS"
                        if (dateInput.includes('T')) {
                          const timestamp = new Date(dateInput).getTime();
                          return isNaN(timestamp) ? new Date().getTime() : timestamp;
                        }
                        // Date only: "YYYY-MM-DD"
                        if (dateInput.match(/^\d{4}-\d{2}-\d{2}$/)) {
                          const timestamp = new Date(dateInput + 'T00:00:00').getTime();
                          return isNaN(timestamp) ? new Date().getTime() : timestamp;
                        }
                        const timestamp = new Date(dateInput).getTime();
                        return isNaN(timestamp) ? new Date().getTime() : timestamp;
                      }

                      const timestamp = new Date(dateInput).getTime();
                      return isNaN(timestamp) ? new Date().getTime() : timestamp;
                    };

                    // Create timeline events array
                    const timelineEvents = [];

                    // Add patient registration
                    if (patient?.createdAt) {
                      timelineEvents.push({
                        id: "registration",
                        type: "registration",
                        title: "Patient Registered",
                        description: `Patient ID: ${patient.patientId}`,
                        color: "bg-blue-500",
                        sortTimestamp: getEventTimestamp(patient.createdAt),
                        originalTimestamp: patient.createdAt,
                      });
                    }

                    // Add services  
                    if (services && services.length > 0) {
                      services.forEach((service: any) => {
                        let serviceDate = service.createdAt;
                        if (!serviceDate && service.scheduledDate) {
                          serviceDate = service.scheduledTime 
                            ? `${service.scheduledDate}T${service.scheduledTime}:00`
                            : `${service.scheduledDate}T00:00:00`;
                        }

                        const cost = service.calculatedAmount || (service.price * (service.quantity || 1));

                        timelineEvents.push({
                          id: `service-${service.id}`,
                          type: "service",
                          title: service.serviceName,
                          description: `Status: ${service.status} • Cost: ₹${cost}`,
                          color: "bg-green-500",
                          sortTimestamp: getEventTimestamp(serviceDate),
                          originalTimestamp: serviceDate,
                          rawData: { service },
                        });
                      });
                    }

                    // Add admission events
                    if (admissions && admissions.length > 0) {
                      admissions.forEach((admission: any) => {
                        const events = admissionEventsMap[admission.id] || [];
                        const doctor = doctors.find((d: Doctor) => d.id === admission.doctorId);
                        const doctorName = doctor ? doctor.name : "No Doctor Assigned";

                        // Add admission events 
                        events.forEach((event: AdmissionEvent) => {
                          let title = "";
                          let color = "bg-orange-500";
                          let description = "";

                          switch (event.eventType) {
                            case "admit":
                              title = "Patient Admitted";
                              color = "bg-green-500";
                              break;
                            case "room_change":
                              title = "Room Transfer";
                              color = "bg-blue-500";
                              break;
                            case "discharge":
                              title = "Patient Discharged";
                              color = "bg-gray-500";
                              break;
                            default:
                              title = `Admission ${event.eventType}`;
                          }

                          if (event.roomNumber && event.wardType) {
                            description = `Room: ${event.roomNumber} (${event.wardType})`;
                          }

                          const eventTime = event.eventTime || event.createdAt;
                          timelineEvents.push({
                            id: `admission-${event.id}`,
                            type: "admission_event",
                            title,
                            description,
                            color,
                            sortTimestamp: getEventTimestamp(eventTime),
                            originalTimestamp: eventTime,
                            rawData: { event },
                          });
                        });

                        // Add basic admission if no events
                        if (events.length === 0) {
                          const admissionTime = admission.createdAt || admission.admissionDate;
                          timelineEvents.push({
                            id: `admission-${admission.id}`,
                            type: "admission",
                            title: "Patient Admission",
                            description: `Doctor: ${doctorName} • Ward: ${admission.wardType || 'N/A'}`,
                            color: "bg-orange-500",
                            sortTimestamp: getEventTimestamp(admissionTime),
                            originalTimestamp: admissionTime,
                            rawData: { admission },
                          });
                        }

                        // Add payments
                        if (admission.lastPaymentDate && admission.lastPaymentAmount) {
                          timelineEvents.push({
                            id: `payment-${admission.id}`,
                            type: "payment",
                            title: "Payment Received",
                            description: `Amount: ₹${admission.lastPaymentAmount}`,
                            color: "bg-green-600",
                            sortTimestamp: getEventTimestamp(admission.lastPaymentDate),
                            originalTimestamp: admission.lastPaymentDate,
                          });
                        }

                        // Add discounts
                        if (admission.lastDiscountDate && admission.lastDiscountAmount) {
                          timelineEvents.push({
                            id: `discount-${admission.id}`,
                            type: "discount",
                            title: "Discount Applied",
                            description: `Amount: ₹${admission.lastDiscountAmount}`,
                            color: "bg-red-500",
                            sortTimestamp: getEventTimestamp(admission.lastDiscountDate),
                            originalTimestamp: admission.lastDiscountDate,
                          });
                        }
                      });
                    }

                    // Add pathology orders
                    if (pathologyOrders && pathologyOrders.length > 0) {
                      pathologyOrders.forEach((orderData: any) => {
                        const order = orderData.order || orderData;
                        if (!order) return;

                        const orderTime = order.createdAt || order.orderedDate;
                        timelineEvents.push({
                          id: `pathology-${order.id || Date.now()}`,
                          type: "pathology",
                          title: `Pathology Order: ${order.orderId || "Unknown"}`,
                          description: `Status: ${order.status || "ordered"} • Cost: ₹${order.totalPrice || 0}`,
                          color: "bg-purple-500",
                          sortTimestamp: getEventTimestamp(orderTime),
                          originalTimestamp: orderTime,
                          rawData: { order },
                        });
                      });
                    }

                    // Add OPD visits 
                    if (opdVisits && opdVisits.length > 0) {
                      opdVisits.forEach((visit: any) => {
                        // Construct visit date consistently - prioritize scheduled date over createdAt for chronological ordering
                        let visitDate = visit.createdAt; // Default fallback

                        // If we have scheduled date, use that for proper chronological order
                        if (visit.scheduledDate) {
                          if (visit.scheduledTime) {
                            // Ensure time has seconds component
                            const timeSegments = visit.scheduledTime.split(':');
                            const time = timeSegments.length === 2 ? `${visit.scheduledTime}:00` : visit.scheduledTime;
                            visitDate = `${visit.scheduledDate}T${time}`;
                          } else {
                            // If no time specified, default to noon to ensure chronological order
                            visitDate = `${visit.scheduledDate}T12:00:00`;
                          }
                        }

                        const doctor = doctors?.find((d: Doctor) => d.id === visit.doctorId);
                        const doctorName = doctor ? doctor.name : "Unknown Doctor";

                        timelineEvents.push({
                          id: `opd-${visit.id}`,
                          type: "opd_visit",
                          title: "OPD Consultation",
                          description: `OPD consultation with ${doctorName}${visit.symptoms ? ` - ${visit.symptoms}` : ""}`,
                          color: "bg-indigo-500",
                          sortTimestamp: getEventTimestamp(visitDate),
                          originalTimestamp: visitDate,
                          rawData: { visit, doctor },
                        });
                      });
                    }

                    // Sort all events chronologically (latest first) with stable secondary sort
                    timelineEvents.sort((a, b) => {
                      const timestampDiff = b.sortTimestamp - a.sortTimestamp;
                      if (timestampDiff !== 0) return timestampDiff;
                      // Stable secondary sort by id
                      return a.id.localeCompare(b.id);
                    });

                    return timelineEvents.length > 0 ? (
                      timelineEvents.map((event) => (
                        <div
                          key={event.id}
                          className={
                            event.type === "registration"
                              ? "w-full"
                              : "flex items-stretch gap-3"
                          }
                        >
                          <div
                            className={`${event.type === "registration" ? "w-full" : "flex-1"} flex items-start gap-3 p-3 border rounded-lg`}
                          >
                            <div
                              className={`w-3 h-3 ${event.color} rounded-full mt-1`}
                            />
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <p className="font-medium">{event.title}</p>
                                <span className="text-sm text-muted-foreground">
                                  {(() => {
                                    // Display stored time as local IST in 12-hour format without timezone conversion
                                    let timestampToFormat = event.originalTimestamp;

                                    // Special handling for OPD visits to show actual scheduled time
                                    if (event.type === "opd_visit" && event.rawData?.visit) {
                                      const visit = event.rawData.visit;
                                      if (visit.scheduledDate && visit.scheduledTime) {
                                        // Create proper datetime from scheduled date and time
                                        timestampToFormat = `${visit.scheduledDate}T${visit.scheduledTime}`;
                                      }
                                    }

                                    // For patient registration, show the exact stored time without any timezone adjustment
                                    if (event.type === "registration") {
                                      // Parse the stored timestamp as a local datetime string to avoid timezone conversion
                                      const storedTime = timestampToFormat;
                                      
                                      // Handle ISO format timestamps by extracting components manually
                                      if (storedTime.includes('T')) {
                                        const [datePart, timePart] = storedTime.split('T');
                                        const [year, month, day] = datePart.split('-').map(Number);
                                        const [hours, minutes, seconds] = timePart.split(':').map(Number);
                                        
                                        // Create date using local timezone components (no UTC conversion)
                                        const localDate = new Date(year, month - 1, day, hours, minutes, seconds);
                                        
                                        return localDate.toLocaleString("en-US", {
                                          year: "numeric",
                                          month: "short",
                                          day: "numeric",
                                        hour: "numeric",
                                        minute: "2-digit",
                                        hour12: true,
                                      });
                                    }

                                    // Treat stored time as local IST and display in 12-hour format
                                    const displayDate = new Date(timestampToFormat);
                                    return displayDate.toLocaleString("en-US", {
                                      year: "numeric",
                                      month: "short",
                                      day: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                      hour12: true,
                                    });
                                  })()}
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {event.description}
                              </p>
                              {(event as any).extraInfo && (
                                <p className="text-sm text-green-600">
                                  {(event as any).extraInfo}
                                </p>
                              )}
                            </div>
                          </div>
                          {event.type !== "registration" && (
                            <div className="flex items-stretch">
                              <div className="flex items-center h-full">
                                <ReceiptTemplate
                                  receiptData={generateReceiptData(
                                    event,
                                    event.type,
                                  )}
                                  hospitalInfo={hospitalInfo}
                                  onPrint={() => {
                                    toast({
                                      title: "Receipt printed",
                                      description:
                                        "Receipt has been sent to printer.",
                                    });
                                  }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-center text-muted-foreground py-8">
                        <p>
                          Patient timeline will show services, admissions, and
                          pathology orders as they are added.
                        </p>
                      </div>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Service Dialog */}
      <Dialog open={isServiceDialogOpen} onOpenChange={setIsServiceDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedServiceType === "opd"
                ? "Schedule OPD Consultation"
                : "Schedule Patient Service"}
            </DialogTitle>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              console.log("Form submit event triggered");
              e.preventDefault();

              // Get form data manually to bypass schema validation issues
              const formData = serviceForm.getValues();
              console.log("Submit button clicked");
              console.log("Form is valid:", serviceForm.formState.isValid);
              console.log("Form errors:", serviceForm.formState.errors);
              console.log("Selected service type:", selectedServiceType);
              console.log("Selected services count:", selectedServices.length);
              console.log("Service name:", formData.serviceName);
              console.log("Price:", formData.price);

              // Call our custom validation
              onServiceSubmit(formData);
            }}
            className="space-y-6"
          >
            {selectedServiceType === "opd" && (
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-800 font-medium">
                  OPD Consultation
                </p>
                {(() => {
                  const selectedDoctorId = serviceForm.watch("doctorId");
                  const selectedDoctor = doctors.find(
                    (d: Doctor) => d.id === selectedDoctorId,
                  );
                  const consultationFee =
                    selectedDoctorId &&
                    selectedDoctorId !== "none" &&
                    selectedDoctor
                      ? selectedDoctor.consultationFee
                      : 0;

                  return (
                    <p className="text-sm text-blue-600">
                      Consultation fee: ₹{consultationFee}
                      {(!selectedDoctorId || selectedDoctorId === "none") && (
                        <span className="text-blue-500 ml-1">
                          (Select doctor to see fee)
                        </span>
                      )}
                    </p>
                  );
                })()}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>
                  {selectedServiceType === "opd"
                    ? "Consulting Doctor *"
                    : "Assigned Doctor *"}
                </Label>
                <Select
                  value={serviceForm.watch("doctorId") || ""}
                  onValueChange={(value) => {
                    console.log("=== DOCTOR SELECTION DEBUG ===");
                    console.log("Doctor selection changed to:", value);
                    console.log("Doctor selection value type:", typeof value);
                    console.log("Is value 'none':", value === "none");
                    console.log("Is value empty string:", value === "");

                    // Find doctor info
                    if (value && value !== "none" && value !== "") {
                      const selectedDoctor = doctors?.find((d: Doctor) => d.id === value);
                      console.log("Selected doctor:", selectedDoctor);
                    }

                    serviceForm.setValue("doctorId", value);

                    // Verify the form actually updated
                    setTimeout(() => {
                      const currentValue = serviceForm.getValues("doctorId");
                      console.log("Form doctorId after setValue:", currentValue);
                    }, 100);
                  }}
                  data-testid="select-doctor"
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        selectedServiceType === "opd"
                          ? "Select consulting doctor (required)"
                          : "Select doctor (required)"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedServiceType !== "opd" && (
                      <SelectItem value="none">No doctor assigned</SelectItem>
                    )}
                    {doctors.map((doctor: Doctor) => (
                      <SelectItem key={doctor.id} value={doctor.id}>
                        {doctor.name} - {doctor.specialization}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {serviceForm.formState.errors.doctorId && (
                  <p className="text-sm text-red-600">
                    {serviceForm.formState.errors.doctorId.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Scheduled Date *</Label>
                <Input
                  type="date"
                  {...serviceForm.register("scheduledDate", {
                    required: "Scheduled date is required",
                  })}
                  data-testid="input-service-date"
                />
                {serviceForm.formState.errors.scheduledDate && (
                  <p className="text-sm text-red-600">
                    {serviceForm.formState.errors.scheduledDate.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Scheduled Time *</Label>
                <Input
                  type="time"
                  {...serviceForm.register("scheduledTime", {
                    required: "Scheduled time is required",
                  })}
                  data-testid="input-service-time"
                />
                {serviceForm.formState.errors.scheduledTime && (
                  <p className="text-sm text-red-600">
                    {serviceForm.formState.errors.scheduledTime.message}
                  </p>
                )}
              </div>
            </div>

            {selectedServiceType !== "opd" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Select Service from Catalog</Label>
                  <div className="flex items-center space-x-2">
                    <Select
                      value={selectedServiceCategory || "all"}
                      onValueChange={(value) => {
                        setSelectedServiceCategory(
                          value === "all" ? "" : value,
                        );
                        // Reset service selection when category changes
                        serviceForm.setValue("serviceType", "");
                        serviceForm.setValue("serviceName", "");
                        serviceForm.setValue("price", 0);
                        setSelectedCatalogService(null); // Reset selected service
                        setBillingPreview(null); // Reset billing preview
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
                        onChange={(e) => {
                          setSelectedServiceSearchQuery(e.target.value);
                          // Reset service selection when search changes
                          serviceForm.setValue("serviceType", "");
                          serviceForm.setValue("serviceName", "");
                          serviceForm.setValue("price", 0);
                          setSelectedCatalogService(null); // Reset selected service
                          setBillingPreview(null); // Reset billing preview
                        }}
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
                          (service) => {
                            const isSelected = selectedServices.some(
                              (s) => s.id === service.id,
                            );
                            const isAmbulanceService =
                              service.billingType === "composite";
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
                                          {
                                            ...service,
                                            quantity: isAmbulanceService
                                              ? 0
                                              : 1,
                                          },
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
                                    <div className="flex flex-col">
                                      <Input
                                        type="number"
                                        min={isAmbulanceService ? "0" : "1"}
                                        step={
                                          service.billingType === "per_hour"
                                            ? "0.5"
                                            : isAmbulanceService
                                              ? "0.1"
                                              : "1"
                                        }
                                        value={
                                          selectedServices.find(
                                            (s) => s.id === service.id,
                                          )?.quantity ||
                                          (isAmbulanceService ? 0 : 1)
                                        }
                                        onChange={(e) => {
                                          const quantity =
                                            parseFloat(e.target.value) ||
                                            (isAmbulanceService ? 0 : 1);
                                          setSelectedServices(
                                            selectedServices.map((s) =>
                                              s.id === service.id
                                                ? { ...s, quantity }
                                                : s,
                                            ),
                                          );

                                          // Update form fields for billing calculation
                                          if (isAmbulanceService) {
                                            serviceForm.setValue(
                                              "distance",
                                              quantity,
                                            );
                                          } else if (
                                            service.billingType === "per_hour"
                                          ) {
                                            serviceForm.setValue(
                                              "hours",
                                              quantity,
                                            );
                                          } else {
                                            serviceForm.setValue(
                                              "quantity",
                                              quantity,
                                            );
                                          }
                                        }}
                                        className="w-20 h-8"
                                        placeholder={
                                          isAmbulanceService ? "km" : "qty"
                                        }
                                      />
                                      {isAmbulanceService && (
                                        <span className="text-xs text-gray-500 mt-1">
                                          km
                                        </span>
                                      )}
                                    </div>
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

                {/* Smart Billing Parameters */}
                {selectedCatalogService && (
                  <>
                    {/* Per Instance Quantity */}
                    {selectedCatalogService.billingType === "per_instance" && (
                      <div className="space-y-2">
                        <Label>Quantity</Label>
                        <Input
                          type="number"
                          min="1"
                          value={serviceForm.watch("quantity") || 1}
                          onChange={(e) =>
                            serviceForm.setValue(
                              "quantity",
                              parseInt(e.target.value) || 1,
                            )
                          }
                          data-testid="input-quantity"
                        />
                      </div>
                    )}

                    {/* Per 24 Hours */}
                    {selectedCatalogService.billingType === "per_24_hours" && (
                      <div className="space-y-2">
                        <Label>Number of Days</Label>
                        <Input
                          type="number"
                          min="1"
                          value={serviceForm.watch("quantity") || 1}
                          onChange={(e) =>
                            serviceForm.setValue(
                              "quantity",
                              parseInt(e.target.value) || 1,
                            )
                          }
                          data-testid="input-days"
                        />
                        <p className="text-sm text-gray-500">
                          Room charges are calculated per 24-hour period
                        </p>
                      </div>
                    )}

                    {/* Per Hour */}
                    {selectedCatalogService.billingType === "per_hour" && (
                      <div className="space-y-2">
                        <Label>Number of Hours</Label>
                        <Input
                          type="number"
                          min="0.5"
                          step="0.5"
                          value={serviceForm.watch("hours") || 1}
                          onChange={(e) =>
                            serviceForm.setValue(
                              "hours",
                              parseFloat(e.target.value) || 1,
                            )
                          }
                          data-testid="input-hours"
                        />
                        <p className="text-sm text-gray-500">
                          Service will be charged at ₹
                          {selectedCatalogService.price} per hour
                        </p>
                      </div>
                    )}

                    {/* Composite Billing */}
                    {selectedCatalogService.billingType === "composite" && (
                      <div className="space-y-2">
                        <Label>Distance (km)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.1"
                          value={serviceForm.watch("distance") || 0}
                          onChange={(e) =>
                            serviceForm.setValue(
                              "distance",
                              parseFloat(e.target.value) || 0,
                            )
                          }
                          placeholder="Enter distance in kilometers"
                          data-testid="input-distance"
                        />
                        <p className="text-sm text-gray-500">
                          {(() => {
                            const params =
                              selectedCatalogService.billingParameters
                                                                 ? JSON.parse(
                                    selectedCatalogService.billingParameters,
                                  )
                                : {};
                            return `Fixed charge: ₹${params.fixedCharge || selectedCatalogService.price}, Per km: ₹${params.perKmRate || 0}`;
                          })()}
                        </p>
                      </div>
                    )}

                    {/* Variable Billing */}
                    {selectedCatalogService.billingType === "variable" && (
                      <div className="space-y-2">
                        <Label>Variable Price (₹)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={serviceForm.watch("price") || 0}
                          onChange={(e) =>
                            serviceForm.setValue(
                              "price",
                              parseFloat(e.target.value) || 0,
                            )
                          }
                          placeholder="Enter variable price"
                          data-testid="input-variable-price"
                        />
                        <p className="text-sm text-gray-500">
                          Enter the exact amount to be charged (quantity is
                          always 1)
                        </p>
                      </div>
                    )}

                    {/* Per Date Billing */}
                    {selectedCatalogService.billingType === "per_date" && (
                      <div className="space-y-2">
                        <Label>Number of Calendar Days</Label>
                        <Input
                          type="number"
                          min="1"
                          value={serviceForm.watch("quantity") || 1}
                          onChange={(e) =>
                            serviceForm.setValue(
                              "quantity",
                              parseInt(e.target.value) || 1,
                            )
                          }
                          data-testid="input-calendar-days"
                        />
                        <p className="text-sm text-gray-500">
                          Charged for each calendar date during admission period
                          (different from 24-hour billing)
                        </p>
                      </div>
                    )}
                  </>
                )}

                {/* Custom Service Input */}
                <div className="space-y-2">
                  <Label>Custom Service Name</Label>
                  <Input
                    value={serviceForm.watch("serviceName")}
                    onChange={(e) =>
                      serviceForm.setValue("serviceName", e.target.value)
                    }
                    placeholder="Enter custom service name"
                    disabled={!!serviceForm.watch("serviceType")}
                    data-testid="input-custom-service-name"
                  />
                  <p className="text-sm text-gray-500">
                    Only available when no catalog service is selected
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Price (₹) *</Label>
                  <Input
                    type="number"
                    value={serviceForm.watch("price") || ""}
                    onChange={(e) =>
                      serviceForm.setValue(
                        "price",
                        parseFloat(e.target.value) || 0,
                      )
                    }
                    placeholder="Enter price"
                    disabled={!!billingPreview}
                    data-testid="input-service-price"
                  />
                  {billingPreview && (
                    <p className="text-sm text-green-600">
                      Price calculated automatically based on billing parameters
                    </p>
                  )}
                </div>

                {/* Services Summary */}
                {selectedServices.length > 0 && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium mb-3">
                      Selected Services Summary
                    </h4>
                    <div className="space-y-2">
                      {selectedServices.map((service) => (
                        <div
                          key={service.id}
                          className="flex justify-between items-center text-sm"
                        >
                          <span className="font-medium">{service.name}</span>
                          <span>
                            {service.price === 0 ? (
                              <Badge variant="secondary">Variable</Badge>
                            ) : (
                              `₹${(service.price * (service.quantity || 1)).toLocaleString()}`
                            )}
                          </span>
                        </div>
                      ))}
                      <div className="border-t pt-2 mt-2 flex justify-between items-center font-semibold">
                        <span>Total ({selectedServices.length} services)</span>
                        <span>
                          ₹
                          {selectedServices
                            .reduce(
                              (total, service) =>
                                total + service.price * (service.quantity || 1),
                              0,
                            )
                            .toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Form Fields */}
              </div>
            )}

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                {...serviceForm.register("notes")}
                placeholder="Additional notes about the service..."
                data-testid="textarea-service-notes"
              />
            </div>

            {/* Validation Helper Text */}
            {selectedServiceType !== "opd" &&
              selectedServices.length === 0 &&
              (!serviceForm.watch("serviceName") ||
                !serviceForm.watch("serviceName").trim() ||
                !serviceForm.watch("price") ||
                serviceForm.watch("price") <= 0) && (
                <div
                  className="bg-amber-50 border border-amber-200 rounded-lg p-3"
                  data-testid="text-service-submit-help"
                >
                  <div className="flex items-center gap-2 text-amber-800">
                    <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                    <span className="text-sm font-medium">
                      To schedule services, please either:
                    </span>
                  </div>
                  <ul className="mt-2 text-sm text-amber-700 list-disc list-inside ml-4">
                    <li>
                      Select services from the catalog above by checking the
                      boxes, OR
                    </li>
                    <li>
                      Enter both service name and price (greater than ₹0) in the
                    manual entry fields
                    </li>
                  </ul>
                </div>
              )}

            {selectedServiceType === "opd" &&
              (!serviceForm.watch("doctorId") ||
                serviceForm.watch("doctorId") === "none" ||
                serviceForm.watch("doctorId") === "") && (
                <div
                  className="bg-amber-50 border border-amber-200 rounded-lg p-3"
                  data-testid="text-opd-doctor-help"
                >
                  <div className="flex items-center gap-2 text-amber-800">
                    <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                    <span className="text-sm font-medium">
                      Please select a doctor for the OPD consultation
                    </span>
                  </div>
                </div>
              )}

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsServiceDialogOpen(false);
                  setSelectedServiceType("");
                  setSelectedServiceCategory("");
                  setSelectedServiceSearchQuery(""); // Clear search query on close
                  setSelectedCatalogService(null); // Reset selected service
                  setBillingPreview(null); // Reset billing preview
                  serviceForm.reset({
                    patientId: patientId || "",
                    serviceType: "",
                    serviceName: "",
                    scheduledDate: "",
                    scheduledTime: "",
                    doctorId: "",
                    serviceId: "", // Reset serviceId
                    notes: "",
                    price: 0,
                    quantity: 1,
                    hours: 1,
                    distance: 0,
                  });
                }}
                data-testid="button-cancel-service"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createServiceMutation.isPending}
                data-testid="button-submit-service"
                onClick={(e) => {
                  console.log("Submit button clicked");
                  console.log("Form is valid:", serviceForm.formState.isValid);
                  console.log("Form errors:", serviceForm.formState.errors);
                  console.log("Selected service type:", selectedServiceType);
                  console.log(
                    "Selected services count:",
                    selectedServices.length,
                  );
                  console.log(
                    "Service name:",
                    serviceForm.watch("serviceName"),
                  );
                  console.log("Price:", serviceForm.watch("price"));

                  // Let the form handle submission naturally
                }}
              >
                {createServiceMutation.isPending
                  ? "Scheduling..."
                  : selectedServiceType === "opd"
                    ? "Schedule OPD"
                    : selectedServices.length > 0
                      ? `Schedule ${selectedServices.length} Service(s)`
                      : "Schedule Service"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Admission Dialog */}
      <Dialog
        open={isAdmissionDialogOpen}
        onOpenChange={setIsAdmissionDialogOpen}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Admit Patient</DialogTitle>
          </DialogHeader>

          <Form {...admissionForm}>
            <form
              onSubmit={admissionForm.handleSubmit(onAdmissionSubmit)}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      {doctors.map((doctor: Doctor) => (
                        <SelectItem key={doctor.id} value={doctor.id}>
                          {doctor.name} - {doctor.specialization}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Ward/Room Type *</Label>
                  <Select
                    value={admissionForm.watch("currentWardType")}
                    onValueChange={(value) => {
                      admissionForm.setValue("currentWardType", value);
                      admissionForm.setValue("currentRoomNumber", ""); // Clear room selection when ward type changes
                      // Auto-set daily cost based on selected room type
                      const selectedRoomType = roomTypes.find(
                        (rt: any) => rt.name === value,
                      );
                      if (selectedRoomType) {
                        admissionForm.setValue(
                          "dailyCost",
                          selectedRoomType.dailyCost,
                        );
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
                          {roomType.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
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

                        // Get all rooms for this room type
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

                        // Check which rooms are actually occupied based on current admissions
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

                <div className="space-y-2">
                  <Label>Admission Date & Time *</Label>
                  <Input
                    type="datetime-local"
                    {...admissionForm.register("admissionDate")}
                    data-testid="input-admission-date"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Reason for Admission</Label>
                <Input
                  {...admissionForm.register("reason")}
                  placeholder="Brief reason for admission (optional)"
                  data-testid="input-admission-reason"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Daily Cost (₹) *</Label>
                  <Input
                    type="number"
                    {...admissionForm.register("dailyCost", {
                      valueAsNumber: true,
                    })}
                    placeholder="Daily ward cost"
                    data-testid="input-daily-cost"
                    readOnly={!!admissionForm.watch("currentWardType")}
                    className={
                      admissionForm.watch("currentWardType") ? "bg-gray-50" : ""
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Initial Deposit (₹)</Label>
                  <Input
                    type="number"
                    {...admissionForm.register("initialDeposit", {
                      valueAsNumber: true,
                    })}
                    placeholder="Initial deposit amount"
                    data-testid="input-initial-deposit"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  {...admissionForm.register("notes")}
                  placeholder="Additional notes..."
                  data-testid="textarea-admission-notes"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAdmissionDialogOpen(false)}
                  data-testid="button-cancel-admission"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createAdmissionMutation.isPending}
                  data-testid="button-admit"
                >
                  {createAdmissionMutation.isPending
                    ? "Admitting..."
                    : "Admit Patient"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Discharge Dialog */}
      <Dialog
        open={isDischargeDialogOpen}
        onOpenChange={setIsDischargeDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discharge Patient</DialogTitle>
          </DialogHeader>

          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Are you sure you want to discharge this patient? This action will
              mark the admission as completed and set the discharge date to now.
            </p>

            {(() => {
              const currentAdmission = admissions?.find(
                (adm: any) => adm.status === "admitted",
              );
              if (currentAdmission) {
                return (
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm">
                      <strong>Room:</strong>{" "}
                      {currentAdmission.currentRoomNumber}
                    </p>
                    <p className="text-sm">
                      <strong>Ward Type:</strong>{" "}
                      {currentAdmission.currentWardType}
                    </p>
                    <p className="text-sm">
                      <strong>Admission Date:</strong>{" "}
                      {formatDate(currentAdmission.admissionDate)}
                    </p>
                  </div>
                );
              }
              return null;
            })()}

            <div className="mt-4">
              <Label htmlFor="discharge-datetime">Discharge Date & Time</Label>
              <Input
                id="discharge-datetime"
                type="datetime-local"
                value={dischargeDateTime}
                onChange={(e) => setDischargeDateTime(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDischargeDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => onDischargePatient(dischargeDateTime)}
              disabled={dischargePatientMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {dischargePatientMutation.isPending
                ? "Discharging..."
                : "Discharge Patient"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Room Update Dialog */}
      <Dialog
        open={isRoomUpdateDialogOpen}
        onOpenChange={setIsRoomUpdateDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Room Assignment</DialogTitle>
          </DialogHeader>

          <form
            onSubmit={roomUpdateForm.handleSubmit(onRoomUpdate)}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Ward Type *</Label>
              <Select
                value={roomUpdateForm.watch("wardType")}
                onValueChange={(value) => {
                  roomUpdateForm.setValue("wardType", value);
                  roomUpdateForm.setValue("roomNumber", ""); // Clear room selection when ward type changes
                }}
                data-testid="select-update-ward-type"
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select ward type" />
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

            <div className="space-y-2">
              <Label>Room Number *</Label>
              <Select
                value={roomUpdateForm.watch("roomNumber")}
                onValueChange={(value) =>
                  roomUpdateForm.setValue("roomNumber", value)
                }
                disabled={!roomUpdateForm.watch("wardType")}
                data-testid="select-update-room-number"
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      roomUpdateForm.watch("wardType")
                        ? "Select available room"
                        : "Select ward type first"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {(() => {
                    const selectedWardType = roomUpdateForm.watch("wardType");
                    const selectedRoomType = roomTypes.find(
                      (rt: any) => rt.name === selectedWardType,
                    );

                    if (!selectedRoomType) return null;

                    // Get all rooms for this room type
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

                    // Check which rooms are actually occupied based on current admissions
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

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsRoomUpdateDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateRoomMutation.isPending}>
                {updateRoomMutation.isPending ? "Updating..." : "Update Room"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Payment</DialogTitle>
          </DialogHeader>

          <div className="py-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Payment Amount *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="Enter payment amount"
                  data-testid="input-payment-amount"
                />
              </div>

              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select defaultValue="cash">
                  <SelectTrigger data-testid="select-payment-method">
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="bank-transfer">Bank Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
                type="button"
                variant="outline"
                onClick={() => setIsPaymentDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const amount = parseFloat(paymentAmount);
                  if (amount > 0) {
                    addPaymentMutation.mutate({
                      amount: amount,
                      paymentMethod: "cash", // Default to cash, can be extended with a dropdown
                      reason: "Payment",
                    });
                  }
                }}
                disabled={
                  addPaymentMutation.isPending ||
                  !paymentAmount ||
                  parseFloat(paymentAmount) <= 0
                }
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {addPaymentMutation.isPending
                  ? "Adding Payment..."
                  : "Add Payment"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Discount Dialog */}
        <Dialog
          open={isDiscountDialogOpen}
          onOpenChange={setIsDiscountDialogOpen}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Discount</DialogTitle>
            </DialogHeader>

            <div className="py-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Discount Amount *</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(e.target.value)}
                    placeholder="Enter discount amount"
                    data-testid="input-discount-amount"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Reason for Discount</Label>
                  <Input
                    type="text"
                    value={discountReason}
                    onChange={(e) => setDiscountReason(e.target.value)}
                    placeholder="Enter reason for discount (optional)"
                    data-testid="input-discount-reason"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDiscountDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const amount = parseFloat(discountAmount);

                  if (amount > 0) {
                    addDiscountMutation.mutate({
                      amount: amount,
                      reason: discountReason.trim() || "Manual discount",
                      discountType: "manual",
                    });
                  } else {
                    toast({
                      title: "Error",
                      description: "Please enter a valid discount amount.",
                      variant: "destructive",
                    });
                  }
                }}
                disabled={
                  addDiscountMutation.isPending ||
                  !discountAmount ||
                  parseFloat(discountAmount) <= 0
                }
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {addDiscountMutation.isPending
                  ? "Adding Discount..."
                  : "Add Discount"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Comprehensive Bill Dialog */}
        {isComprehensiveBillOpen && comprehensiveBillData && (
          <ComprehensiveBillTemplate
            billData={comprehensiveBillData}
            hospitalInfo={hospitalInfo}
            isOpen={isComprehensiveBillOpen}
            onClose={() => {
              console.log("Closing comprehensive bill dialog");
              setIsComprehensiveBillOpen(false);
            }}
          />
        )}

        {/* OPD Visit Dialog */}
        <Dialog open={isOpdVisitDialogOpen} onOpenChange={setIsOpdVisitDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Schedule OPD Appointment</DialogTitle>
            </DialogHeader>

            <Form {...opdVisitForm}>
              <form
                onSubmit={opdVisitForm.handleSubmit((data) => {
                  console.log("OPD form submitted with data:", data);

                  // Validate required fields
                  if (!data.doctorId) {
                    toast({
                      title: "Error",
                      description: "Please select a doctor",
                      variant: "destructive",
                    });
                    return;
                  }

                  if (!data.scheduledDate) {
                    toast({
                      title: "Error",
                      description: "Please select a date",
                      variant: "destructive",
                    });
                    return;
                  }

                  if (!data.scheduledTime) {
                    toast({
                      title: "Error",
                      description: "Please select a time",
                      variant: "destructive",
                    });
                    return;
                  }

                  // Ensure consultation fee is included
                  const consultationFee = data.consultationFee || 0;
                  if (consultationFee <= 0) {
                    toast({
                      title: "Error",
                      description: "Please enter a valid consultation fee",
                      variant: "destructive",
                    });
                    return;
                  }

                  createOpdVisitMutation.mutate({
                    ...data,
                    consultationFee: consultationFee
                  });
                })}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={opdVisitForm.control}
                    name="doctorId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Doctor *</FormLabel>
                        <Select 
                          onValueChange={(value) => {
                            field.onChange(value);
                            // Auto-fill consultation fee when doctor is selected
                            const selectedDoctor = doctors?.find((d: Doctor) => d.id === value);
                            if (selectedDoctor) {
                              opdVisitForm.setValue("consultationFee", selectedDoctor.consultationFee);
                            } else {
                              // If no doctor is selected or it's an invalid ID, reset fee
                              opdVisitForm.setValue("consultationFee", undefined);
                            }
                          }} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-opd-doctor">
                              <SelectValue placeholder="Select a doctor" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {doctors?.map((doctor: Doctor) => (
                              <SelectItem key={doctor.id} value={doctor.id}>
                                {doctor.name} - {doctor.specialization}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={opdVisitForm.control}
                    name="consultationFee"
                    render={({ field }) => (
                      <FormItem>
                        <Label>Consultation Fee (₹)</Label>
                        {(() => {
                          const selectedDoctorId = opdVisitForm.watch("doctorId");
                          const selectedDoctor = doctors.find(
                            (d: Doctor) => d.id === selectedDoctorId,
                          );
                          const defaultFee = selectedDoctor ? selectedDoctor.consultationFee : 0;
                          const currentFee = opdVisitForm.watch("consultationFee");

                          // Set default fee when doctor changes, but only if the field hasn't been manually edited
                          React.useEffect(() => {
                            if (selectedDoctor && (currentFee === undefined || currentFee === 0)) {
                              opdVisitForm.setValue("consultationFee", defaultFee);
                            }
                          }, [selectedDoctorId, defaultFee]); // Remove currentFee dependency to prevent interference

                          return (
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                step="1"
                                value={currentFee === undefined ? "" : currentFee}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  // Allow empty string (complete erasure)
                                  if (value === "") {
                                    field.onChange(undefined);
                                    opdVisitForm.setValue("consultationFee", undefined);
                                  } else {
                                    const fee = parseFloat(value) || 0;
                                    field.onChange(fee);
                                    opdVisitForm.setValue("consultationFee", fee);
                                  }
                                }}
                                placeholder="Enter consultation fee"
                                data-testid="input-consultation-fee"
                              />
                            </FormControl>
                          );
                        })()}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={opdVisitForm.control}
                    name="scheduledDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date *</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            {...field}
                            data-testid="input-opd-date"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={opdVisitForm.control}
                    name="scheduledTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Time *</FormLabel>
                        <FormControl>
                          <Input
                            type="time"
                            {...field}
                            data-testid="input-opd-time"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={opdVisitForm.control}
                  name="symptoms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Symptoms (Optional)</FormLabel>
                      <FormControl>
                        <textarea
                          {...field}
                          className="w-full min-h-[80px] p-2 border border-input rounded-md"
                          placeholder="Enter symptoms or reason for visit..."
                          data-testid="textarea-opd-symptoms"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsOpdVisitDialogOpen(false)}
                    data-testid="button-cancel-opd"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createOpdVisitMutation.isPending}
                    data-testid="button-schedule-opd-visit"
                  >
                    {createOpdVisitMutation.isPending
                      ? "Scheduling..."
                      : "Schedule Appointment"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
    </div>
  );
}