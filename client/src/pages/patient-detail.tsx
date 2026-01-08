import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/hooks/use-auth";
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
  Loader2, // Import Loader2 for loading spinners
  CreditCard, // Import CreditCard for payment button
  Percent, // Import Percent for discount button
  Zap, // Import Zap for smart billing button
  TicketX, // Import TicketX for refund button
  TicketCheck, // Import TicketCheck for record payment button
  TicketPercent, // Import TicketPercent for apply discount button
  Trash2, // Import Trash2 for delete buttons
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
import { useTimezone } from "@/hooks/use-timezone";

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
  const { user } = useAuth();
  const patientId = params.id;
  const { formatDateTime, formatDate, formatTime } = useTimezone();

  // State for dialogs and selections
  const [isServiceDialogOpen, setIsServiceDialogOpen] = useState(false);
  const [selectedServiceType, setSelectedServiceType] = useState("opd");
  const [selectedServiceCategory, setSelectedServiceCategory] =
    useState<string>("");
  const [selectedServiceSearchQuery, setSelectedServiceSearchQuery] =
    useState(""); // Renamed from serviceSearchQuery to avoid conflict
  const [
    selectedServiceCategorySearchQuery,
    setSelectedServiceCategorySearchQuery,
  ] = useState(""); // Added for filtering services by category name
  const [selectedCatalogService, setSelectedCatalogService] =
    useState<any>(null);
  const [billingPreview, setBillingPreview] = useState<any>(null);
  const [isAdmissionDialogOpen, setIsAdmissionDialogOpen] = useState(false);
  const [isDischargeDialogOpen, setIsDischargeDialogOpen] = useState(false);
  const [isRoomUpdateDialogOpen, setIsRoomUpdateDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [selectedBillableItem, setSelectedBillableItem] = useState("");
  const [selectedAdmissionForPayment, setSelectedAdmissionForPayment] =
    useState("");
  const [isDiscountDialogOpen, setIsDiscountDialogOpen] = useState(false);
  const [discountAmount, setDiscountAmount] = useState("");
  const [discountReason, setDiscountReason] = useState("");
  const [isRefundDialogOpen, setIsRefundDialogOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refundMethod, setRefundMethod] = useState("cash");
  const [selectedRefundBillableItem, setSelectedRefundBillableItem] =
    useState("");
  const [selectedDiscountBillableItem, setSelectedDiscountBillableItem] =
    useState("");
  const [dischargeDateTime, setDischargeDateTime] = useState("");
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [customServices, setCustomServices] = useState<
    Array<{ id: string; name: string; price: number; quantity: number }>
  >([]);

  // For Comprehensive Bill
  const [isComprehensiveBillOpen, setIsComprehensiveBillOpen] = useState(false);
  const [comprehensiveBillData, setComprehensiveBillData] = useState<any>(null);
  const [isLoadingBill, setIsLoadingBill] = useState(false);
  const [isOpdVisitDialogOpen, setIsOpdVisitDialogOpen] = useState(false);

  // Check user roles for billing staff restrictions
  const currentUserRoles = user?.roles || [user?.role]; // Backward compatibility
  const isBillingStaff =
    currentUserRoles.includes("billing_staff") &&
    !currentUserRoles.includes("admin") &&
    !currentUserRoles.includes("super_user");

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
    // Helper function to get doctor name from doctor ID
    const getDoctorName = () => {
      // First try to get doctor name from event directly
      if (event.doctorName && event.doctorName.trim() !== "") {
        return event.doctorName;
      }

      // Try to get from nested doctor object
      if (event.doctor?.name) {
        return event.doctor.name;
      }

      // Try to resolve doctor ID from the doctors array
      if (
        event.doctorId &&
        event.doctorId !== "" &&
        event.doctorId !== "none" &&
        doctors &&
        doctors.length > 0
      ) {
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

    // Handle service batch specially
    if (eventType === "service_batch") {
      const firstService = event.services[0];

      return {
        type: "service" as const,
        id: event.orderId || event.receiptNumber,
        title: `Service Order - ${event.services.length} service${event.services.length > 1 ? "s" : ""}`,
        date: firstService.sortTimestamp,
        amount: event.totalCost,
        description: event.services.map((s: any) => s.serviceName).join(", "),
        patientName: patient?.name || "Unknown Patient",
        patientId: patient?.patientId || "Unknown ID",
        details: {
          ...firstService,
          services: event.services,
          totalCost: event.totalCost,
          patientAge: patient?.age,
          patientGender: patient?.gender,
          doctorName: event.doctorName || getDoctorName(),
          orderId: event.orderId,
          receiptNumber: event.receiptNumber,
        },
      };
    }

    // Helper function to get receipt number from different sources
    const getReceiptNumber = () => {
      console.log("=== GET RECEIPT NUMBER DEBUG ===");
      console.log("Event type:", eventType);
      console.log("Event object keys:", Object.keys(event));
      console.log("Event.receiptNumber:", event.receiptNumber);
      console.log("Event.receipt_number:", event.receipt_number);

      // For OPD visits (which come as opd_visit type), try to get from visit data
      if (eventType === "opd_visit") {
        // Check all possible locations for the receipt number
        const receiptNum =
          event.receiptNumber ||
          event.receipt_number ||
          event.rawData?.visit?.receiptNumber ||
          event.rawData?.visit?.receipt_number;
        console.log("OPD visit receipt number found:", receiptNum);
        if (receiptNum) {
          return receiptNum;
        }
      }

      // For services, always use the stored receiptNumber
      if (eventType === "service") {
        const receiptNum = event.receiptNumber || event.receipt_number;
        console.log("Service receipt number found:", receiptNum);
        if (receiptNum) {
          return receiptNum;
        }
      }

      // For pathology, return the orderId (not receiptNumber) so backend can match LAB-XXXX pattern
      if (eventType === "pathology") {
        const orderId = event.orderId || event.rawData?.order?.orderId;
        console.log("Pathology orderId found:", orderId);
        if (orderId) {
          return orderId;
        }
      }

      // For admission events, try to get from admission event data
      if (eventType === "admission_event") {
        const receiptNum =
          event.receiptNumber ||
          event.receipt_number ||
          event.rawData?.event?.receiptNumber ||
          event.rawData?.event?.receipt_number;
        console.log("Admission event receipt number found:", receiptNum);
        if (receiptNum) {
          return receiptNum;
        }
      }

      // For admission fallback, try to get from admission data
      if (eventType === "admission") {
        const receiptNum =
          event.receiptNumber ||
          event.receipt_number ||
          event.rawData?.admission?.receiptNumber ||
          event.rawData?.admission?.receipt_number;
        console.log("Admission receipt number found:", receiptNum);
        if (receiptNum) {
          return receiptNum;
        }
      }

      // For other event types, try direct access
      const receiptNum = event.receiptNumber || event.receipt_number;
      console.log("Generic receipt number found:", receiptNum);
      if (receiptNum) {
        return receiptNum;
      }

      console.log("No receipt number found - returning RECEIPT-NOT-FOUND");
      console.log("=== END GET RECEIPT NUMBER DEBUG ===");
      return "RECEIPT-NOT-FOUND";
    };

    // Calculate the correct amount based on event type
    let eventAmount = 0;

    if (eventType === "opd_visit") {
      // For OPD visits, prioritize consultation fee from the event data
      eventAmount =
        event.consultationFee ||
        event.amount ||
        event.rawData?.visit?.consultationFee ||
        event.rawData?.doctor?.consultationFee ||
        0;
    } else {
      eventAmount = event.amount || event.price || event.totalPrice || 0;
    }

    // Base receipt data structure
    const baseReceiptData = {
      type: (eventType === "opd_visit" ? "service" : eventType) as
        | "service"
        | "pathology"
        | "admission"
        | "payment"
        | "discount",
      id: event.id,
      title:
        eventType === "opd_visit"
          ? "OPD Consultation"
          : event.title ||
            event.serviceName ||
            event.testName ||
            event.description ||
            "Service",
      date: event.sortTimestamp,
      amount: eventAmount,
      description:
        eventType === "opd_visit"
          ? `OPD Consultation - ${getDoctorName()}`
          : event.description || event.serviceName || event.testName || "",
      patientName: patient?.name || "Unknown Patient",
      patientId: patient?.patientId || "Unknown ID",
      details: {
        ...event,
        patientAge: patient?.age,
        patientGender: patient?.gender,
        doctorName: getDoctorName(),
        receiptNumber: getReceiptNumber(),
        consultationFee: eventAmount, // Ensure consultation fee is in details
        // For OPD visits, add explicit identifiers for receipt title detection
        ...(eventType === "opd_visit"
          ? {
              serviceType: "opd",
              serviceName: "OPD Consultation",
              category: "OPD Consultation",
              type: "opd_visit",
              rawData: {
                visit: {
                  receiptNumber: getReceiptNumber(),
                  ...event,
                },
              },
            }
          : {}),
        // For pathology orders, ensure tests are accessible
        tests:
          eventType === "pathology"
            ? event.tests || event.rawData?.tests || event.order?.tests
            : undefined,
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

  // Fetch patient payments
  const { data: patientPayments = [] } = useQuery({
    queryKey: ["/api/patients", patientId, "payments"],
    queryFn: async () => {
      const response = await fetch(`/api/patients/${patientId}/payments`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("hospital_token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch payments");
      return response.json();
    },
    enabled: !!patientId,
  });

  // Fetch patient discounts
  const { data: patientDiscounts = [] } = useQuery({
    queryKey: ["/api/patients", patientId, "discounts"],
    queryFn: async () => {
      const response = await fetch(`/api/patients/${patientId}/discounts`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("hospital_token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch discounts");
      return response.json();
    },
    enabled: !!patientId,
  });

  // Fetch patient refunds
  const { data: patientRefunds = [] } = useQuery({
    queryKey: ["/api/patients", patientId, "refunds"],
    queryFn: async () => {
      const response = await fetch(`/api/patients/${patientId}/refunds`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("hospital_token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch refunds");
      return response.json();
    },
    enabled: !!patientId,
  });

  // Fetch billable items for payment dialog
  const { data: billableItems = [] } = useQuery({
    queryKey: ["/api/patients", patientId, "billable-items"],
    queryFn: async () => {
      const response = await fetch(
        `/api/patients/${patientId}/billable-items`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("hospital_token")}`,
          },
        },
      );
      if (!response.ok) throw new Error("Failed to fetch billable items");
      return response.json();
    },
    enabled: !!patientId,
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
    resolver: zodResolver(
      z.object({
        patientId: z.string().min(1),
        doctorId: z.string().min(1, "Doctor is required"),
        scheduledDate: z.string().min(1, "Date is required"),
        scheduledTime: z.string().min(1, "Time is required"),
        consultationFee: z.number().optional(), // Added for OPD consultation fee
        symptoms: z.string().optional(),
      }),
    ),
    defaultValues: {
      patientId: patientId || "",
      doctorId: "",
      scheduledDate: "",
      scheduledTime: "",
      consultationFee: 0, // Initialize consultationFee
      symptoms: "",
    },
  });

  // Fetch system settings for timezone
  const { data: systemSettings } = useQuery({
    queryKey: ["/api/settings/system"],
  });

  // Update OPD form date/time when system settings load or timezone changes
  React.useEffect(() => {
    if (systemSettings?.timezone && isOpdVisitDialogOpen) {
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

      const currentDate = `${year}-${month}-${day}`;
      const currentTime = `${hour}:${minute}`;

      opdVisitForm.setValue("scheduledDate", currentDate);
      opdVisitForm.setValue("scheduledTime", currentTime);
    }
  }, [systemSettings?.timezone, isOpdVisitDialogOpen]);

  // Update service form date/time when system settings load or timezone changes
  React.useEffect(() => {
    if (systemSettings?.timezone && isServiceDialogOpen) {
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

      const currentDate = `${year}-${month}-${day}`;
      const currentTime = `${hour}:${minute}`;

      serviceForm.setValue("scheduledDate", currentDate);
      serviceForm.setValue("scheduledTime", currentTime);
    }
  }, [systemSettings?.timezone, isServiceDialogOpen]);

  // Update admission form date/time when system settings load or timezone changes
  React.useEffect(() => {
    if (systemSettings?.timezone && isAdmissionDialogOpen) {
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

      // The admission date is expected to be stored in UTC in the backend.
      // When displaying it in the form, we should convert it to the user's local time.
      // However, the datetime-local input expects a local string.
      // The goal here is to pre-fill the form with the current time in the user's local timezone.
      // The current implementation correctly sets the local time.
      admissionForm.setValue("admissionDate", currentDateTime);
    }
  }, [systemSettings?.timezone, isAdmissionDialogOpen]);

  // Auto-open service dialog if hash is present
  React.useEffect(() => {
    if (window.location.hash === "#add-service") {
      // Clear all service-related state first and close dialog to reset
      setIsServiceDialogOpen(false);
      setSelectedServices([]);
      setSelectedServiceType("");
      setSelectedServiceCategory("");
      setSelectedServiceSearchQuery("");
      setSelectedCatalogService(null);
      setBillingPreview(null);

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

      // Reset form completely
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

      // Use setTimeout to ensure state is cleared before opening
      setTimeout(() => {
        setIsServiceDialogOpen(true);
        // Clear the hash
        window.history.replaceState(null, "", window.location.pathname);
      }, 10);
    }
  }, []);

  // Update discharge date/time when system settings load or timezone changes
  React.useEffect(() => {
    if (systemSettings?.timezone && isDischargeDialogOpen) {
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

      setDischargeDateTime(currentDateTime);
    }
  }, [systemSettings?.timezone, isDischargeDialogOpen]);

  const watchedServiceValues = serviceForm.watch();

  // Sync form fields with component state
  useEffect(() => {
    serviceForm.setValue("serviceType", selectedServiceType);
    serviceForm.setValue("selectedServicesCount", selectedServices.length);
  }, [selectedServiceType, selectedServices.length]);

  // Calculate billing preview when service or parameters change
  useEffect(() => {
    if (selectedCatalogService && selectedCatalogService.billingType) {
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
        // Include doctorId for all service types
        doctorId: service.doctorId,
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

  // OPD Visit Creation Mutation
  const createOpdVisitMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log("Creating OPD visit with data:", data);
      // Server will generate receipt number
      return apiRequest("/api/opd-visits", {
        method: "POST",
        body: data,
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "OPD appointment scheduled!",
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

  // Track loading state for admission creation
  const [isCreatingAdmission, setIsCreatingAdmission] = useState(false);

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
        // ... (existing code for OPD)
      } else {
        // Handle selected catalog services
        if (selectedServices.length > 0) {
          const actualDoctorId = serviceForm.watch("doctorId");
          selectedServices.forEach((service: Service) => {
            const serviceData = {
              patientId: patientId,
              serviceType: service.category || "service",
              serviceName: service.name,
              price: (service.price || 0) * (service.quantity || 1),
              quantity: service.quantity || 1,
              notes: data.notes,
              scheduledDate: data.scheduledDate,
              scheduledTime: data.scheduledTime,
              status: "scheduled",
              doctorId:
                actualDoctorId &&
                actualDoctorId !== "none" &&
                actualDoctorId !== ""
                  ? actualDoctorId
                  : null,
            };
            servicesToCreate.push(serviceData);
          });
        }
        
        // Handle custom services
        if (customServices.length > 0) {
          const actualDoctorId = serviceForm.watch("doctorId");
          customServices.forEach((service) => {
            if (service.name && service.price > 0) {
              servicesToCreate.push({
                patientId: patientId,
                serviceType: "service",
                serviceName: service.name,
                price: service.price * service.quantity,
                quantity: service.quantity,
                notes: data.notes,
                scheduledDate: data.scheduledDate,
                scheduledTime: data.scheduledTime,
                status: "scheduled",
                doctorId:
                  actualDoctorId &&
                  actualDoctorId !== "none" &&
                  actualDoctorId !== ""
                    ? actualDoctorId
                    : null,
              });
            }
          });
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

      // Use the createServiceMutation which properly handles isPending state
      console.log("Creating services:", servicesToCreate);
      createServiceMutation.mutate(servicesToCreate);
    } catch (error) {
      console.error("Error in onServiceSubmit:", error);
      toast({
        title: "Form Submission Error",
        description:
          "An unexpected error occurred during form submission. Please check your inputs.",
        variant: "destructive",
      });
    }
  };

  const onAdmissionSubmit = async (data: any) => {
    // Validate required fields (reason is now optional)
    const requiredFields = [
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
      // ✅ Parse user-selected datetime and add current seconds/milliseconds
      const selectedDate = new Date(data.admissionDate);
      const now = new Date();

      // Set seconds and milliseconds from current time
      selectedDate.setSeconds(now.getSeconds());
      selectedDate.setMilliseconds(now.getMilliseconds());

      // Convert to UTC ISO string
      const utcAdmissionDate = selectedDate.toISOString();

      // Create admission first
      const admissionData = {
        ...data,
        admissionId: `ADM-${Date.now()}`,
        admissionDate: utcAdmissionDate,
      };

      const admissionResult = await apiRequest("/api/admissions", {
        method: "POST",
        body: admissionData,
      });

      // Create selected admission services in the new admission_services table
      if (selectedServices.length > 0) {
        const servicesToCreate = [];
        const selectedDoctorId = data.doctorId;

        for (const service of selectedServices) {
          servicesToCreate.push({
            patientId: patientId,
            admissionId: admissionResult.id,
            serviceName: service.name,
            serviceId: service.id,
            price: service.price,
            notes: `Admission service - ${service.name}`,
            scheduledDate: utcAdmissionDate.split("T")[0],
            scheduledTime: utcAdmissionDate.split("T")[1].slice(0, 5),
            status: "scheduled",
            doctorId: selectedDoctorId,
            billingType: service.billingType || "per_instance",
          });
        }

        // Create admission services using the new endpoint
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

      // Refresh data
      queryClient.invalidateQueries({
        queryKey: ["/api/admissions", patientId],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/admission-services"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/patient-services", patientId],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId] });

      setIsAdmissionDialogOpen(false);
      setSelectedServices([]);
      setSelectedServiceSearchQuery("");
      admissionForm.reset();

      toast({
        title: "Admission created successfully",
        description: `Patient admitted${selectedServices.length > 0 ? ` (${selectedServices.length} service${selectedServices.length !== 1 ? "s" : ""})` : ""}`,
      });

      // Auto-refresh page after successful admission
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error: any) {
      console.error("Admission creation error:", error);

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
    } finally {
      setIsCreatingAdmission(false);
    }
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
        description: "Patient discharged successfully.",
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
        description: "Patient transferred to a new room.",
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
      queryClient.invalidateQueries({ queryKey: ["/api/patient-payments"] });
      // Invalidate OPD visits to update OPD list page immediately
      queryClient.invalidateQueries({ queryKey: ["/api/opd-visits"] });
      // Invalidate doctor earnings queries to update salary tab immediately
      queryClient.invalidateQueries({ queryKey: ["/api/doctors"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/doctors/all-earnings"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/doctors/payments"] });
      setIsPaymentDialogOpen(false);
      setPaymentAmount("");
      setPaymentMethod("cash");
      setSelectedBillableItem("");
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

  const addRefundMutation = useMutation({
    mutationFn: async (data: { amount: number; reason: string; billableItemType: string; billableItemId: string }) => {
      const response = await fetch(`/api/patients/${patientId}/refunds`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("hospital_token")}`,
        },
        body: JSON.stringify({
          amount: data.amount,
          reason: data.reason,
          refundDate: new Date().toISOString(),
          billableItemType: data.billableItemType,
          billableItemId: data.billableItemId,
        }),
      });

      if (!response.ok) throw new Error("Failed to add refund");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/patients", patientId, "financial-summary"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId] });
      queryClient.invalidateQueries({
        queryKey: ["/api/patients", patientId, "refunds"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/patients", patientId, "billable-items"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/opd-visits", patientId] });
      queryClient.invalidateQueries({ queryKey: ["/api/opd-visits"] });
      queryClient.invalidateQueries({ queryKey: ["/api/doctors"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/doctors/all-earnings"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/doctors/payments"] });
      setIsRefundDialogOpen(false);
      setRefundAmount("");
      setRefundReason("");
      setSelectedRefundBillableItem("");
      toast({
        title: "Refund processed successfully",
        description: "The refund has been applied.",
      });
    },
    onError: () => {
      toast({
        title: "Error processing refund",
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
      billableItemType?: string;
      billableItemId?: string;
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
          billableItemType: data.billableItemType,
          billableItemId: data.billableItemId,
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
      // Invalidate doctor earnings queries to update salary tab immediately
      queryClient.invalidateQueries({ queryKey: ["/api/doctors"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/doctors/all-earnings"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/doctors/payments"] });
      // Invalidate billable items to update pending amounts
      queryClient.invalidateQueries({
        queryKey: ["/api/patients", patientId, "billable-items"],
      });
      setIsDiscountDialogOpen(false);
      setDiscountAmount("");
      setDiscountReason("");
      setSelectedDiscountBillableItem("");
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

    // ✅ Parse user-selected datetime and add current seconds/milliseconds
    const selectedDate = new Date(dischargeDateTime);
    const now = new Date();

    // Set seconds and milliseconds from current time
    selectedDate.setSeconds(now.getSeconds());
    selectedDate.setMilliseconds(now.getMilliseconds());

    // Convert to UTC ISO string
    const utcDateTime = selectedDate.toISOString();

    dischargePatientMutation.mutate({
      currentAdmissionId: currentAdmission.id,
      dischargeDateTime: utcDateTime,
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

  // Helper function to check if an OPD visit is fully refunded
  const isOpdVisitFullyRefunded = (visitId: string) => {
    if (!billableItems || billableItems.length === 0) return false;
    const billableItem = billableItems.find(
      (item: any) => item.type === "opd_visit" && item.value === visitId
    );
    return billableItem?.isFullyRefunded === true;
  };

  // Get effective status for OPD visit (shows "cancelled" if fully refunded)
  const getOpdVisitEffectiveStatus = (visit: any) => {
    if (isOpdVisitFullyRefunded(visit.visitId)) {
      return "cancelled";
    }
    return visit.status;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "in-progress":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "paid":
        return "bg-blue-50 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "scheduled":
        return "bg-orange-50 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
      case "referred":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      case "admitted":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "cancelled":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default:
        return "bg-gray-100 text-gray-800";
    }
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

    // Exclude pathology services from general service selection
    filtered = filtered.filter((s) => s.category !== "pathology");

    // Exclude admission services from general service selection
    filtered = filtered.filter((s) => s.category !== "admissions");

    // Exclude OPD Consultation from general service selection
    filtered = filtered.filter((s) => s.name !== "OPD Consultation");

    // Filter by category
    if (category && category !== "all") {
      filtered = filtered.filter((s) => s.category === category);
    }

    // Filter by search query
    if (selectedServiceSearchQuery.trim()) {
      filtered = filtered.filter(
        (s) =>
          s.name
            .toLowerCase()
            .includes(selectedServiceSearchQuery.toLowerCase()) ||
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
    // Clear all service-related state first and reset dialog
    setIsServiceDialogOpen(false); // Close first to ensure clean state
    setSelectedServices([]);
    setSelectedServiceType(serviceType);
    setSelectedServiceCategory("");
    setSelectedServiceSearchQuery(""); // Clear search query
    setSelectedCatalogService(null); // Reset selected service
    setBillingPreview(null); // Reset billing preview

    // Set the current time as default
    const now = new Date();
    const timeString = now.toTimeString().slice(0, 5); // HH:MM format
    const currentDate = now.toISOString().split("T")[0];

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

    // Use setTimeout to ensure state is cleared before opening
    setTimeout(() => {
      setIsServiceDialogOpen(true);
    }, 10);
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

  // Helper function to format billable item labels (for payment reason)
  const formatBillableItemLabel = (item: any) => {
    switch (item.type) {
      case "admission":
        return `Admission - ${item.value}`;
      case "admission_service":
        return `Admission Service - ${item.value}`;
      case "service":
        return `Service - ${item.value}`;
      case "pathology":
        return `Pathology - ${item.value}`;
      case "opd_visit":
        return `OPD Visit - ${item.value}`;
      default:
        return item.value; // Fallback to the raw value
    }
  };

  // Helper function to format billable item labels for dropdown (shows pending amount)
  const formatBillableItemDropdownLabel = (item: any) => {
    const baseLabel = formatBillableItemLabel(item);
    const pendingAmount = item.pendingAmount ?? item.amount;
    const totalAmount = item.amount ?? 0;
    
    if (item.isFullyPaid) {
      return `${baseLabel} - Rs.${totalAmount.toFixed(2)} (Paid)`;
    }
    
    if (pendingAmount < totalAmount && pendingAmount > 0) {
      return `${baseLabel} - Rs.${pendingAmount.toFixed(2)} pending of Rs.${totalAmount.toFixed(2)}`;
    }
    
    return `${baseLabel} - Rs.${totalAmount.toFixed(2)}`;
  };

  // Handler to open the payment dialog
  const handleOpenPaymentDialog = () => {
    setPaymentAmount(""); // Reset amount
    setPaymentMethod("cash"); // Reset method
    setSelectedBillableItem(""); // Reset billable item
    setIsPaymentDialogOpen(true);
  };

  if (!patient) {
    return (
      <div className="flex items-center justify-center h-64">
        Loading patient details...
      </div>
    );
  }

  return (
    <div>
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

      <div className="px-6 pb-6 pt-4">
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

        {/* Quick Actions - Hidden for billing staff */}
        {!isBillingStaff && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => {
                    console.log("OPD button clicked");
                    setIsOpdVisitDialogOpen(true);
                    opdVisitForm.reset({
                      patientId: patientId || "",
                      doctorId: "",
                      scheduledDate: "",
                      scheduledTime: "",
                      consultationFee: 0,
                      symptoms: "",
                    });
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
                    // Clear all service-related state first and close dialog to reset
                    setIsServiceDialogOpen(false);
                    setSelectedServices([]);
                    setSelectedServiceType("");
                    setSelectedServiceCategory("");
                    setSelectedServiceSearchQuery("");
                    setSelectedCatalogService(null); // Reset selected service
                    setBillingPreview(null); // Reset billing preview

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

                    // Reset form completely
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

                    // Use setTimeout to ensure state is cleared before opening
                    setTimeout(() => {
                      setIsServiceDialogOpen(true);
                    }, 10);
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
                          // Reset form to fresh state
                          admissionForm.reset();
                          setSelectedServices([]);
                          setSelectedServiceSearchQuery("");

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

                          // Refresh room availability and current admissions data
                          queryClient.invalidateQueries({
                            queryKey: ["/api/rooms"],
                          });
                          queryClient.invalidateQueries({
                            queryKey: ["/api/inpatients/currently-admitted"],
                          });

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
        )}

        {/* Financial Monitoring */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">Financial Summary</div>
              <div className="flex items-center gap-2">
                {/* Hide payment and discount buttons for receptionist users */}
                {(() => {
                  // Get user roles with fallback to single role for backward compatibility
                  const userRoles =
                    user?.roles || (user?.role ? [user.role] : []);
                  return !userRoles.includes("receptionist");
                })() && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => {
                        setRefundAmount("");
                        setRefundReason("");
                        setIsRefundDialogOpen(true);
                      }}
                      className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white"
                      data-testid="button-add-refund"
                    >
                      <TicketX className="h-4 w-4" />
                      Refund
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        setDiscountAmount("");
                        setDiscountReason("");
                        setIsDiscountDialogOpen(true);
                      }}
                      className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white"
                      data-testid="button-add-discount"
                    >
                      <TicketPercent className="h-4 w-4" />
                      Apply Discount
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleOpenPaymentDialog}
                      className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
                      data-testid="button-add-payment"
                    >
                      <TicketCheck className="h-4 w-4" />
                      Record Payment
                    </Button>
                  </>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-4">
              <div className="text-center p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">
                  Net Charges
                </p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                  {isFinancialLoading ? (
                    <span className="text-sm">Loading...</span>
                  ) : (
                    `₹${(financialSummary?.netCharges ?? financialSummary?.totalCharges ?? 0).toLocaleString()}`
                  )}
                </p>
                {(financialSummary?.totalRefunds || 0) > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    (Gross: ₹{(financialSummary?.totalCharges || 0).toLocaleString()})
                  </p>
                )}
              </div>

              <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Net Paid</p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                  {isFinancialLoading ? (
                    <span className="text-sm">Loading...</span>
                  ) : (
                    `₹${(financialSummary?.netPaid ?? financialSummary?.totalPaid ?? 0).toLocaleString()}`
                  )}
                </p>
                {(financialSummary?.totalRefunds || 0) > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    (Gross: ₹{(financialSummary?.totalPaid || 0).toLocaleString()})
                  </p>
                )}
              </div>

              <div className="text-center p-4 bg-purple-50 dark:bg-purple-950 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Discounts</p>
                <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                  {isFinancialLoading ? (
                    <span className="text-sm">Loading...</span>
                  ) : (
                    `₹${(financialSummary?.totalDiscounts || 0).toLocaleString()}`
                  )}
                </p>
              </div>

              <div className="text-center p-4 bg-red-50 dark:bg-red-950 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Refunds</p>
                <p className="text-2xl font-bold text-red-700 dark:text-red-300">
                  {isFinancialLoading ? (
                    <span className="text-sm">Loading...</span>
                  ) : (
                    `₹${(financialSummary?.totalRefunds || 0).toLocaleString()}`
                  )}
                </p>
              </div>

              <div
                className={`text-center p-4 rounded-lg ${(financialSummary?.balance || 0) < 0 ? "bg-red-50 dark:bg-red-950" : "bg-orange-50 dark:bg-orange-950"}`}
              >
                <p className="text-sm text-muted-foreground mb-1">Balance</p>
                <p
                  className={`text-2xl font-bold ${(financialSummary?.balance || 0) < 0 ? "text-red-700 dark:text-red-300" : "text-orange-700 dark:text-orange-300"}`}
                >
                  {isFinancialLoading ? (
                    <span className="text-sm">Loading...</span>
                  ) : (
                    `₹${(financialSummary?.balance || 0).toLocaleString()}`
                  )}
                </p>
                {(financialSummary?.balance || 0) < 0 && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
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
                    setIsOpdVisitDialogOpen(true);
                    opdVisitForm.reset({
                      patientId: patientId || "",
                      doctorId: "",
                      scheduledDate: "",
                      scheduledTime: "",
                      consultationFee: 0,
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
                          const dateA = new Date(
                            a.scheduledDate || a.createdAt,
                          );
                          const dateB = new Date(
                            b.scheduledDate || b.createdAt,
                          );
                          return dateB.getTime() - dateA.getTime();
                        })
                        .map((visit: any) => {
                          // Find doctor details
                          const doctor = doctors?.find(
                            (d: Doctor) => d.id === visit.doctorId,
                          );
                          const doctorName = doctor
                            ? doctor.name
                            : "Unknown Doctor";
                          const consultationFee = doctor
                            ? doctor.consultationFee
                            : 0;

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
                                  // Format date and time using configured timezone
                                  if (!visit.scheduledDate) return "N/A";

                                  // The scheduledDate and scheduledTime are already in UTC from the database
                                  // We just need to display them in the configured timezone
                                  if (!visit.scheduledTime) {
                                    return formatDate(visit.scheduledDate);
                                  }

                                  // Combine date and time for display
                                  const dateDisplay = formatDate(
                                    visit.scheduledDate,
                                  );
                                  const timeDisplay = formatTime(
                                    `${visit.scheduledDate}T${visit.scheduledTime}:00`,
                                  );

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
                                {(() => {
                                  const effectiveStatus = getOpdVisitEffectiveStatus(visit);
                                  return (
                                    <Badge className={getStatusColor(effectiveStatus)}>
                                      {effectiveStatus}
                                      {effectiveStatus === "cancelled" && visit.status !== "cancelled" && (
                                        <span className="ml-1">(refunded)</span>
                                      )}
                                    </Badge>
                                  );
                                })()}
                              </TableCell>
                              <TableCell>
                                {visit.symptoms || "No symptoms noted"}
                              </TableCell>
                              <TableCell>
                                ₹{visit.consultationFee || consultationFee}
                              </TableCell>
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
                        setIsOpdVisitDialogOpen(true);
                        opdVisitForm.reset({
                          patientId: patientId || "",
                          doctorId: "",
                          scheduledDate: "",
                          scheduledTime: "",
                          consultationFee: 0,
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
                    // Clear all service-related state first and close dialog to reset
                    setIsServiceDialogOpen(false);
                    setSelectedServices([]); // Clear selected services
                    setSelectedServiceType("");
                    setSelectedServiceCategory("");
                    setSelectedServiceSearchQuery(""); // Clear search query
                    setSelectedCatalogService(null); // Reset selected service
                    setBillingPreview(null); // Reset billing preview

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

                    // Reset form completely
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

                    // Use setTimeout to ensure state is cleared before opening
                    setTimeout(() => {
                      setIsServiceDialogOpen(true);
                    }, 10);
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
                        <TableHead>Service Name</TableHead>
                        <TableHead>Doctor</TableHead>
                        <TableHead>Scheduled Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Order No.</TableHead>
                        <TableHead className="text-right">Cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {services
                        .sort((a: any, b: any) => {
                          // Sort by scheduled date descending (latest first)
                          const dateA = new Date(
                            a.scheduledDate || a.createdAt,
                          );
                          const dateB = new Date(
                            b.scheduledDate || b.createdAt,
                          );
                          return dateB.getTime() - dateA.getTime();
                        })
                        .map((service: any) => {
                          // Determine doctor name with robust logic
                          let doctorName = "No Doctor Assigned";

                          // Check if doctorName is directly available from the joined query
                          if (
                            service.doctorName &&
                            service.doctorName.trim() !== ""
                          ) {
                            doctorName = service.doctorName;
                          } else if (
                            service.doctorId &&
                            service.doctorId !== "" &&
                            service.doctorId !== "none" &&
                            service.doctorId !== null
                          ) {
                            // Fallback to finding doctor in the doctors array
                            const doctor = doctors?.find(
                              (d: Doctor) => d.id === service.doctorId,
                            );
                            if (doctor) {
                              doctorName = doctor.name;
                            } else {
                              doctorName = "Unknown Doctor";
                            }
                          }

                          return (
                            <TableRow key={service.id}>
                              <TableCell className="font-medium">
                                {service.serviceName}
                                {service.notes && (
                                  <div className="text-sm text-muted-foreground">
                                    {service.notes}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>{doctorName}</TableCell>
                              <TableCell>
                                {(() => {
                                  // Format date and time using configured timezone
                                  if (!service.scheduledDate) return "N/A";

                                  // The scheduledDate and scheduledTime are already in the correct format
                                  // We just need to display them in the configured timezone
                                  if (!service.scheduledTime) {
                                    return formatDate(service.scheduledDate);
                                  }

                                  // Combine date and time for display (without adding Z to avoid timezone shift)
                                  const dateDisplay = formatDate(
                                    service.scheduledDate,
                                  );
                                  const timeDisplay = formatTime(
                                    `${service.scheduledDate}T${service.scheduledTime}:00`,
                                  );

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
                                <Badge
                                  className={getStatusColor(
                                    service.status || "scheduled",
                                  )}
                                >
                                  {service.status || "scheduled"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm text-muted-foreground">
                                  {service.orderId || "N/A"}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                ₹
                                {service.calculatedAmount || service.price || 0}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8">
                    <Stethoscope className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
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
                          {!isBillingStaff && (
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
                          )}
                          {!isBillingStaff && (
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
                          )}
                        </>
                      );
                    } else {
                      // Patient is not admitted - show admit button
                      return (
                        !isBillingStaff && (
                          <Button
                            onClick={() => {
                              // Reset form to fresh state
                              admissionForm.reset();
                              setSelectedServices([]);
                              setSelectedServiceSearchQuery("");

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

                              // Refresh room availability and current admissions data
                              queryClient.invalidateQueries({
                                queryKey: ["/api/rooms"],
                              });
                              queryClient.invalidateQueries({
                                queryKey: [
                                  "/api/inpatients/currently-admitted",
                                ],
                              });

                              setIsAdmissionDialogOpen(true);
                            }}
                            size="sm"
                            className="flex items-center gap-2"
                            data-testid="button-add-admission"
                          >
                            <Plus className="h-4 w-4" />
                            New Admission
                          </Button>
                        )
                      );
                    }
                  })()}
                </div>
              </CardHeader>
              <CardContent>
                {admissions && admissions.length > 0 ? (
                  <div>
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
                                  const admitEvent = events?.find(
                                    (e: any) => e.eventType === "admit",
                                  );
                                  const dateStr =
                                    admitEvent?.eventTime ||
                                    admission.admissionDate;

                                  // Parse the date string directly without timezone conversion
                                  // since it's already in local time from datetime-local input
                                  const date = new Date(dateStr);

                                  return new Intl.DateTimeFormat("en-US", {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                    hour: "numeric",
                                    minute: "2-digit",
                                    hour12: true,
                                  }).format(date);
                                })()}
                              </div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">
                                {admission.dischargeDate
                                  ? "Discharge Date:"
                                  : "Days Admitted:"}
                              </span>
                              <div className="font-medium">
                                {admission.dischargeDate
                                  ? formatDateTime(admission.dischargeDate)
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
                                          {formatDateTime(event.eventTime)}
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
                              {formatDateTime(test.orderDate)}
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
                    // Combine all events with timestamps for sorting
                    let allEvents: Array<{
                      type: string;
                      data: any;
                      timestamp: Date;
                      sortTimestamp: number;
                    }> = [];

                    // Add OPD visits
                    if (opdVisits && opdVisits.length > 0) {
                      opdVisits.forEach((visit: any) => {
                        const visitDateTime =
                          visit.scheduledDate && visit.scheduledTime
                            ? new Date(
                                `${visit.scheduledDate}T${visit.scheduledTime}:00`,
                              )
                            : new Date(visit.createdAt);

                        allEvents.push({
                          type: "opd_visit",
                          data: {
                            ...visit,
                            sortTimestamp: visitDateTime.getTime(),
                          },
                          timestamp: visitDateTime,
                          sortTimestamp: visitDateTime.getTime(),
                        });
                      });
                    }

                    // Group patient services by order ID (batch)
                    if (services && services.length > 0) {
                      // Filter out admission services to prevent duplicates in timeline
                      const nonAdmissionServices = services.filter(
                        (service: any) => service.serviceType !== "admission",
                      );

                      const serviceGroups = nonAdmissionServices.reduce(
                        (groups: any, service: any) => {
                          const orderId =
                            service.orderId || `BATCH-${service.id}`;
                          if (!groups[orderId]) {
                            groups[orderId] = [];
                          }
                          groups[orderId].push(service);
                          return groups;
                        },
                        {},
                      );

                      // Add each service group as a single event
                      Object.entries(serviceGroups).forEach(
                        ([orderId, groupServices]: [string, any]) => {
                          const firstService = groupServices[0];
                          const serviceDateTime = new Date(
                            `${firstService.scheduledDate}T${firstService.scheduledTime}:00`,
                          );

                          // Calculate total cost for the batch
                          const totalCost = groupServices.reduce(
                            (sum: number, service: any) => {
                              return (
                                sum +
                                (service.calculatedAmount || service.price || 0)
                              );
                            },
                            0,
                          );

                          allEvents.push({
                            type: "service_batch",
                            data: {
                              orderId,
                              receiptNumber: firstService.receiptNumber,
                              services: groupServices,
                              totalCost,
                              scheduledDate: firstService.scheduledDate,
                              scheduledTime: firstService.scheduledTime,
                              doctorId: firstService.doctorId,
                              doctorName: firstService.doctorName,
                              sortTimestamp: serviceDateTime.getTime(),
                            },
                            timestamp: serviceDateTime,
                            sortTimestamp: serviceDateTime.getTime(),
                          });
                        },
                      );
                    }

                    // Add pathology orders
                    if (pathologyOrders && pathologyOrders.length > 0) {
                      pathologyOrders.forEach((orderItem: any) => {
                        const order = orderItem.order || orderItem;
                        const tests = orderItem.tests || [];

                        // Use the ordered date for timeline
                        const orderDate = order.orderedDate || order.createdAt;
                        const orderDateTime = new Date(orderDate);

                        allEvents.push({
                          type: "pathology",
                          data: {
                            ...order,
                            tests: tests,
                            testName: tests
                              .map((test: any) => test.testName)
                              .join(", "),
                            orderId: order.orderId || order.id,
                            totalPrice: order.totalPrice,
                            receiptNumber: order.receiptNumber,
                            sortTimestamp: orderDateTime.getTime(),
                          },
                          timestamp: orderDateTime,
                          sortTimestamp: orderDateTime.getTime(),
                        });
                      });
                    }

                    // Add payments
                    if (patientPayments && patientPayments.length > 0) {
                      patientPayments.forEach((payment: any) => {
                        const paymentDateTime = new Date(
                          payment.paymentDate || payment.createdAt,
                        );

                        allEvents.push({
                          type: "payment",
                          data: {
                            ...payment,
                            sortTimestamp: paymentDateTime.getTime(),
                          },
                          timestamp: paymentDateTime,
                          sortTimestamp: paymentDateTime.getTime(),
                        });
                      });
                    }

                    // Add discounts
                    if (patientDiscounts && patientDiscounts.length > 0) {
                      patientDiscounts.forEach((discount: any) => {
                        const discountDateTime = new Date(
                          discount.discountDate || discount.createdAt,
                        );

                        allEvents.push({
                          type: "discount",
                          data: {
                            ...discount,
                            sortTimestamp: discountDateTime.getTime(),
                          },
                          timestamp: discountDateTime,
                          sortTimestamp: discountDateTime.getTime(),
                        });
                      });
                    }

                    // Add refunds
                    if (patientRefunds && patientRefunds.length > 0) {
                      patientRefunds.forEach((refund: any) => {
                        const refundDateTime = new Date(
                          refund.refundDate || refund.createdAt,
                        );

                        allEvents.push({
                          type: "refund",
                          data: {
                            ...refund,
                            sortTimestamp: refundDateTime.getTime(),
                          },
                          timestamp: refundDateTime,
                          sortTimestamp: refundDateTime.getTime(),
                        });
                      });
                    }

                    // Add admissions and related events
                    if (admissions && admissions.length > 0) {
                      admissions.forEach((admission: any) => {
                        // Get admission events for this admission
                        const events = admissionEventsMap[admission.id] || [];

                        // Find the initial 'admit' event (if any)
                        const admitEvent = events.find(
                          (event: any) => event.eventType === "admit",
                        );

                        // Add consolidated admission event (merge admission record with admit event)
                        allEvents.push({
                          type: "admission",
                          data: {
                            ...admission,
                            // Merge admit event details if available
                            admitEventNotes: admitEvent?.notes,
                            admitEventTime: admitEvent?.eventTime,
                            admitEventRoomNumber: admitEvent?.roomNumber,
                            admitEventWardType: admitEvent?.wardType,
                            receiptNumber: admitEvent?.receiptNumber,
                            sortTimestamp: new Date(
                              admission.admissionDate,
                            ).getTime(),
                          },
                          timestamp: new Date(admission.admissionDate),
                          sortTimestamp: new Date(
                            admission.admissionDate,
                          ).getTime(),
                        });

                        // Add other admission events (excluding 'admit' events to avoid duplication)
                        events.forEach((event: any) => {
                          if (event.eventType !== "admit") {
                            allEvents.push({
                              type: "admission_event",
                              data: {
                                ...event,
                                admission,
                                sortTimestamp: new Date(
                                  event.eventTime,
                                ).getTime(),
                              },
                              timestamp: new Date(event.eventTime),
                              sortTimestamp: new Date(
                                event.eventTime,
                              ).getTime(),
                            });
                          }
                        });

                        // Add discharge event if discharged (only if no explicit discharge event exists)
                        if (admission.dischargeDate) {
                          const hasDischargeEvent = events.some(
                            (event: any) => event.eventType === "discharge",
                          );
                          if (!hasDischargeEvent) {
                            allEvents.push({
                              type: "discharge",
                              data: {
                                ...admission,
                                sortTimestamp: new Date(
                                  admission.dischargeDate,
                                ).getTime(),
                              },
                              timestamp: new Date(admission.dischargeDate),
                              sortTimestamp: new Date(
                                admission.dischargeDate,
                              ).getTime(),
                            });
                          }
                        }
                      });
                    }

                    // Sort events by timestamp (most recent first)
                    allEvents.sort((a, b) => b.sortTimestamp - a.sortTimestamp);

                    if (allEvents.length === 0) {
                      return (
                        <div className="text-center py-8">
                          <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                          <p className="text-gray-500">
                            No timeline events yet
                          </p>
                        </div>
                      );
                    }

                    return allEvents.map((event, index) => {
                      // Define colors and icons for different event types
                      const getEventColor = (
                        eventType: string,
                        eventData?: any,
                      ) => {
                        // Check if this is a discharge admission_event and make it red
                        if (
                          eventType === "admission_event" &&
                          eventData?.eventType === "discharge"
                        ) {
                          return {
                            borderColor: "border-l-red-500",
                            bgColor: "bg-red-50",
                            iconColor: "text-red-600",
                          };
                        }

                        switch (eventType) {
                          case "opd_visit":
                            return {
                              borderColor: "border-l-blue-500",
                              bgColor: "bg-blue-50",
                              iconColor: "text-blue-600",
                            };
                          case "service_batch":
                          case "service":
                            return {
                              borderColor: "border-l-purple-500",
                              bgColor: "bg-purple-50",
                              iconColor: "text-purple-600",
                            };
                          case "pathology":
                            return {
                              borderColor: "border-l-pink-500",
                              bgColor: "bg-pink-50",
                              iconColor: "text-pink-600",
                            };
                          case "admission":
                            return {
                              borderColor: "border-l-green-500",
                              bgColor: "bg-green-50",
                              iconColor: "text-green-600",
                            };
                          case "admission_event":
                            return {
                              borderColor: "border-l-amber-500",
                              bgColor: "bg-amber-50",
                              iconColor: "text-amber-600",
                            };
                          case "discharge":
                            return {
                              borderColor: "border-l-red-500",
                              bgColor: "bg-red-50",
                              iconColor: "text-red-600",
                            };
                          case "payment":
                            return {
                              borderColor: "border-l-emerald-500",
                              bgColor: "bg-emerald-50",
                              iconColor: "text-emerald-600",
                            };
                          case "discount":
                            return {
                              borderColor: "border-l-orange-500",
                              bgColor: "bg-orange-50",
                              iconColor: "text-orange-600",
                            };
                          case "refund":
                            return {
                              borderColor: "border-l-red-400",
                              bgColor: "bg-red-50",
                              iconColor: "text-red-500",
                            };
                          default:
                            return {
                              borderColor: "border-l-gray-500",
                              bgColor: "bg-gray-50",
                              iconColor: "text-gray-600",
                            };
                        }
                      };

                      const eventColors = getEventColor(event.type, event.data);

                      return (
                        <div
                          key={`${event.type}-${index}`}
                          className={`relative mb-6 border-2 border-gray-200 rounded-lg ${eventColors.bgColor} ${eventColors.borderColor} hover:shadow-md transition-shadow duration-200`}
                        >
                          {/* Timeline connector line */}
                          {index < allEvents.length - 1 && (
                            <div className="absolute left-6 top-full h-6 w-0.5 bg-gray-300 z-0"></div>
                          )}

                          {/* Event icon circle */}
                          <div
                            className={`absolute -left-3 top-4 w-6 h-6 rounded-full ${eventColors.bgColor} border-2 ${eventColors.borderColor.replace("border-l-", "border-")} flex items-center justify-center`}
                          >
                            <div
                              className={`w-2 h-2 rounded-full ${eventColors.iconColor.replace("text-", "bg-")}`}
                            ></div>
                          </div>

                          <div className="p-4 pl-8">
                            <div className="flex items-center justify-between mb-3">
                              <h3
                                className={`font-semibold text-lg ${eventColors.iconColor}`}
                              >
                                {(() => {
                                  switch (event.type) {
                                    case "opd_visit":
                                      return `OPD Consultation - ${doctors.find((d: Doctor) => d.id === event.data.doctorId)?.name || "Unknown Doctor"} (${event.data.visitId || ""})`;
                                    case "service_batch":
                                      const serviceCount =
                                        event.data.services.length;
                                      return `Service Order - ${serviceCount} service${serviceCount > 1 ? "s" : ""} (${event.data.orderId})`;
                                    case "service":
                                      return (
                                        event.data.serviceName || "Service"
                                      );
                                    case "pathology":
                                      return `Pathology Tests - Order ${event.data.orderId}`;
                                    case "admission":
                                      return `Patient Admitted - ${event.data.admitEventWardType || event.data.currentWardType} (${event.data.admitEventRoomNumber || event.data.currentRoomNumber})`;
                                    case "admission_event":
                                      if (
                                        event.data.eventType === "room_change"
                                      ) {
                                        return `Room Transfer - ${event.data.wardType} (${event.data.roomNumber})`;
                                      }
                                      if (
                                        event.data.eventType === "discharge"
                                      ) {
                                        return "Patient Discharged";
                                      }
                                      return `Admission ${event.data.eventType}`;
                                    case "discharge":
                                      return "Patient Discharged";
                                    case "payment":
                                      return `Payment Received - ${event.data.paymentMethod || "Cash"}`;
                                    case "discount":
                                      return `Discount Applied - ${event.data.discountType || "Manual"}`;
                                    case "refund":
                                      return `Refund Processed - ${event.data.refundId || ""}`;
                                    default:
                                      return "Timeline Event";
                                  }
                                })()}
                              </h3>
                              <div className="flex items-center gap-3">
                                <div className="text-sm text-gray-500 font-medium bg-white px-2 py-1 rounded border">
                                  {formatDateTime(
                                    event.timestamp.toISOString(),
                                  )}
                                </div>
                                {/* Receipt/Print button for applicable events */}
                                {(event.type === "service" ||
                                  event.type === "service_batch" ||
                                  event.type === "pathology" ||
                                  event.type === "admission" ||
                                  event.type === "admission_event" ||
                                  event.type === "opd_visit") && (
                                  <ReceiptTemplate
                                    receiptData={generateReceiptData(
                                      event.data,
                                      event.type,
                                    )}
                                    hospitalInfo={hospitalInfo}
                                    trigger={
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 w-8 p-0 flex items-center justify-center hover:bg-white border rounded"
                                      >
                                        <Printer className="w-4 h-4" />
                                      </Button>
                                    }
                                  />
                                )}
                              </div>
                            </div>

                            <div className="text-sm text-gray-700 bg-white/50 rounded-md p-3 border border-gray-200">
                              {(() => {
                                switch (event.type) {
                                  case "opd_visit":
                                    return (
                                      <div className="space-y-1">
                                        <div className="font-medium">
                                          Consultation Fee:{" "}
                                          <span className="text-red-600 font-semibold">
                                            ₹{event.data.consultationFee || 0}
                                          </span>
                                        </div>
                                        {event.data.symptoms && (
                                          <div>
                                            <span className="font-medium">
                                              Symptoms:
                                            </span>{" "}
                                            {event.data.symptoms}
                                          </div>
                                        )}
                                        {event.data.diagnosis && (
                                          <div>
                                            <span className="font-medium">
                                              Diagnosis:
                                            </span>{" "}
                                            {event.data.diagnosis}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  case "service_batch":
                                    return (
                                      <div>
                                        <div className="font-medium mb-2 text-gray-800">
                                          Services in this order:
                                        </div>
                                        <div className="space-y-1 ml-4 bg-white rounded p-2 border">
                                          {event.data.services.map(
                                            (service: any, idx: number) => (
                                              <div
                                                key={idx}
                                                className="flex justify-between items-center text-sm"
                                              >
                                                <span>
                                                  • {service.serviceName}
                                                </span>
                                                <span className="font-medium">
                                                  ₹
                                                  {service.calculatedAmount ||
                                                    service.price}
                                                </span>
                                              </div>
                                            ),
                                          )}
                                        </div>
                                        <div className="flex justify-between items-center font-medium mt-3 pt-2 border-t border-gray-300 text-gray-800">
                                          <span>Total Cost:</span>
                                          <span className="text-lg text-red-600 font-semibold">
                                            ₹{event.data.totalCost}
                                          </span>
                                        </div>
                                        {(() => {
                                          // Get doctor name for service batch
                                          let doctorName = null;

                                          // Try to get doctor name from the event data
                                          if (
                                            event.data.doctorName &&
                                            event.data.doctorName.trim() !== ""
                                          ) {
                                            doctorName = event.data.doctorName;
                                          } else if (
                                            event.data.doctorId &&
                                            event.data.doctorId !== "" &&
                                            event.data.doctorId !== "none"
                                          ) {
                                            const doctor = doctors?.find(
                                              (d: Doctor) =>
                                                d.id === event.data.doctorId,
                                            );
                                            if (doctor) {
                                              doctorName = doctor.name;
                                            }
                                          }

                                          return doctorName ? (
                                            <div className="mt-2">
                                              <span className="font-medium">
                                                Doctor:
                                              </span>{" "}
                                              {doctorName}
                                            </div>
                                          ) : null;
                                        })()}
                                      </div>
                                    );
                                  case "service":
                                    return (
                                      <div className="space-y-1">
                                        <div className="font-medium">
                                          Cost:{" "}
                                          <span className="text-red-600 font-semibold">
                                            ₹
                                            {event.data.calculatedAmount ||
                                              event.data.price}
                                          </span>
                                        </div>
                                        {event.data.notes && (
                                          <div>
                                            <span className="font-medium">
                                              Notes:
                                            </span>{" "}
                                            {event.data.notes}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  case "pathology":
                                    return (
                                      <div>
                                        <div className="font-medium mb-2 text-gray-800">
                                          Tests in this order:
                                        </div>
                                        <div className="space-y-1 ml-4 bg-white rounded p-2 border">
                                          {event.data.tests &&
                                          event.data.tests.length > 0 ? (
                                            event.data.tests.map(
                                              (test: any, idx: number) => (
                                                <div
                                                  key={idx}
                                                  className="flex justify-between items-center text-sm"
                                                >
                                                  <span>• {test.testName}</span>
                                                  <span className="font-medium">
                                                    ₹{test.price || 0}
                                                  </span>
                                                </div>
                                              ),
                                            )
                                          ) : (
                                            <div className="flex justify-between items-center text-sm">
                                              <span>
                                                • {event.data.testName}
                                              </span>
                                              <span className="font-medium">
                                                ₹{event.data.totalPrice || 0}
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                        <div className="flex justify-between items-center font-medium mt-3 pt-2 border-t border-gray-300 text-gray-800">
                                          <span>Total Cost:</span>
                                          <span className="text-lg text-red-600 font-semibold">
                                            ₹{event.data.totalPrice}
                                          </span>
                                        </div>
                                        {(() => {
                                          // Get doctor name from the pathology order
                                          let doctorName = null;

                                          // Try to get doctor ID from the event data
                                          const doctorId =
                                            event.data.doctorId ||
                                            event.data.rawData?.order
                                              ?.doctorId ||
                                            event.data.order?.doctorId;

                                          if (
                                            doctorId &&
                                            doctors &&
                                            doctors.length > 0
                                          ) {
                                            const doctor = doctors.find(
                                              (d: Doctor) => d.id === doctorId,
                                            );
                                            if (doctor) {
                                              doctorName = doctor.name;
                                            }
                                          }

                                          return doctorName ? (
                                            <div className="mt-2">
                                              <span className="font-medium">
                                                Doctor:
                                              </span>{" "}
                                              {doctorName}
                                            </div>
                                          ) : null;
                                        })()}
                                        {event.data.remarks && (
                                          <div className="mt-1">
                                            <span className="font-medium">
                                              Remarks:
                                            </span>{" "}
                                            {event.data.remarks}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  case "admission":
                                    const admissionContent = (
                                      <div className="space-y-1">
                                        <div>
                                          <span className="font-medium">
                                            Daily Cost:
                                          </span>{" "}
                                          <span className="text-red-600 font-semibold">
                                            ₹{event.data.dailyCost}
                                          </span>
                                        </div>
                                        {event.data.reason && (
                                          <div>
                                            <span className="font-medium">
                                              Reason:
                                            </span>{" "}
                                            {event.data.reason}
                                          </div>
                                        )}
                                        {event.data.diagnosis && (
                                          <div>
                                            <span className="font-medium">
                                              Diagnosis:
                                            </span>{" "}
                                            {event.data.diagnosis}
                                          </div>
                                        )}
                                        {event.data.admitEventNotes && (
                                          <div>
                                            <span className="font-medium">
                                              Notes:
                                            </span>{" "}
                                            {event.data.admitEventNotes}
                                          </div>
                                        )}
                                        {event.data.initialDeposit > 0 && (
                                          <div>
                                            <span className="font-medium">
                                              Initial Deposit:
                                            </span>{" "}
                                            <span className="text-green-600 font-semibold">
                                              ₹{event.data.initialDeposit}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    );
                                    return admissionContent;
                                  case "admission_event":
                                    return (
                                      <div className="space-y-1">
                                        {event.data.eventType ===
                                          "room_change" && (
                                          <>
                                            {(() => {
                                              const notesText =
                                                event.data.notes || "";
                                              const fromMatch = notesText.match(
                                                /from\s+([^(]+)\s+\(([^)]+)\)/,
                                              );
                                              const toMatch = notesText.match(
                                                /to\s+([^(]+)\s+\(([^)]+)\)/,
                                              );

                                              return (
                                                <>
                                                  {fromMatch && (
                                                    <div>
                                                      <span className="font-medium">
                                                        Previous Room:
                                                      </span>{" "}
                                                      {fromMatch[2]} (
                                                      {fromMatch[1].trim()})
                                                    </div>
                                                  )}
                                                  {toMatch && (
                                                    <div>
                                                      <span className="font-medium">
                                                        New Room:
                                                      </span>{" "}
                                                      {toMatch[2]} (
                                                      {toMatch[1].trim()})
                                                    </div>
                                                  )}
                                                </>
                                              );
                                            })()}
                                          </>
                                        )}
                                        {event.data.eventType !==
                                          "room_change" &&
                                          event.data.notes && (
                                            <div>
                                              <span className="font-medium">
                                                Notes:
                                              </span>{" "}
                                              {event.data.notes}
                                            </div>
                                          )}
                                      </div>
                                    );
                                  case "discharge":
                                    return (
                                      <div className="space-y-1">
                                        <div>
                                          <span className="font-medium">
                                            Total Stay:
                                          </span>{" "}
                                          {calcStayDays(
                                            event.data.admissionDate,
                                            event.data.dischargeDate,
                                          )}{" "}
                                          days
                                        </div>
                                        <div>
                                          <span className="font-medium">
                                            Total Cost:
                                          </span>{" "}
                                          ₹{event.data.totalCost}
                                        </div>
                                      </div>
                                    );
                                  case "payment":
                                    return (
                                      <div className="space-y-1">
                                        <div>
                                          <span className="font-medium">
                                            Amount:
                                          </span>{" "}
                                          <span className="text-green-600 font-semibold">
                                            ₹{event.data.amount}
                                          </span>
                                        </div>
                                        <div>
                                          <span className="font-medium">
                                            Method:
                                          </span>{" "}
                                          {event.data.paymentMethod || "Cash"}
                                        </div>
                                        {event.data.reason && (
                                          <div>
                                            <span className="font-medium">
                                              Reason:
                                            </span>{" "}
                                            {event.data.reason}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  case "discount":
                                    return (
                                      <div className="space-y-1">
                                        <div>
                                          <span className="font-medium">
                                            Amount:
                                          </span>{" "}
                                          <span className="text-red-600 font-semibold">
                                            ₹{event.data.amount}
                                          </span>
                                        </div>
                                        <div>
                                          <span className="font-medium">
                                            Type:
                                          </span>{" "}
                                          {event.data.discountType || "Manual"}
                                        </div>
                                        {event.data.reason && (
                                          <div>
                                            <span className="font-medium">
                                              Reason:
                                            </span>{" "}
                                            {event.data.reason}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  case "refund":
                                    return (
                                      <div className="space-y-1">
                                        <div>
                                          <span className="font-medium">
                                            Refund Amount:
                                          </span>{" "}
                                          <span className="text-red-600 font-semibold">
                                            ₹{event.data.amount}
                                          </span>
                                        </div>
                                        {event.data.billableItemType && (
                                          <div>
                                            <span className="font-medium">
                                              For:
                                            </span>{" "}
                                            {event.data.billableItemType.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())} - {event.data.billableItemId}
                                          </div>
                                        )}
                                        {event.data.reason && (
                                          <div>
                                            <span className="font-medium">
                                              Reason:
                                            </span>{" "}
                                            {event.data.reason}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  default:
                                    return (
                                      <div>Event details not available</div>
                                    );
                                }
                              })()}
                            </div>

                            {/* Doctor information outside details section for admission events */}
                            {event.type === "admission" &&
                              (() => {
                                // Get doctor name from the admission
                                let doctorName = null;

                                // Try to get doctor ID from the event data
                                const doctorId = event.data.doctorId;

                                if (doctorId && doctors && doctors.length > 0) {
                                  const doctor = doctors.find(
                                    (d: Doctor) => d.id === doctorId,
                                  );
                                  if (doctor) {
                                    doctorName = doctor.name;
                                  }
                                }

                                return doctorName ? (
                                  <div className="mt-3 pt-2 border-t border-gray-200 text-sm text-gray-600">
                                    <span className="font-medium">Doctor:</span>{" "}
                                    {doctorName}
                                  </div>
                                ) : null;
                              })()}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Service Dialog */}
      <Dialog open={isServiceDialogOpen} onOpenChange={setIsServiceDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
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
            className="space-y-4"
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
                <Label>Patient *</Label>
                <Input
                  value={patient?.name || ""}
                  disabled
                  className="bg-muted"
                  data-testid="input-patient-name"
                />
              </div>

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
                      const selectedDoctor = doctors?.find(
                        (d: Doctor) => d.id === value,
                      );
                      console.log("Selected doctor:", selectedDoctor);
                    }

                    serviceForm.setValue("doctorId", value);

                    // Verify the form actually updated
                    setTimeout(() => {
                      const currentValue = serviceForm.getValues("doctorId");
                      console.log(
                        "Form doctorId after setValue:",
                        currentValue,
                      );
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
                <Label>Scheduled Date & Time *</Label>
                <input
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
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  data-testid="input-scheduled-datetime"
                />
                {serviceForm.formState.errors.scheduledDate && (
                  <p className="text-sm text-red-600">
                    {serviceForm.formState.errors.scheduledDate.message}
                  </p>
                )}
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
                  <Table
                    key={`service-table-${selectedServiceType}-${isServiceDialogOpen}`}
                  >
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
                                  {isSelected ? (
                                    <div className="flex flex-col gap-2 items-end">
                                      {service.price === 0 ? (
                                        <Input
                                          type="number"
                                          min="0"
                                          step="0.01"
                                          placeholder="Price (₹)"
                                          value={
                                            selectedServices.find(
                                              (s) => s.id === service.id,
                                            )?.price ?? ""
                                          }
                                          onChange={(e) => {
                                            const price =
                                              parseFloat(e.target.value) || 0;
                                            setSelectedServices(prev => 
                                              prev.map((s) =>
                                                s.id === service.id
                                                  ? { ...s, price }
                                                  : s,
                                              )
                                            );
                                          }}
                                          className="w-24 h-8"
                                          data-testid={`input-service-price-${service.id}`}
                                        />
                                      ) : (
                                        <span className="text-sm font-medium">₹{service.price}</span>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-end gap-2">
                                      {service.price === 0 ? (
                                        <Badge variant="secondary">Variable</Badge>
                                      ) : (
                                        `₹${service.price}`
                                      )}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  {isSelected ? (
                                    <div className="flex flex-col gap-2 items-end">
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
                                          )?.quantity ?? 1
                                        }
                                        onChange={(e) => {
                                          const quantity =
                                            parseFloat(e.target.value) || 1;
                                          
                                          setSelectedServices(prev =>
                                            prev.map((s) =>
                                              s.id === service.id
                                                ? { ...s, quantity }
                                                : s,
                                            )
                                          );
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

                {/* Multi-Custom Services Section */}
                <div className="space-y-4 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Custom Services</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setCustomServices((prev) => [
                          ...prev,
                          {
                            id: Math.random().toString(36).substring(7),
                            name: "",
                            price: 0,
                            quantity: 1,
                          },
                        ]);
                      }}
                      data-testid="button-add-custom-service"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Custom Service
                    </Button>
                  </div>

                  {customServices.length > 0 && (
                    <div className="space-y-3">
                      {customServices.map((cs, index) => (
                        <div key={cs.id} className="grid grid-cols-12 gap-2 items-end bg-gray-50 p-2 rounded-md">
                          <div className="col-span-6 space-y-1">
                            <Label className="text-xs">Service Name</Label>
                            <Input
                              placeholder="Name"
                              value={cs.name}
                              onChange={(e) => {
                                setCustomServices((prev) =>
                                  prev.map((item) =>
                                    item.id === cs.id
                                      ? { ...item, name: e.target.value }
                                      : item,
                                  ),
                                );
                              }}
                              className="h-8"
                            />
                          </div>
                          <div className="col-span-3 space-y-1">
                            <Label className="text-xs">Price (₹)</Label>
                            <Input
                              type="number"
                              placeholder="0"
                              value={cs.price || ""}
                              onChange={(e) => {
                                setCustomServices((prev) =>
                                  prev.map((item) =>
                                    item.id === cs.id
                                      ? { ...item, price: parseFloat(e.target.value) || 0 }
                                      : item,
                                  ),
                                );
                              }}
                              className="h-8"
                            />
                          </div>
                          <div className="col-span-2 space-y-1">
                            <Label className="text-xs">Qty</Label>
                            <Input
                              type="number"
                              min="1"
                              value={cs.quantity}
                              onChange={(e) => {
                                setCustomServices((prev) =>
                                  prev.map((item) =>
                                    item.id === cs.id
                                      ? { ...item, quantity: parseInt(e.target.value) || 1 }
                                      : item,
                                  ),
                                );
                              }}
                              className="h-8"
                            />
                          </div>
                          <div className="col-span-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setCustomServices((prev) =>
                                  prev.filter((item) => item.id !== cs.id),
                                );
                              }}
                              className="h-8 w-8 text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
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

                {/* Services Summary */}
                {(selectedServices.length > 0 || customServices.length > 0) && (
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
                      {customServices.map((service) => (
                        <div
                          key={service.id}
                          className="flex justify-between items-center text-sm"
                        >
                          <span className="font-medium">{service.name || "Unnamed Service"}</span>
                          <span>
                            ₹{(service.price * service.quantity).toLocaleString()}
                          </span>
                        </div>
                      ))}
                      <div className="border-t pt-2 mt-2 flex justify-between items-center font-semibold">
                        <span>Total ({selectedServices.length + customServices.length} services)</span>
                        <span>
                          ₹
                          {(
                            selectedServices.reduce(
                              (total, service) =>
                                total + service.price * (service.quantity || 1),
                              0,
                            ) +
                            customServices.reduce(
                              (total, service) =>
                                total + service.price * service.quantity,
                              0,
                            )
                          ).toLocaleString()}
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
              customServices.length === 0 && (
                <div
                  className="bg-amber-50 border border-amber-200 rounded-lg p-3"
                  data-testid="text-service-submit-help"
                >
                  <div className="flex items-center gap-2 text-amber-800">
                    <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                    <span className="text-sm font-medium">
                      To schedule services, please select services from the catalog above by checking the boxes or add custom services below.
                    </span>
                  </div>
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
                  setSelectedServices([]); // Clear selected services
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
                    : selectedServices.length + customServices.length > 0
                      ? `Schedule ${selectedServices.length + customServices.length} Service(s)`
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Admit Patient</DialogTitle>
          </DialogHeader>

          <Form {...admissionForm}>
            <form
              onSubmit={admissionForm.handleSubmit(onAdmissionSubmit)}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Patient *</Label>
                  <Input
                    value={patient?.name || ""}
                    readOnly
                    className="bg-gray-50 dark:bg-gray-800"
                    data-testid="input-admission-patient"
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
                      {doctors.map((doctor: Doctor) => (
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
                    {...admissionForm.register("admissionDate")}
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
                        const updatedServices = selectedServices.map(
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
                        setSelectedServices(updatedServices);

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
                                admission.currentWardType ===
                                  selectedWardType &&
                                admission.status === "admitted",
                            )
                            .map(
                              (admission: any) => admission.currentRoomNumber,
                            ),
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
                    {...admissionForm.register("dailyCost", {
                      valueAsNumber: true,
                    })}
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
                    {...admissionForm.register("initialDeposit", {
                      valueAsNumber: true,
                    })}
                    placeholder="Initial deposit amount"
                    data-testid="input-initial-deposit"
                  />
                </div>
              </div>

              {/* Admission Services Selection */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-lg font-semibold">
                    Select Admission Services
                  </Label>
                  <div className="flex items-center space-x-2">
                    <Input
                      placeholder="Search admission services..."
                      value={selectedServiceSearchQuery}
                      onChange={(e) => {
                        setSelectedServiceSearchQuery(e.target.value);
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
                        // Filter admission services
                        const admissionServices =
                          allServices?.filter(
                            (service) =>
                              service.category === "admissions" &&
                              service.isActive,
                          ) || [];

                        // Apply search filter
                        const filteredServices =
                          selectedServiceSearchQuery.trim()
                            ? admissionServices.filter(
                                (service) =>
                                  service.name
                                    .toLowerCase()
                                    .includes(
                                      selectedServiceSearchQuery.toLowerCase(),
                                    ) ||
                                  (service.description &&
                                    service.description
                                      .toLowerCase()
                                      .includes(
                                        selectedServiceSearchQuery.toLowerCase(),
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
                                {selectedServiceSearchQuery
                                  ? "Try adjusting your search."
                                  : "Create admission services in the Services page first."}
                              </TableCell>
                            </TableRow>
                          );
                        }

                        return filteredServices.map((service) => {
                          const isSelected = selectedServices.some(
                            (s) => s.id === service.id,
                          );
                          const selectedService = selectedServices.find(
                            (s) => s.id === service.id,
                          );

                          // For Bed Charges service, show the room type price if available
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
                                      // Get current room type for Bed Charges pricing
                                      const currentWardType =
                                        admissionForm.watch("currentWardType");
                                      const selectedRoomType = roomTypes.find(
                                        (rt: any) =>
                                          rt.name === currentWardType,
                                      );

                                      let serviceToAdd = {
                                        ...service,
                                        quantity: 1,
                                      };

                                      // If this is Bed Charges and we have a room type selected, use room type price
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
                                        ...selectedServices,
                                        serviceToAdd,
                                      ];
                                    } else {
                                      updatedServices = selectedServices.filter(
                                        (s) => s.id !== service.id,
                                      );
                                    }

                                    setSelectedServices(updatedServices);

                                    // Recalculate total daily cost from all selected services
                                    const totalServicesCost =
                                      updatedServices.reduce(
                                        (total, selectedService) => {
                                          return (
                                            total + (selectedService.price || 0)
                                          );
                                        },
                                        0,
                                      );

                                    // Update the daily cost field
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

                {/* Selected Services Summary */}
                {selectedServices.length > 0 && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium mb-3">
                      Selected Admission Services
                    </h4>
                    <div className="space-y-2">
                      {selectedServices.map((service) => (
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
                          {selectedServices.reduce(
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
                  {...admissionForm.register("reason")}
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
                    setSelectedServices([]); // Clear selected services
                    setSelectedServiceSearchQuery(""); // Clear search
                  }}
                  data-testid="button-cancel-admission"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isCreatingAdmission}
                  data-testid="button-admit"
                >
                  {isCreatingAdmission ? "Admitting..." : "Admit Patient"}
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
                // Format admission date with time using timezone adjustment
                const formatAdmissionDateTime = (dateStr: string) => {
                  if (!dateStr) return "N/A";

                  let displayDate;

                  // Handle datetime-local format: "YYYY-MM-DDTHH:MM"
                  if (dateStr.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)) {
                    const parts = dateStr.split("T");
                    const dateParts = parts[0].split("-");
                    const timeParts = parts[1].split(":");

                    displayDate = new Date(
                      parseInt(dateParts[0]), // year
                      parseInt(dateParts[1]) - 1, // month (0-indexed)
                      parseInt(dateParts[2]), // day
                      parseInt(timeParts[0]), // hour
                      parseInt(timeParts[1]), // minute
                    );
                  }
                  // Handle SQLite datetime format: "YYYY-MM-DD HH:MM:SS"
                  else if (
                    dateStr.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
                  ) {
                    const parts = dateStr.split(" ");
                    const dateParts = parts[0].split("-");
                    const timeParts = parts[1].split(":");

                    displayDate = new Date(
                      parseInt(dateParts[0]), // year
                      parseInt(dateParts[1]) - 1, // month (0-indexed)
                      parseInt(dateParts[2]), // day
                      parseInt(timeParts[0]), // hour
                      parseInt(timeParts[1]), // minute
                      parseInt(timeParts[2]), // second
                    );
                  }
                  // Handle date only format: "YYYY-MM-DD"
                  else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    const dateParts = dateStr.split("-");
                    displayDate = new Date(
                      parseInt(dateParts[0]), // year
                      parseInt(dateParts[1]) - 1, // month (0-indexed)
                      parseInt(dateParts[2]), // day
                    );
                  }
                  // Fallback for other formats
                  else {
                    displayDate = new Date(dateStr);
                  }

                  // Check if date is valid
                  if (isNaN(displayDate.getTime())) return "N/A";

                  // Get timezone from system settings
                  const timezone = systemSettings?.timezone || "UTC";

                  // Return formatted date with time using configured timezone
                  return new Intl.DateTimeFormat("en-US", {
                    timeZone: timezone,
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true,
                  }).format(displayDate);
                };

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
                      <strong>Admission Date & Time:</strong>{" "}
                      {(() => {
                        // Get admission events for the current admission
                        const admitEvents =
                          admissionEventsMap?.[currentAdmission.id] || [];
                        const admitEvent = admitEvents?.find(
                          (e: any) => e.eventType === "admit",
                        );
                        return formatDateTime(
                          admitEvent?.eventTime ||
                            currentAdmission.admissionDate,
                        );
                      })()}
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
        <DialogContent data-testid="dialog-add-payment">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>

          <div className="py-4">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="paymentAmount">Payment Amount *</Label>
                  <Input
                    id="paymentAmount"
                    type="number"
                    step="0.01"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="Enter amount"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paymentMethod">Payment Method</Label>
                  <Select
                    value={paymentMethod}
                    onValueChange={setPaymentMethod}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="upi">UPI</SelectItem>
                      <SelectItem value="bank_transfer">
                        Bank Transfer
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="billableItem">Billable Item *</Label>
                <Select
                  value={selectedBillableItem}
                  onValueChange={(value) => {
                    setSelectedBillableItem(value);
                    // Auto-populate pending amount (not full amount) from selected billable item
                    if (value && value !== "none") {
                      const selectedItem = billableItems?.find(
                        (item: any) => item.value === value,
                      );
                      if (selectedItem && selectedItem.pendingAmount !== undefined) {
                        setPaymentAmount(selectedItem.pendingAmount.toString());
                      } else if (selectedItem && selectedItem.amount) {
                        // Fallback to full amount if pendingAmount not available
                        setPaymentAmount(selectedItem.amount.toString());
                      }
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select billable item *" />
                  </SelectTrigger>
                  <SelectContent>
                    {billableItems && billableItems.length > 0 ? (
                      billableItems.map((item: any) => (
                        <SelectItem
                          key={item.id}
                          value={item.value}
                          disabled={item.isFullyPaid}
                          className={
                            item.isFullyPaid ? "opacity-50 text-gray-400" : ""
                          }
                        >
                          {formatBillableItemLabel(item)}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>
                        No billable items available
                      </SelectItem>
                    )}
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
                if (!selectedBillableItem || selectedBillableItem === "none") {
                  toast({
                    title: "Missing Selection",
                    description: "Please select a billable item",
                    variant: "destructive",
                  });
                  return;
                }

                if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
                  toast({
                    title: "Invalid Amount",
                    description: "Please enter a valid payment amount",
                    variant: "destructive",
                  });
                  return;
                }

                // Validate payment doesn't exceed pending amount
                const selectedItem = billableItems?.find(
                  (item: any) => item.value === selectedBillableItem,
                );
                if (selectedItem) {
                  const pendingAmount = selectedItem.pendingAmount ?? selectedItem.amount;
                  if (parseFloat(paymentAmount) > pendingAmount) {
                    toast({
                      title: "Amount Exceeds Pending",
                      description: `Payment cannot exceed pending amount of Rs.${pendingAmount.toFixed(2)}`,
                      variant: "destructive",
                    });
                    return;
                  }
                }

                // Format reason based on selected billable item
                let reason = "Payment";
                if (selectedItem) {
                  reason = formatBillableItemLabel(selectedItem);
                }

                addPaymentMutation.mutate({
                  amount: parseFloat(paymentAmount),
                  paymentMethod: paymentMethod,
                  reason: reason,
                });
              }}
              disabled={
                addPaymentMutation.isPending ||
                !selectedBillableItem ||
                selectedBillableItem === "none" ||
                !paymentAmount ||
                parseFloat(paymentAmount) <= 0
              }
              className="bg-green-600 hover:bg-green-700 text-white"
              data-testid="button-confirm-payment"
            >
              {addPaymentMutation.isPending ? "Processing..." : "Record"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Refund Dialog */}
      <Dialog open={isRefundDialogOpen} onOpenChange={setIsRefundDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process Refund</DialogTitle>
          </DialogHeader>

          <div className="py-4">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="refundAmount">Refund Amount *</Label>
                  <Input
                    id="refundAmount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    placeholder="Enter amount"
                    data-testid="input-refund-amount"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="refundMethod">Refund Method</Label>
                  <Select value={refundMethod} onValueChange={setRefundMethod}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select refund method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="upi">UPI</SelectItem>
                      <SelectItem value="bank_transfer">
                        Bank Transfer
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="refundReason">Reason</Label>
                <Input
                  id="refundReason"
                  type="text"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="Enter refund reason (optional)"
                  data-testid="input-refund-reason"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="refundBillableItem">Billable Item *</Label>
                <Select
                  value={selectedRefundBillableItem}
                  onValueChange={(value) => {
                    setSelectedRefundBillableItem(value);
                    // Auto-populate with maxRefundable (net paid amount available for refund)
                    if (value && value !== "none") {
                      const selectedItem = billableItems?.find(
                        (item: any) => item.value === value,
                      );
                      if (selectedItem && selectedItem.maxRefundable > 0) {
                        setRefundAmount(selectedItem.maxRefundable.toString());
                      } else if (selectedItem && selectedItem.netPaidAmount > 0) {
                        setRefundAmount(selectedItem.netPaidAmount.toString());
                      }
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select billable item *" />
                  </SelectTrigger>
                  <SelectContent>
                    {billableItems && billableItems.length > 0 ? (
                      billableItems
                        .filter((item: any) => !item.isFullyRefunded && (item.maxRefundable > 0 || item.netPaidAmount > 0))
                        .map((item: any) => (
                        <SelectItem
                          key={item.id}
                          value={item.value}
                        >
                          {formatBillableItemLabel(item)} (Rs.{item.maxRefundable || item.netPaidAmount || 0} refundable)
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>
                        No refundable billable items available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsRefundDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (
                  !selectedRefundBillableItem ||
                  selectedRefundBillableItem === "none"
                ) {
                  toast({
                    title: "Missing Selection",
                    description: "Please select a billable item",
                    variant: "destructive",
                  });
                  return;
                }

                const amount = parseFloat(refundAmount);
                const selectedItem = billableItems?.find(
                  (item: any) => item.value === selectedRefundBillableItem,
                );
                const maxRefundable = selectedItem?.maxRefundable || selectedItem?.netPaidAmount || 0;

                if (amount <= 0) {
                  toast({
                    title: "Error",
                    description: "Please enter a valid refund amount.",
                    variant: "destructive",
                  });
                  return;
                }

                if (amount > maxRefundable) {
                  toast({
                    title: "Error",
                    description: `Refund cannot exceed Rs.${maxRefundable} (paid amount).`,
                    variant: "destructive",
                  });
                  return;
                }

                addRefundMutation.mutate({
                  amount: amount,
                  reason: refundReason || "Manual refund",
                  billableItemType: selectedItem?.type || "",
                  billableItemId: selectedItem?.id || "",
                });
              }}
              disabled={
                addRefundMutation.isPending ||
                !selectedRefundBillableItem ||
                selectedRefundBillableItem === "none" ||
                !refundAmount ||
                parseFloat(refundAmount) <= 0
              }
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {addRefundMutation.isPending ? "Processing..." : "Refund"}
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="discountAmount">Discount Amount *</Label>
                  <Input
                    id="discountAmount"
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
                  <Label htmlFor="discountReason">Reason for Discount</Label>
                  <Input
                    id="discountReason"
                    type="text"
                    value={discountReason}
                    onChange={(e) => setDiscountReason(e.target.value)}
                    placeholder="Enter reason (optional)"
                    data-testid="input-discount-reason"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="discountBillableItem">Billable Item *</Label>
                <Select
                  value={selectedDiscountBillableItem}
                  onValueChange={setSelectedDiscountBillableItem}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select billable item *" />
                  </SelectTrigger>
                  <SelectContent>
                    {billableItems && billableItems.length > 0 ? (
                      billableItems.map((item: any) => (
                        <SelectItem
                          key={item.id}
                          value={item.value}
                          disabled={item.isFullyPaid}
                          className={
                            item.isFullyPaid ? "opacity-50 text-gray-400" : ""
                          }
                        >
                          {formatBillableItemLabel(item)}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>
                        No billable items available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
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
                if (
                  !selectedDiscountBillableItem ||
                  selectedDiscountBillableItem === "none"
                ) {
                  toast({
                    title: "Missing Selection",
                    description: "Please select a billable item",
                    variant: "destructive",
                  });
                  return;
                }

                const amount = parseFloat(discountAmount);

                // Find the selected billable item to get its type and validate amount
                const selectedItem = billableItems?.find(
                  (item: any) => item.value === selectedDiscountBillableItem,
                );

                if (amount > 0) {
                  // Use backend-provided maxDiscountable (amount - existing discounts)
                  const maxDiscountable = selectedItem?.maxDiscountable ?? 0;
                  
                  if (amount > maxDiscountable) {
                    toast({
                      title: "Discount Too High",
                      description: `Maximum discountable amount is Rs.${maxDiscountable.toFixed(2)}`,
                      variant: "destructive",
                    });
                    return;
                  }
                  
                  addDiscountMutation.mutate({
                    amount: amount,
                    reason: discountReason.trim() || "Manual discount",
                    discountType: "manual",
                    billableItemType: selectedItem?.type,
                    billableItemId: selectedDiscountBillableItem,
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
                !selectedDiscountBillableItem ||
                selectedDiscountBillableItem === "none" ||
                !discountAmount ||
                parseFloat(discountAmount) <= 0
              }
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              {addDiscountMutation.isPending ? "Applying..." : "Apply"}
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
      <Dialog
        open={isOpdVisitDialogOpen}
        onOpenChange={setIsOpdVisitDialogOpen}
      >
        <DialogContent className="max-w-2xl">
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
                  consultationFee: consultationFee,
                  amount: consultationFee, // Also store as amount for consistent access
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
                          const selectedDoctor = doctors?.find(
                            (d: Doctor) => d.id === value,
                          );
                          if (selectedDoctor) {
                            opdVisitForm.setValue(
                              "consultationFee",
                              selectedDoctor.consultationFee,
                            );
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
                        const defaultFee = selectedDoctor
                          ? selectedDoctor.consultationFee
                          : 0;
                        const currentFee =
                          opdVisitForm.watch("consultationFee");

                        // Set default fee when doctor changes, but only if the field hasn't been manually edited
                        React.useEffect(() => {
                          if (
                            selectedDoctor &&
                            (currentFee === undefined || currentFee === 0)
                          ) {
                            opdVisitForm.setValue(
                              "consultationFee",
                              defaultFee,
                            );
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
                                  opdVisitForm.setValue(
                                    "consultationFee",
                                    undefined,
                                  );
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
