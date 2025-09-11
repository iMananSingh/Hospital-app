import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import TopBar from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  DollarSign
} from "lucide-react";
import { insertPatientServiceSchema, insertAdmissionSchema } from "@shared/schema";
import { z } from "zod";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ReceiptTemplate } from "@/components/receipt-template";
import SmartBillingDialog from "@/components/smart-billing-dialog";
import type { Patient, PatientService, Admission, AdmissionEvent, Doctor } from "@shared/schema";
import { Checkbox } from "@/components/ui/checkbox";

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
  const [isSmartBillingDialogOpen, setIsSmartBillingDialogOpen] = useState(false);
  const [isAdmissionDialogOpen, setIsAdmissionDialogOpen] = useState(false);
  const [isDischargeDialogOpen, setIsDischargeDialogOpen] = useState(false);
  const [isRoomUpdateDialogOpen, setIsRoomUpdateDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [selectedAdmissionForPayment, setSelectedAdmissionForPayment] = useState("");
  const [selectedServiceType, setSelectedServiceType] = useState("");
  const [selectedServiceCategory, setSelectedServiceCategory] = useState("");
  const [selectedServices, setSelectedServices] = useState<Service[]>([]); // Use Service interface
  const [isDiscountDialogOpen, setIsDiscountDialogOpen] = useState(false);
  const [discountAmount, setDiscountAmount] = useState("");
  const [discountReason, setDiscountReason] = useState("");
  const [serviceSearchQuery, setServiceSearchQuery] = useState("");
  const [dischargeDateTime, setDischargeDateTime] = useState("");

  // Fetch hospital settings for receipts
  const { data: hospitalSettings } = useQuery({
    queryKey: ["/api/settings/hospital"],
    queryFn: async () => {
      const response = await fetch("/api/settings/hospital", {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch hospital settings");
      return response.json();
    },
  });

  // Hospital info for receipts
  const hospitalInfo = {
    name: hospitalSettings?.name || "MedCare Pro Hospital",
    address: hospitalSettings?.address || "123 Healthcare Street, Medical District, City - 123456",
    phone: hospitalSettings?.phone || "+91 98765 43210",
    email: hospitalSettings?.email || "info@medcarepro.com",
    registrationNumber: hospitalSettings?.registrationNumber || "",
    logo: hospitalSettings?.logoPath || undefined
  };

  // Helper function to determine service type for receipt numbering
  const getServiceType = (eventType: string, event: any) => {
    switch (eventType) {
      case 'service':
        // Check if it's OPD service
        if (event.serviceType === 'opd' || event.serviceName === 'OPD Consultation') {
          return 'opd';
        }
        // Check specific service categories
        const category = event.category?.toLowerCase();
        if (category === 'discharge' || event.description?.toLowerCase().includes('discharge')) {
          return 'discharge';
        }
        if (category === 'room_transfer' || event.description?.toLowerCase().includes('transfer')) {
          return 'room_transfer';
        }
        return 'service';
      case 'pathology':
        return 'pathology';
      case 'admission':
        return 'admission';
      case 'payment':
        return 'payment';
      case 'discount':
        return 'discount';
      default:
        return eventType;
    }
  };

  // Helper function to get daily count for receipt numbering from API
  const getDailyCountFromAPI = async (eventType: string, eventDate: string, currentEvent: any): Promise<number> => {
    try {
      const serviceType = getServiceType(eventType, currentEvent);
      const response = await fetch(`/api/receipts/daily-count/${serviceType}/${eventDate}`, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
        },
      });

      if (!response.ok) {
        console.error('Failed to get daily count from API');
        return 1;
      }

      const data = await response.json();
      return data.count;
    } catch (error) {
      console.error('Error fetching daily count:', error);
      return 1;
    }
  };



  const generateReceiptData = (event: any, eventType: string) => {
    // Helper function to get receipt number from different sources
    const getReceiptNumber = () => {
      // For services, always use the stored receiptNumber
      if (eventType === 'service' && event.receiptNumber) {
        return event.receiptNumber;
      }

      // For pathology, try to get from order data
      if (eventType === 'pathology') {
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
      if (eventType === 'admission_event') {
        if (event.rawData?.event?.receiptNumber) {
          return event.rawData.event.receiptNumber;
        }
        if (event.receiptNumber) {
          return event.receiptNumber;
        }
      }

      // For admission fallback, try to get from admission data
      if (eventType === 'admission') {
        if (event.rawData?.admission?.receiptNumber) {
          return event.rawData.admission.receiptNumber;
        }
        if (event.receiptNumber) {
          return event.receiptNumber;
        }
      }

      // For other event types, try direct access
      if (event.receiptNumber) {
        return event.receiptNumber;
      }

      return 'RECEIPT-NOT-FOUND';
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
      if (eventType === 'pathology' && event.rawData?.order?.doctorId) {
        const doctor = doctors.find((d: Doctor) => d.id === event.rawData.order.doctorId);
        if (doctor) {
          return doctor.name;
        }
      }

      // Try to get from rawData for admission events
      if (eventType === 'admission_event' && event.rawData?.event?.doctorId) {
        const doctor = doctors.find((d: Doctor) => d.id === event.rawData.event.doctorId);
        if (doctor) {
          return doctor.name;
        }
      }

      // Try to get from rawData for admission fallback
      if (eventType === 'admission' && event.rawData?.admission?.doctorId) {
        const doctor = doctors.find((d: Doctor) => d.id === event.rawData.admission.doctorId);
        if (doctor) {
          return doctor.name;
        }
      }

      return 'No Doctor Assigned';
    };

    // Base receipt data structure
    const baseReceiptData = {
      type: eventType as 'service' | 'pathology' | 'admission' | 'payment' | 'discount',
      id: event.id,
      title: event.title || event.serviceName || event.testName || event.description || 'Service',
      date: event.sortTimestamp,
      amount: event.amount || event.price || event.totalPrice || 0,
      description: event.description || event.serviceName || event.testName || '',
      patientName: patient?.name || 'Unknown Patient',
      patientId: patient?.patientId || 'Unknown ID',
      details: {
        ...event,
        patientAge: patient?.age,
        patientGender: patient?.gender,
        doctorName: getDoctorName(),
        receiptNumber: getReceiptNumber()
      }
    };

    return baseReceiptData;
  };

  // Fetch patient details
  const { data: patient } = useQuery<Patient>({
    queryKey: ["/api/patients", patientId],
    queryFn: async () => {
      const response = await fetch(`/api/patients/${patientId}`, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
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
      const response = await fetch(`/api/patient-services?patientId=${patientId}`, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch patient services");
      return response.json();
    },
  });

  // Fetch all services for service selection
  const { data: allServices } = useQuery<Service[]>({ // Use Service interface
    queryKey: ["/api/services"],
    queryFn: async () => {
      const response = await fetch("/api/services", {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
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
          "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
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
          "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
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
      const response = await fetch(`/api/patients/${patientId}/financial-summary`, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
        },
      });
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
              const response = await fetch(`/api/admissions/${admission.id}/events`, {
                headers: {
                  "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
                },
              });
              if (response.ok) {
                const events = await response.json();
                eventsMap[admission.id] = events;
              }
            } catch (error) {
              console.error(`Failed to fetch events for admission ${admission.id}:`, error);
            }
          })
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
    defaultValues: {
      patientId: patientId || "",
      serviceType: "",
      serviceName: "",
      scheduledDate: new Date().toISOString().split('T')[0], // Today's date in YYYY-MM-DD format
      scheduledTime: "", // Will be set dynamically when dialog opens
      doctorId: "",
      notes: "",
      price: 0, // This price field is intended for form submission logic, not direct user input in the table
    },
  });

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
      const serviceType = getServiceType('service', data);
      const eventDate = new Date(data.scheduledDate).toISOString().split('T')[0];
      const count = await getDailyCountFromAPI('service', eventDate, data);

      // Format: YYMMDD-TYPE-NNNN (correct format)
      const dateObj = new Date(eventDate);
      const yymmdd = dateObj.toISOString().slice(2, 10).replace(/-/g, '').slice(0, 6);

      let typeCode = '';
      if (serviceType === 'opd') {
        typeCode = 'OPD';
      } else {
        typeCode = 'SER';
      }

      const receiptNumber = `${yymmdd}-${typeCode}-${String(count).padStart(4, '0')}`;

      const serviceDataWithReceipt = {
        ...data,
        receiptNumber: receiptNumber,
      };

      const response = await fetch("/api/patient-services", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
        },
        body: JSON.stringify(serviceDataWithReceipt),
      });
      if (!response.ok) throw new Error("Failed to create service");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-services", patientId] });
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId] });
      setIsServiceDialogOpen(false);
      setSelectedServiceType("");
      setSelectedServiceCategory("");
      serviceForm.reset({
        patientId: patientId || "",
        serviceType: "",
        serviceName: "",
        scheduledDate: "",
        scheduledTime: "",
        doctorId: "",
        notes: "",
        price: 0,
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

  const createAdmissionMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/admissions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create admission");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admissions", patientId] });
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
      if (selectedServiceType === "opd") {
        // Handle OPD consultation
        const selectedDoctorId = data.doctorId;
        const selectedDoctor = doctors.find((d: Doctor) => d.id === selectedDoctorId);
        const consultationFee = selectedDoctorId && selectedDoctorId !== "none" && selectedDoctor ? selectedDoctor.consultationFee : 0;

        const serviceData = {
          patientId: patient.id,
          serviceId: "opd-consultation",
          serviceName: "OPD Consultation",
          serviceType: "opd",
          category: "consultation",
          price: consultationFee,
          scheduledDate: data.scheduledDate,
          scheduledTime: data.scheduledTime,
          doctorId: selectedDoctorId !== "none" ? selectedDoctorId : null,
          notes: data.notes,
          status: "scheduled",
        };

        const response = await fetch("/api/patient-services", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
          },
          body: JSON.stringify(serviceData),
        });

        if (response.ok) {
          toast({
            title: "Success",
            description: "OPD consultation scheduled successfully",
          });
          queryClient.invalidateQueries({ queryKey: ["/api/patient-services"] });
          setIsServiceDialogOpen(false);
          serviceForm.reset();
          setSelectedServiceType("");
          setSelectedServices([]);
        } else {
          throw new Error("Failed to schedule OPD consultation");
        }
      } else {
        // Handle multiple services
        if (selectedServices.length === 0) {
          toast({
            title: "Error",
            description: "Please select at least one service",
            variant: "destructive",
          });
          return;
        }

        // Schedule all selected services
        const serviceData = selectedServices.map(service => {
          const quantity = service.quantity || 1;
          const unitPrice = service.price || parseFloat(data.customPrice as string) || 0;
          const calculatedAmount = unitPrice * quantity;

          return {
            patientId: patient.id,
            serviceId: service.id,
            serviceName: service.name,
            serviceType: selectedServiceType,
            price: unitPrice,
            billingType: service.billingType || "per_instance",
            billingQuantity: quantity,
            billingParameters: service.billingType === "per_hour" ? 
              JSON.stringify({ hours: quantity }) : 
              service.billingType === "per_24_hours" ? 
              JSON.stringify({ days: quantity }) : null,
            calculatedAmount: calculatedAmount,
            scheduledDate: data.scheduledDate,
            scheduledTime: data.scheduledTime,
            doctorId: data.doctorId || null,
            notes: data.notes,
            status: "scheduled",
          };
        });

        const responses = await Promise.all(
          serviceData.map(srvc => fetch("/api/patient-services", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
              },
              body: JSON.stringify(srvc),
            })
          )
        );

        const failedRequests = responses.filter(response => !response.ok);

        if (failedRequests.length === 0) {
          toast({
            title: "Success",
            description: `${selectedServices.length} service(s) scheduled successfully`,
          });
          queryClient.invalidateQueries({ queryKey: ["/api/patient-services"] });
          setIsServiceDialogOpen(false);
          serviceForm.reset();
          setSelectedServiceType("");
          setSelectedServices([]);
        } else {
          throw new Error(`Failed to schedule ${failedRequests.length} service(s)`);
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to schedule service",
        variant: "destructive",
      });
    }
  };

  const onAdmissionSubmit = (data: any) => {
    // Validate required fields (reason is now optional)
    const requiredFields = ['doctorId', 'currentWardType', 'admissionDate', 'dailyCost'];
    const missingFields = requiredFields.filter(field => !data[field] || data[field] === '');

    if (missingFields.length > 0) {
      toast({
        title: "Missing Required Fields",
        description: `Please fill in all required fields: ${missingFields.join(', ')}`,
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
    mutationFn: async (data: { currentAdmissionId: string; dischargeDateTime: string }) => {
      const response = await fetch(`/api/admissions/${data.currentAdmissionId}/discharge`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
        },
        body: JSON.stringify({ dischargeDateTime: data.dischargeDateTime }),
      });

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
        description: "The patient has been discharged and the event has been recorded.",
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
      const currentAdmission = admissions?.find((adm: any) => adm.status === 'admitted');
      if (!currentAdmission) throw new Error("No active admission found");

      const response = await fetch(`/api/admissions/${currentAdmission.id}/transfer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
        },
        body: JSON.stringify({
          roomNumber: data.roomNumber,
          wardType: data.wardType,
        }),
      });

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
    mutationFn: async (data: { amount: number, paymentMethod: string, reason?: string }) => {
      const response = await fetch(`/api/patients/${patientId}/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
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
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId, "financial-summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId, "payments"] });
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
    mutationFn: async (data: { amount: number, reason: string, discountType?: string }) => {
      const response = await fetch(`/api/patients/${patientId}/discounts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
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
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId, "financial-summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId, "discounts"] });
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
    const currentAdmission = admissions?.find((adm: any) => adm.status === 'admitted');
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
      dischargeDateTime 
    });
  };

  const onRoomUpdate = (data: any) => {
    // Validate required fields
    const requiredFields = ['wardType', 'roomNumber'];
    const missingFields = requiredFields.filter(field => !data[field] || data[field] === '');

    if (missingFields.length > 0) {
      toast({
        title: "Missing Required Fields",
        description: `Please fill in all required fields: ${missingFields.join(', ')}`,
        variant: "destructive",
      });
      return;
    }

    updateRoomMutation.mutate(data);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in-progress':
        return 'bg-blue-100 text-blue-800';
      case 'scheduled':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";

    // Handle datetime-local format: "YYYY-MM-DDTHH:MM"
    if (dateString.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)) {
      const parts = dateString.split('T');
      const dateParts = parts[0].split('-');
      const timeParts = parts[1].split(':');

      // Create date object in local timezone
      const localDate = new Date(
        parseInt(dateParts[0]), // year
        parseInt(dateParts[1]) - 1, // month (0-indexed)
        parseInt(dateParts[2]), // day
        parseInt(timeParts[0]), // hour
        parseInt(timeParts[1]) // minute
      );

      // Check if date is valid
      if (isNaN(localDate.getTime())) return "N/A";

      return localDate.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
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
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    });
  };

  // Service categories mapping (matching service management)
  const serviceCategories = [
    { key: 'diagnostics', label: 'Diagnostic Services', icon: Heart },
    { key: 'procedures', label: 'Medical Procedures', icon: Stethoscope },
    { key: 'operations', label: 'Surgical Operations', icon: X },
    { key: 'misc', label: 'Miscellaneous Services', icon: Settings }
  ];

  // Filter services by category and search query
  const getFilteredServices = (category: string) => {
    if (!allServices) return [];

    let filtered = allServices.filter(s => s.isActive);

    // Filter by category
    if (category && category !== "all") {
      filtered = filtered.filter(s => s.category === category);
    }

    // Filter by search query
    if (serviceSearchQuery.trim()) {
      filtered = filtered.filter(s => 
        s.name.toLowerCase().includes(serviceSearchQuery.toLowerCase()) ||
        (s.description && s.description.toLowerCase().includes(serviceSearchQuery.toLowerCase()))
      );
    }

    return filtered;
  };

  // Map service categories to valid database service types
  const mapCategoryToServiceType = (category: string) => {
    switch (category) {
      case 'diagnostics':
        return 'diagnostic';
      case 'procedures':
        return 'procedure';
      case 'operations':
        return 'operation';
      case 'consultation':
        return 'opd';
      case 'misc':
        return 'service';
      default:
        return 'service';
    }
  };

  const openServiceDialog = (serviceType: string) => {
    setSelectedServiceType(serviceType);
    setSelectedServices([]);
    setSelectedServiceCategory("");
    setIsServiceDialogOpen(true);

    // Set the current time as default
    const now = new Date();
    const timeString = now.toTimeString().slice(0, 5); // HH:MM format
    serviceForm.setValue("scheduledTime", timeString);
  };


  if (!patient) {
    return <div className="flex items-center justify-center h-64">Loading patient details...</div>;
  }

  return (
    <div className="space-y-6">
      <TopBar 
        title={`Patient: ${patient.name}`}
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
                <p className="text-sm text-muted-foreground">Emergency Contact</p>
                <p className="font-medium">{patient.emergencyContact || "N/A"}</p>
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
                    const currentAdmission = admissions?.find((adm: any) => adm.status === 'admitted');
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
                  console.log("=== SCHEDULE OPD CLICKED ===");

                  // Set current LOCAL date and time when opening the dialog
                  const now = new Date();
                  const currentDate = now.getFullYear() + '-' + 
                    String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                    String(now.getDate()).padStart(2, '0');
                  const currentTime = String(now.getHours()).padStart(2, '0') + ':' + 
                    String(now.getMinutes()).padStart(2, '0');

                  setSelectedServiceType("opd");
                  setSelectedServiceCategory("");
                  serviceForm.reset({
                    patientId: patientId || "",
                    serviceType: "opd",
                    serviceName: "OPD Consultation",
                    scheduledDate: currentDate,
                    scheduledTime: currentTime,
                    doctorId: "",
                    notes: "",
                    price: 0,
                  });

                  console.log(`Set current date/time: ${currentDate} ${currentTime}`);
                  setIsServiceDialogOpen(true);
                }}
                className="flex items-center gap-2"
                data-testid="button-schedule-opd"
              >
                <Stethoscope className="h-4 w-4" />
                Schedule OPD
              </Button>

              <Button 
                onClick={() => navigate(`/pathology?patientId=${patientId}&patientName=${encodeURIComponent(patient?.name || '')}`)}
                variant="outline"
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
                  const currentDate = now.getFullYear() + '-' + 
                    String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                    String(now.getDate()).padStart(2, '0');
                  const currentTime = String(now.getHours()).padStart(2, '0') + ':' + 
                    String(now.getMinutes()).padStart(2, '0');

                  // Reset service type and category for general service
                  setSelectedServiceType("");
                  setSelectedServiceCategory("");
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
                  });

                  setIsServiceDialogOpen(true);
                }}
                variant="outline"
                className="flex items-center gap-2 bg-purple-500 hover:bg-purple-600 text-white"
                data-testid="button-add-medical-service"
              >
                <Plus className="h-4 w-4" />
                Add Service
              </Button>

              {/* Admission/Discharge Button */}
              {(() => {
                const currentAdmission = admissions?.find((adm: any) => adm.status === 'admitted');

                if (currentAdmission) {
                  // Patient is admitted - show discharge button
                  return (
                    <Button 
                      onClick={() => {
                        // Set current LOCAL date and time when opening discharge dialog
                        const now = new Date();
                        const currentDateTime = now.getFullYear() + '-' +
                          String(now.getMonth() + 1).padStart(2, '0') + '-' +
                          String(now.getDate()).padStart(2, '0') + 'T' +
                          String(now.getHours()).padStart(2, '0') + ':' +
                          String(now.getMinutes()).padStart(2, '0');

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
                        const currentDateTime = now.getFullYear() + '-' + 
                          String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                          String(now.getDate()).padStart(2, '0') + 'T' +
                          String(now.getHours()).padStart(2, '0') + ':' +
                          String(now.getMinutes()).padStart(2, '0');

                        admissionForm.setValue("admissionDate", currentDateTime);
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

              {/* Smart Billing Button */}
              <Button 
                onClick={() => setIsSmartBillingDialogOpen(true)}
                variant="outline"
                className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-white"
                data-testid="button-smart-billing"
              >
                <DollarSign className="h-4 w-4" />
                Smart Billing
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Financial Monitoring */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
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
                <p className="text-sm text-muted-foreground mb-1">Total Charges</p>
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

              <div className={`text-center p-4 rounded-lg ${(financialSummary?.balance || 0) < 0 ? 'bg-red-50' : 'bg-orange-50'}`}>
                <p className="text-sm text-muted-foreground mb-1">Balance</p>
                <p className={`text-2xl font-bold ${(financialSummary?.balance || 0) < 0 ? 'text-red-700' : 'text-orange-700'}`}>
                  {isFinancialLoading ? (
                    <span className="text-sm">Loading...</span>
                  ) : (
                    `₹${(financialSummary?.balance || 0).toLocaleString()}`
                  )}
                </p>
                {(financialSummary?.balance || 0) < 0 && (
                  <p className="text-xs text-red-600 mt-1">Hospital owes patient</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Patient History Tabs */}
        <Tabs defaultValue={window.location.hash === '#pathology' ? 'pathology' : 'services'} className="space-y-4">
          <TabsList>
            <TabsTrigger value="services">Services</TabsTrigger>
            <TabsTrigger value="admissions">Admissions</TabsTrigger>
            <TabsTrigger value="pathology">Pathology</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>

          <TabsContent value="services">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Service History</CardTitle>
                <Button
                  onClick={() => {
                    // Set current LOCAL date and time when opening any service dialog
                    const now = new Date();
                    const currentDate = now.getFullYear() + '-' + 
                      String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                      String(now.getDate()).padStart(2, '0');
                    const currentTime = String(now.getHours()).padStart(2, '0') + ':' + 
                      String(now.getMinutes()).padStart(2, '0');

                    // Reset service type and category
                    setSelectedServiceType("");
                    setSelectedServiceCategory("");
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
                        <TableHead>Type</TableHead>
                        <TableHead>Doctor</TableHead>
                        <TableHead>Scheduled Date</TableHead>
                        <TableHead>Cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {services.map((service: any) => {
                        // Find doctor name from doctors array using doctorId
                        const doctor = doctors.find((d: Doctor) => d.id === service.doctorId);
                        const doctorName = doctor ? doctor.name : (service.doctorId ? "Unknown Doctor" : "No Doctor Assigned");

                        // Calculate total cost: use calculatedAmount if available, otherwise price * billingQuantity
                        const totalCost = service.calculatedAmount || (service.price * (service.billingQuantity || 1));

                        return (
                          <TableRow key={service.id}>
                            <TableCell className="font-medium">{service.serviceName}</TableCell>
                            <TableCell className="capitalize">{service.serviceType}</TableCell>
                            <TableCell>{doctorName}</TableCell>
                            <TableCell>
                              {formatDate(service.scheduledDate)}
                              {service.scheduledTime && (
                                <span className="text-muted-foreground ml-2">
                                  at {service.scheduledTime}
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
                    <p className="text-sm text-muted-foreground">No services scheduled</p>
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
                    const currentAdmission = admissions?.find((adm: any) => adm.status === 'admitted');

                    if (currentAdmission) {
                      return (
                        <>
                          <div className="flex items-center gap-2 px-3 py-2 bg-green-100 text-green-800 rounded-lg text-sm">
                            <div className="w-2 h-2 bg-green-500 rounded-full" />
                            Admitted - Room {currentAdmission.roomNumber}
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
                      return (
                        <Button
                          onClick={() => {
                            // Set current LOCAL date and time when opening admission dialog  
                            const now = new Date();
                            const currentDateTime = now.getFullYear() + '-' + 
                              String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                              String(now.getDate()).padStart(2, '0') + 'T' +
                              String(now.getHours()).padStart(2, '0') + ':' +
                              String(now.getMinutes()).padStart(2, '0');

                            admissionForm.setValue("admissionDate", currentDateTime);
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
                      const doctor = doctors.find((d: Doctor) => d.id === admission.doctorId);

                      return (
                        <div key={admission.id} className="border rounded-lg p-4">
                          {/* Admission Episode Header */}
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-4">
                              <h3 className="font-semibold text-lg">{admission.admissionId}</h3>
                              <Badge 
                                className={
                                  admission.status === 'admitted' 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-gray-100 text-gray-800'
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
                              <span className="text-muted-foreground">Current Room:</span>
                              <div className="font-medium">
                                {admission.currentWardType && admission.currentRoomNumber 
                                  ? `${admission.currentWardType} (${admission.currentRoomNumber})`
                                  : "Not assigned"
                                }
                              </div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Admission Date:</span>
                              <div className="font-medium">
                                {(() => {
                                  let admissionDateStr = admission.admissionDate;

                                  // Handle different date formats
                                  if (admissionDateStr.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)) {
                                    // Datetime-local format: "YYYY-MM-DDTHH:MM"
                                    const parts = admissionDateStr.split('T');
                                    const dateParts = parts[0].split('-');
                                    const timeParts = parts[1].split(':');

                                    // Create date object in local timezone
                                    const localDate = new Date(
                                      parseInt(dateParts[0]), // year
                                      parseInt(dateParts[1]) - 1, // month (0-indexed)
                                      parseInt(dateParts[2]), // day
                                      parseInt(timeParts[0]), // hour
                                      parseInt(timeParts[1]) // minute
                                    );

                                    return localDate.toLocaleString('en-US', {
                                      year: 'numeric',
                                      month: 'short',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      hour12: true
                                    });
                                  } else if (admissionDateStr.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
                                    // Full datetime format: "YYYY-MM-DD HH:MM:SS"
                                    const parts = admissionDateStr.split(' ');
                                    const dateParts = parts[0].split('-');
                                    const timeParts = parts[1].split(':');

                                    // Create date object in local timezone
                                    const localDate = new Date(
                                      parseInt(dateParts[0]), // year
                                      parseInt(dateParts[1]) - 1, // month (0-indexed)
                                      parseInt(dateParts[2]), // day
                                      parseInt(timeParts[0]), // hour
                                      parseInt(timeParts[1]), // minute
                                      parseInt(timeParts[2]) // second
                                    );

                                    return localDate.toLocaleString('en-US', {
                                      year: 'numeric',
                                      month: 'short',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      hour12: true
                                    });
                                  } else if (admissionDateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                                    // Date only format: "YYYY-MM-DD" 
                                    const dateParts = admissionDateStr.split('-');
                                    const localDate = new Date(
                                      parseInt(dateParts[0]), // year
                                      parseInt(dateParts[1]) - 1, // month (0-indexed)
                                      parseInt(dateParts[2]) // day
                                    );

                                    return localDate.toLocaleDateString('en-US', {
                                      year: 'numeric',
                                      month: 'short',
                                      day: 'numeric'
                                    });
                                  }

                                  // Fallback for other formats (including ISO strings)
                                  const date = new Date(admissionDateStr);
                                  if (!isNaN(date.getTime())) {
                                    return date.toLocaleString('en-US', {
                                      year: 'numeric',
                                      month: 'short',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      hour12: true
                                    });
                                  }

                                  return admissionDateStr; // Return as-is if parsing fails
                                })()}
                              </div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">
                                {admission.status === 'discharged' ? 'Discharge Date:' : 'Days Admitted:'}
                              </span>
                              <div className="font-medium">
                                {admission.dischargeDate ? 
                                  (() => {
                                    // Handle SQLite datetime format as local time (no timezone conversion)
                                    let dischargeDateStr = admission.dischargeDate;
                                    if (dischargeDateStr.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
                                      // Parse as local time without adding 'Z' or timezone info
                                      const parts = dischargeDateStr.split(' ');
                                      const dateParts = parts[0].split('-');
                                      const timeParts = parts[1].split(':');

                                      // Create date object in local timezone
                                      const localDate = new Date(
                                        parseInt(dateParts[0]), // year
                                        parseInt(dateParts[1]) - 1, // month (0-indexed)
                                        parseInt(dateParts[2]), // day
                                        parseInt(timeParts[0]), // hour
                                        parseInt(timeParts[1]), // minute
                                        parseInt(timeParts[2]) // second
                                      );

                                      return localDate.toLocaleString('en-US', {
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        hour12: true
                                      });
                                    }

                                    // Fallback for other formats
                                    return new Date(dischargeDateStr).toLocaleString('en-US', {
                                      year: 'numeric',
                                      month: 'short',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      hour12: true
                                    });
                                  })() :
                                  (() => {
                                    // Calculate days using local time
                                    let admissionDateStr = admission.admissionDate;
                                    if (admissionDateStr.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)) {
                                      // Datetime-local format: "YYYY-MM-DDTHH:MM"
                                      const parts = admissionDateStr.split('T');
                                      const dateParts = parts[0].split('-');
                                      const timeParts = parts[1].split(':');

                                      const admissionDate = new Date(
                                        parseInt(dateParts[0]), // year
                                        parseInt(dateParts[1]) - 1, // month (0-indexed)
                                        parseInt(dateParts[2]), // day
                                        parseInt(timeParts[0]), // hour
                                        parseInt(timeParts[1]) // minute
                                      );

                                      return Math.ceil((new Date().getTime() - admissionDate.getTime()) / (1000 * 3600 * 24));
                                    } else if (admissionDateStr.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
                                      // Parse as local time for day calculation
                                      const parts = admissionDateStr.split(' ');
                                      const dateParts = parts[0].split('-');
                                      const timeParts = parts[1].split(':');

                                      const admissionDate = new Date(
                                        parseInt(dateParts[0]), // year
                                        parseInt(dateParts[1]) - 1, // month (0-indexed)
                                        parseInt(dateParts[2]), // day
                                        parseInt(timeParts[0]), // hour
                                        parseInt(timeParts[1]), // minute
                                        parseInt(timeParts[2]) // second
                                      );

                                      return Math.ceil((new Date().getTime() - admissionDate.getTime()) / (1000 * 3600 * 24));
                                    }

                                    // Fallback for other formats
                                    return Math.ceil((new Date().getTime() - new Date(admissionDateStr).getTime()) / (1000 * 3600 * 24));
                                  })()
                                }
                              </div>
                            </div>
                          </div>

                          {/* Event Timeline */}
                          {events.length > 0 && (
                            <div>
                              <h4 className="font-medium mb-2 text-sm text-muted-foreground">Event History:</h4>
                              <div className="space-y-2">
                                {events.map((event: AdmissionEvent) => (
                                  <div key={event.id} className="flex items-start gap-3 text-sm">
                                    <div className={`w-2 h-2 rounded-full mt-2 ${
                                      event.eventType === 'admit' ? 'bg-green-500' :
                                      event.eventType === 'room_change' ? 'bg-blue-500' :
                                      'bg-gray-500'
                                    }`} />
                                    <div className="flex-1">
                                      <div className="flex items-center justify-between">
                                        <span className="font-medium capitalize">
                                          {event.eventType.replace('_', ' ')}
                                          {event.roomNumber && event.wardType && 
                                            ` - ${event.wardType} (${event.roomNumber})`
                                          }
                                        </span>
                                        <span className="text-muted-foreground text-xs">
                                          {new Date(event.eventTime).toLocaleString('en-IN', {
                                            month: 'short',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                            hour12: true
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
                    <p className="text-sm text-muted-foreground">No admissions recorded</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pathology">
            <Card>
              <CardHeader>
                <CardTitle>Pathology Orders</CardTitle>
              </CardHeader>
              <CardContent>
                {pathologyOrders && pathologyOrders.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order ID</TableHead>
                        <TableHead>Ordered Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Total Price</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pathologyOrders.map((orderData: any) => {
                        // Handle both direct order objects and nested order structure
                        const order = orderData.order || orderData;
                        if (!order || !order.orderId) return null;

                        return (
                          <TableRow key={order.id}>
                            <TableCell className="font-medium">{order.orderId}</TableCell>
                            <TableCell>{formatDate(order.orderedDate)}</TableCell>
                            <TableCell>
                              <Badge className={getStatusColor(order.status)} variant="secondary">
                                {order.status}
                              </Badge>
                            </TableCell>
                            <TableCell>₹{order.totalPrice || 0}</TableCell>
                            <TableCell>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate(`/pathology`)}
                                data-testid={`view-pathology-${order.id}`}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground">No pathology orders found</p>
                  </div>
                )}
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
                    console.log("=== TIMELINE DEBUG START ===");

                    // Helper function to normalize dates consistently
                    const normalizeDate = (dateInput: any, source: string, id?: string): { date: string; timestamp: number } => {
                      let dateStr: string;

                      // Handle null/undefined
                      if (!dateInput) {
                        console.warn(`No date provided for ${source} ${id || 'unknown'}, using current time`);
                        const now = new Date();
                        return { date: now.toISOString(), timestamp: now.getTime() };
                      }

                      // Convert to string if it's not already
                      if (typeof dateInput === 'string') {
                        dateStr = dateInput;
                      } else if (dateInput instanceof Date) {
                        dateStr = dateInput.toISOString();
                      } else {
                        dateStr = String(dateInput);
                      }

                      console.log(`Normalizing date for ${source} ${id || 'unknown'}: "${dateStr}"`);

                      // For registration dates, use the same UTC handling as other events
                      if (source === 'registration') {
                        // Handle SQLite datetime format: "YYYY-MM-DD HH:MM:SS" - convert to UTC
                        if (dateStr.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
                          dateStr = dateStr.replace(' ', 'T') + 'Z';
                          console.log(`Converted SQLite format (UTC) to: "${dateStr}"`);
                        }
                        // Handle date only format: "YYYY-MM-DD" - convert to UTC
                        else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                          dateStr = dateStr + 'T00:00:00Z';
                          console.log(`Converted date-only format (UTC) to: "${dateStr}"`);
                        }
                        // Handle datetime without timezone - add Z for UTC
                        else if (dateStr.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/) && !dateStr.includes('Z') && !dateStr.includes('+')) {
                          dateStr = dateStr + 'Z';
                          console.log(`Added timezone to: "${dateStr}"`);
                        }

                        // Parse the date
                        const parsed = new Date(dateStr);
                        if (isNaN(parsed.getTime())) {
                          console.error(`Failed to parse registration date "${dateStr}", using current time`);
                          const now = new Date();
                          return { date: now.toISOString(), timestamp: now.getTime() };
                        }

                        const timestamp = parsed.getTime();
                        console.log(`Final normalized registration date: "${dateStr}" -> timestamp: ${timestamp} (${new Date(timestamp).toLocaleString()})`);

                        return { date: dateStr, timestamp };
                      }

                      // For other sources (services, admissions, etc), use existing logic
                      // Handle SQLite datetime format: "YYYY-MM-DD HH:MM:SS"
                      if (dateStr.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
                        dateStr = dateStr.replace(' ', 'T') + 'Z';
                        console.log(`Converted SQLite format to: "${dateStr}"`);
                      }
                      // Handle date only format: "YYYY-MM-DD"
                      else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                        dateStr = dateStr + 'T00:00:00Z';
                        console.log(`Converted date-only format to: "${dateStr}"`);
                      }
                      // Handle datetime without timezone
                      else if (dateStr.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/) && !dateStr.includes('Z') && !dateStr.includes('+')) {
                        dateStr = dateStr + 'Z';
                        console.log(`Added timezone to: "${dateStr}"`);
                      }

                      // Parse the date
                      const parsed = new Date(dateStr);
                      if (isNaN(parsed.getTime())) {
                        console.error(`Failed to parse date "${dateStr}" for ${source} ${id || 'unknown'}, using current time`);
                        const now = new Date();
                        return { date: now.toISOString(), timestamp: now.getTime() };
                      }

                      const timestamp = parsed.getTime();
                      console.log(`Final normalized date for ${source} ${id || 'unknown'}: "${dateStr}" -> timestamp: ${timestamp} (${new Date(timestamp).toLocaleString()})`);

                      return { date: dateStr, timestamp };
                    };

                    // Create timeline events array
                    const timelineEvents = [];

                    // Add registration event with IST correction
                    const regNormalized = normalizeDate(patient.createdAt, 'registration');
                    // Subtract 5.5 hours (19800000 ms) to correct the timezone display
                    const istTimestamp = regNormalized.timestamp - (5.5 * 60 * 60 * 1000);
                    timelineEvents.push({
                      id: 'registration',
                      type: 'registration',
                      title: 'Patient Registered',
                      date: regNormalized.date,
                      description: `Patient ID: ${patient.patientId}`,
                      color: 'bg-blue-500',
                      sortTimestamp: istTimestamp
                    });

                    // Add services with proper date normalization
                    if (services && services.length > 0) {
                      console.log("Processing services for timeline:", services.length);
                      services.forEach((service: any) => {
                        // Priority: createdAt > constructed date from scheduled fields
                        let primaryDate = service.createdAt;
                        if (!primaryDate && service.scheduledDate) {
                          if (service.scheduledTime) {
                            primaryDate = `${service.scheduledDate}T${service.scheduledTime}:00`;
                          } else {
                            primaryDate = `${service.scheduledDate}T00:00:00`;
                          }
                        }

                        const serviceNormalized = normalizeDate(primaryDate, 'service', service.id);

                        // Calculate total cost: use calculatedAmount if available, otherwise price * billingQuantity
                        const totalCost = service.calculatedAmount || (service.price * (service.billingQuantity || 1));

                        timelineEvents.push({
                          id: service.id,
                          type: 'service',
                          title: service.serviceName,
                          date: serviceNormalized.date,
                          description: `Status: ${service.status} • Cost: ₹${totalCost}`,
                          color: 'bg-green-500',
                          sortTimestamp: serviceNormalized.timestamp,
                          rawData: { service, primaryDate }, // Debug info
                          // Include all service fields directly in the event for receipt access
                          receiptNumber: service.receiptNumber,
                          serviceName: service.serviceName,
                          price: service.price,
                          serviceType: service.serviceType,
                          doctorId: service.doctorId
                        });
                      });
                    }

                    // Add admission events
                    if (admissions && admissions.length > 0) {
                      console.log("Processing admissions for timeline:", admissions.length);
                      admissions.forEach((admission: any) => {
                        const events = admissionEventsMap[admission.id] || [];
                        const doctor = doctors.find((d: Doctor) => d.id === admission.doctorId);
                        const doctorName = doctor ? doctor.name : "No Doctor Assigned";

                        console.log(`Processing admission ${admission.id} with ${events.length} events`);

                        // Add events from admission events table
                        events.forEach((event: AdmissionEvent) => {
                          // Priority: eventTime > createdAt
                          const primaryDate = event.eventTime || event.createdAt;
                          const eventNormalized = normalizeDate(primaryDate, 'admission_event', event.id);

                          let title = '';
                          let color = 'bg-orange-500';
                          let description = '';

                          switch (event.eventType) {
                            case 'admit':
                              title = 'Patient Admitted';
                              color = 'bg-green-500';
                              if (event.roomNumber && event.wardType) {
                                description = `Room: ${event.roomNumber} (${event.wardType})`;
                              }
                              break;
                            case 'room_change':
                              title = 'Room Transfer';
                              color = 'bg-blue-500';
                              if (event.roomNumber && event.wardType) {
                                description = `Moved to: ${event.roomNumber} (${event.wardType})`;
                              }
                              break;
                            case 'discharge':
                              title = 'Patient Discharged';
                              color = 'bg-gray-500';
                              if (event.roomNumber && event.wardType) {
                                description = `From: ${event.roomNumber} (${event.wardType})`;
                              }
                              break;
                            default:
                              title = `Admission ${event.eventType.replace('_', ' ')}`;
                              if (event.roomNumber && event.wardType) {
                                description = `Room: ${event.roomNumber} (${event.wardType})`;
                              }
                          }

                          timelineEvents.push({
                            id: `${admission.id}-${event.id}`,
                            type: 'admission_event',
                            title: title,
                            date: eventNormalized.date,
                            description: description,
                            color: color,
                            sortTimestamp: eventNormalized.timestamp,
                            rawData: { event, primaryDate }, // Debug info
                            doctorName: doctorName, // Add doctorName directly to the event
                            receiptNumber: event.receiptNumber // Include receipt number from event
                          });
                        });

                        // If no events exist, create a basic admission entry as fallback
                        if (events.length === 0) {
                          const primaryDate = admission.createdAt || admission.admissionDate;
                          const admissionNormalized = normalizeDate(primaryDate, 'admission_fallback', admission.id);

                          timelineEvents.push({
                            id: `${admission.id}-fallback`,
                            type: 'admission',
                            title: 'Patient Admission',
                            date: admissionNormalized.date,
                            description: (() => {
                              const wardDisplay = admission.currentWardType || admission.wardType;
                              const parts = [];
                              if (admission.reason) parts.push(`Reason: ${admission.reason}`);
                              parts.push(`Doctor: ${doctorName}`);
                              parts.push(`Ward: ${wardDisplay}`);
                              parts.push(`Room: ${admission.currentRoomNumber || admission.roomNumber || 'N/A'}`);
                              return parts.join(' • ');
                            })(),
                            color: 'bg-orange-500',
                            sortTimestamp: admissionNormalized.timestamp,
                            rawData: { admission, primaryDate, doctorName }, // Include doctor info for receipt
                            doctorName: doctorName // Add doctorName directly to the event
                          });
                        }
                      });
                    }

                    // Add payment and discount entries from admissions
                    if (admissions && admissions.length > 0) {
                      console.log("Processing payment and discount entries for timeline");
                      admissions.forEach((admission: any) => {
                        // Add payment entries
                        if (admission.lastPaymentDate && admission.lastPaymentAmount) {
                          const paymentNormalized = normalizeDate(admission.lastPaymentDate, 'payment', admission.id);

                          timelineEvents.push({
                            id: `payment-${admission.id}`,
                            type: 'payment',
                            title: 'Payment Received',
                            date: paymentNormalized.date,
                            description: `Amount: ₹${admission.lastPaymentAmount}`,
                            color: 'bg-green-600',
                            sortTimestamp: paymentNormalized.timestamp
                          });
                        }

                        // Add discount entries  
                        if (admission.lastDiscountDate && admission.lastDiscountAmount) {
                          const discountNormalized = normalizeDate(admission.lastDiscountDate, 'discount', admission.id);

                          timelineEvents.push({
                            id: `discount-${admission.id}`,
                            type: 'discount',
                            title: 'Discount Applied',
                            date: discountNormalized.date,
                            description: `Amount: ₹${admission.lastDiscountAmount}${admission.lastDiscountReason ? ` • Reason: ${admission.lastDiscountReason}` : ''}`,
                            color: 'bg-red-500',
                            sortTimestamp: discountNormalized.timestamp
                          });
                        }
                      });
                    }

                    // Add pathology orders
                    if (pathologyOrders && pathologyOrders.length > 0) {
                      console.log("Processing pathology orders for timeline:", pathologyOrders.length);
                      pathologyOrders.forEach((orderData: any) => {
                        // Handle both the nested structure from the API and direct order objects
                        const order = orderData.order || orderData;
                        if (!order) {
                          console.warn("No order found in pathology data:", orderData);
                          return;
                        }

                        // Priority: createdAt > orderedDate
                        const primaryDate = order.createdAt || order.orderedDate;
                        const pathologyNormalized = normalizeDate(primaryDate, 'pathology', order.id);

                        // Count tests - handle both nested tests array and direct tests
                        let testCount = 0;
                        if (orderData.tests && Array.isArray(orderData.tests)) {
                          testCount = orderData.tests.length;
                        } else if (order.tests && Array.isArray(order.tests)) {
                          testCount = order.tests.length;
                        }

                        const pathologyEvent = {
                          id: order.id || `pathology-${Date.now()}`,
                          type: 'pathology',
                          title: `Pathology Order: ${order.orderId || 'Unknown Order'}`,
                          date: pathologyNormalized.date,
                          description: `Status: ${order.status || 'ordered'} • Cost: ₹${order.totalPrice || 0}`,
                          color: 'bg-purple-500',
                          sortTimestamp: pathologyNormalized.timestamp,
                          extraInfo: order.completedDate ? `Completed: ${new Date(order.completedDate).toLocaleString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true,
                            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                          })}` : null,
                          rawData: { order, primaryDate }, // Debug info
                          // Include order fields directly for receipt access
                          receiptNumber: order.receiptNumber,
                          orderId: order.orderId,
                          totalPrice: order.totalPrice,
                          orderedDate: order.orderedDate
                        };

                        timelineEvents.push(pathologyEvent);
                      });
                    }

                    // Sort events chronologically (earliest first) using consistent timestamp
                    console.log("Timeline events before sorting:", timelineEvents.map(e => ({
                      id: e.id,
                      title: e.title,
                      timestamp: e.sortTimestamp,
                      date: e.date,
                      localTime: new Date(e.sortTimestamp).toLocaleString()
                    })));

                    timelineEvents.sort((a, b) => {
                      // Primary sort by timestamp (ascending - earliest first)
                      const timestampDiff = a.sortTimestamp - b.sortTimestamp;

                      if (timestampDiff !== 0) {
                        return timestampDiff;
                      }

                      // Secondary sort by ID for stable sorting when timestamps are identical
                      return a.id.localeCompare(b.id);
                    });

                    console.log("Timeline events after sorting:", timelineEvents.map(e => ({
                      id: e.id,
                      title: e.title,
                      timestamp: e.sortTimestamp,
                      date: e.date,
                      localTime: new Date(e.sortTimestamp).toLocaleString()
                    })));

                    console.log("=== TIMELINE DEBUG END ===");

                    return timelineEvents.length > 0 ? timelineEvents.map((event) => (
                      <div key={event.id} className={event.type === 'registration' ? 'w-full' : 'flex items-stretch gap-3'}>
                        <div className={`${event.type === 'registration' ? 'w-full' : 'flex-1'} flex items-start gap-3 p-3 border rounded-lg`}>
                          <div className={`w-3 h-3 ${event.color} rounded-full mt-1`} />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <p className="font-medium">{event.title}</p>
                              <span className="text-sm text-muted-foreground">
                                {(() => {
                                  // For registration events, use the IST-corrected timestamp
                                  // For other events, use the original timestamp as they're already in local time
                                  const displayTimestamp = event.type === 'registration' 
                                    ? event.sortTimestamp  // Already IST-corrected above
                                    : event.sortTimestamp;

                                  return new Date(displayTimestamp).toLocaleString('en-US', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    hour12: true
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
                        {event.type !== 'registration' && (
                          <div className="flex items-stretch">
                            <div className="flex items-center h-full">
                              <ReceiptTemplate
                                receiptData={generateReceiptData(event, event.type)}
                                hospitalInfo={hospitalInfo}
                                onPrint={() => {
                                  toast({
                                    title: "Receipt printed",
                                    description: "Receipt has been sent to printer.",
                                  });
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )) : (
                      <div className="text-center text-muted-foreground py-8">
                        <p>Patient timeline will show services, admissions, and pathology orders as they are added.</p>
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
              {selectedServiceType === "opd" ? "Schedule OPD Consultation" : "Schedule Patient Service"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={serviceForm.handleSubmit(onServiceSubmit)} className="space-y-6">
            {selectedServiceType === "opd" && (
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-800 font-medium">OPD Consultation</p>
                {(() => {
                  const selectedDoctorId = serviceForm.watch("doctorId");
                  const selectedDoctor = doctors.find((d: Doctor) => d.id === selectedDoctorId);
                  const consultationFee = selectedDoctorId && selectedDoctorId !== "none" && selectedDoctor ? selectedDoctor.consultationFee : 0;

                  return (
                    <p className="text-sm text-blue-600">
                      Consultation fee: ₹{consultationFee}
                      {(!selectedDoctorId || selectedDoctorId === "none") && <span className="text-blue-500 ml-1">(Select doctor to see fee)</span>}
                    </p>
                  );
                })()}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{selectedServiceType === "opd" ? "Consulting Doctor *" : "Assigned Doctor *"}</Label>
                <Select 
                  value={serviceForm.watch("doctorId")}
                  onValueChange={(value) => {
                    serviceForm.setValue("doctorId", value);
                    // Clear the error when a valid doctor is selected
                    if (value && value !== "none") {
                      serviceForm.clearErrors("doctorId");
                    }
                  }}
                  data-testid="select-service-doctor"
                >
                  <SelectTrigger>
                    <SelectValue placeholder={selectedServiceType === "opd" ? "Select consulting doctor (required)" : "Select doctor (required)"} />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedServiceType !== "opd" && <SelectItem value="none">No doctor assigned</SelectItem>}
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
                  {...serviceForm.register("scheduledDate", { required: "Scheduled date is required" })}
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
                  {...serviceForm.register("scheduledTime", { required: "Scheduled time is required" })}
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
                        setSelectedServiceCategory(value === "all" ? "" : value);
                        // Reset service selection when category changes
                        serviceForm.setValue("serviceType", "");
                        serviceForm.setValue("serviceName", "");
                        serviceForm.setValue("price", 0);
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
                        value={serviceSearchQuery}
                        onChange={(e) => {
                          setServiceSearchQuery(e.target.value);
                          // Reset service selection when search changes
                          serviceForm.setValue("serviceType", "");
                          serviceForm.setValue("serviceName", "");
                          serviceForm.setValue("price", 0);
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
                        <TableHead className="text-right w-24">Quantity</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getFilteredServices(selectedServiceCategory).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            No services found. Try adjusting your search or category filter.
                          </TableCell>
                        </TableRow>
                      ) : (
                        getFilteredServices(selectedServiceCategory).map((service) => {
                          const isSelected = selectedServices.some(s => s.id === service.id);
                          return (
                            <TableRow 
                              key={service.id}
                              className={isSelected ? "bg-blue-50" : ""}
                            >
                              <TableCell>
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSelectedServices([...selectedServices, { ...service, quantity: 1 }]);
                                    } else {
                                      setSelectedServices(selectedServices.filter(s => s.id !== service.id));
                                    }
                                  }}
                                />
                              </TableCell>
                              <TableCell className="font-medium">{service.name}</TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {serviceCategories.find(cat => cat.key === service.category)?.label || service.category}
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
                                    step={service.billingType === 'per_hour' ? "0.5" : "1"}
                                    value={selectedServices.find(s => s.id === service.id)?.quantity || 1}
                                    onChange={(e) => {
                                      const quantity = parseFloat(e.target.value) || 1;
                                      setSelectedServices(selectedServices.map(s => 
                                        s.id === service.id ? { ...s, quantity } : s
                                      ));
                                    }}
                                    className="w-20 h-8"
                                  />
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Services Summary */}
                {selectedServices.length > 0 && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium mb-3">Selected Services Summary</h4>
                    <div className="space-y-2">
                      {selectedServices.map((service) => (
                        <div key={service.id} className="flex justify-between items-center text-sm">
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
                          ₹{selectedServices.reduce((total, service) => 
                            total + (service.price * (service.quantity || 1)), 0
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

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsServiceDialogOpen(false);
                  setSelectedServiceType("");
                  setSelectedServiceCategory("");
                  setServiceSearchQuery("");
                  serviceForm.reset({
                    patientId: patientId || "",
                    serviceType: "",
                    serviceName: "",
                    scheduledDate: "",
                    scheduledTime: "",
                    doctorId: "",
                    notes: "",
                    price: 0,
                  });
                }}
                data-testid="button-cancel-service"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createServiceMutation.isPending || (selectedServiceType !== "opd" && selectedServices.length === 0)}
                data-testid="button-schedule-service"
              >
                {createServiceMutation.isPending 
                  ? "Scheduling..." 
                  : selectedServiceType === "opd" 
                    ? "Schedule OPD" 
                    : selectedServices.length > 0
                      ? `Schedule ${selectedServices.length} Service(s)` 
                      : "Schedule Service"
                }
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Admission Dialog */}
      <Dialog open={isAdmissionDialogOpen} onOpenChange={setIsAdmissionDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Admit Patient</DialogTitle>
          </DialogHeader>

          <form onSubmit={admissionForm.handleSubmit(onAdmissionSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Doctor *</Label>
                <Select 
                  value={admissionForm.watch("doctorId")}
                  onValueChange={(value) => admissionForm.setValue("doctorId", value)}
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
                    const selectedRoomType = roomTypes.find((rt: any) => rt.name === value);
                    if (selectedRoomType) {
                      admissionForm.setValue("dailyCost", selectedRoomType.dailyCost);
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
                  onValueChange={(value) => admissionForm.setValue("currentRoomNumber", value)}
                  disabled={!admissionForm.watch("currentWardType")}
                  data-testid="select-room-number"
                >
                  <SelectTrigger>
                    <SelectValue placeholder={admissionForm.watch("currentWardType") ? "Select available room" : "Select ward type first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {(() => {
                      const selectedWardType = admissionForm.watch("currentWardType");
                      const selectedRoomType = roomTypes.find((rt: any) => rt.name === selectedWardType);

                      if (!selectedRoomType) return null;

                      // Get all rooms for this room type
                      const allRoomsForType = rooms.filter((room: any) => 
                        room.roomTypeId === selectedRoomType.id && 
                        room.isActive
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
                          .filter((admission: any) => 
                            admission.currentWardType === selectedWardType && 
                            admission.status === 'admitted'
                          )
                          .map((admission: any) => admission.currentRoomNumber)
                      );

                      return allRoomsForType.map((room: any) => {
                        const isOccupied = occupiedRoomNumbers.has(room.roomNumber);

                        return (
                          <SelectItem 
                            key={room.id} 
                            value={room.roomNumber}
                            disabled={isOccupied}
                            className={isOccupied ? "text-gray-500 bg-gray-200 dark:bg-gray-800 dark:text-gray-400 cursor-not-allowed opacity-60 hover:bg-gray-200 dark:hover:bg-gray-800" : ""}
                          >
                            {room.roomNumber}{isOccupied ? " (Occupied)" : ""}
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
                  {...admissionForm.register("dailyCost", { valueAsNumber: true })}
                  placeholder="Daily ward cost"
                  data-testid="input-daily-cost"
                  readOnly={!!admissionForm.watch("currentWardType")}
                  className={admissionForm.watch("currentWardType") ? "bg-gray-50" : ""}
                />
              </div>

              <div className="space-y-2">
                <Label>Initial Deposit (₹)</Label>
                <Input
                  type="number"
                  {...admissionForm.register("initialDeposit", { valueAsNumber: true })}
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
                {createAdmissionMutation.isPending ? "Admitting..." : "Admit Patient"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Discharge Dialog */}
      <Dialog open={isDischargeDialogOpen} onOpenChange={setIsDischargeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discharge Patient</DialogTitle>
          </DialogHeader>

          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Are you sure you want to discharge this patient? This action will mark the admission as completed and set the discharge date to now.
            </p>

            {(() => {
              const currentAdmission = admissions?.find((adm: any) => adm.status === 'admitted');
              if (currentAdmission) {
                return (
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm"><strong>Room:</strong> {currentAdmission.roomNumber}</p>
                    <p className="text-sm"><strong>Ward Type:</strong> {currentAdmission.wardType}</p>
                    <p className="text-sm"><strong>Admission Date:</strong> {formatDate(currentAdmission.admissionDate)}</p>
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
              {dischargePatientMutation.isPending ? "Discharging..." : "Discharge Patient"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Room Update Dialog */}
      <Dialog open={isRoomUpdateDialogOpen} onOpenChange={setIsRoomUpdateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Room Assignment</DialogTitle>
          </DialogHeader>

          <form onSubmit={roomUpdateForm.handleSubmit(onRoomUpdate)} className="space-y-4">
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
                      {roomType.name} ({roomType.category}) - ₹{roomType.dailyCost}/day
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Room Number *</Label>
              <Select
                value={roomUpdateForm.watch("roomNumber")}
                onValueChange={(value) => roomUpdateForm.setValue("roomNumber", value)}
                disabled={!roomUpdateForm.watch("wardType")}
                data-testid="select-update-room-number"
              >
                <SelectTrigger>
                  <SelectValue placeholder={roomUpdateForm.watch("wardType") ? "Select available room" : "Select ward type first"} />
                </SelectTrigger>
                <SelectContent>
                  {(() => {
                    const selectedWardType = roomUpdateForm.watch("wardType");
                    const selectedRoomType = roomTypes.find((rt: any) => rt.name === selectedWardType);

                    if (!selectedRoomType) return null;

                    // Get all rooms for this room type
                    const allRoomsForType = rooms.filter((room: any) => 
                      room.roomTypeId === selectedRoomType.id && 
                      room.isActive
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
                        .filter((admission: any) => 
                          admission.currentWardType === selectedWardType && 
                          admission.status === 'admitted'
                        )
                        .map((admission: any) => admission.currentRoomNumber)
                    );

                    return allRoomsForType.map((room: any) => {
                      const isOccupied = occupiedRoomNumbers.has(room.roomNumber);

                      return (
                        <SelectItem 
                          key={room.id} 
                          value={room.roomNumber}
                          disabled={isOccupied}
                          className={isOccupied ? "text-gray-500 bg-gray-200 dark:bg-gray-800 dark:text-gray-400 cursor-not-allowed opacity-60 hover:bg-gray-200 dark:hover:bg-gray-800" : ""}
                        >
                          {room.roomNumber}{isOccupied ? " (Occupied)" : ""}
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
              <Button
                type="submit"
                disabled={updateRoomMutation.isPending}
              >
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
                    reason: "Payment"
                  });
                }
              }}
              disabled={addPaymentMutation.isPending || !paymentAmount || parseFloat(paymentAmount) <= 0}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {addPaymentMutation.isPending ? "Adding Payment..." : "Add Payment"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Discount Dialog */}
      <Dialog open={isDiscountDialogOpen} onOpenChange={setIsDiscountDialogOpen}>
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
                    discountType: "manual"
                  });
                } else {
                  toast({
                    title: "Error",
                    description: "Please enter a valid discount amount.",
                    variant: "destructive",
                  });
                }
              }}
              disabled={addDiscountMutation.isPending || !discountAmount || parseFloat(discountAmount) <= 0}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {addDiscountMutation.isPending ? "Adding Discount..." : "Add Discount"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Smart Billing Dialog */}
      <Dialog open={isSmartBillingDialogOpen} onOpenChange={setIsSmartBillingDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Smart Billing</DialogTitle>
          </DialogHeader>
          <SmartBillingDialog patientId={patientId} onClose={() => setIsSmartBillingDialogOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}