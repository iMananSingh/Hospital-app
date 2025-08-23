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
  Edit
} from "lucide-react";
import { insertPatientServiceSchema, insertAdmissionSchema } from "@shared/schema";
import { z } from "zod";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Patient, PatientService, Admission, Doctor } from "@shared/schema";

export default function PatientDetail() {
  const params = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const patientId = params.id;

  const [isServiceDialogOpen, setIsServiceDialogOpen] = useState(false);
  const [isAdmissionDialogOpen, setIsAdmissionDialogOpen] = useState(false);
  const [isDischargeDialogOpen, setIsDischargeDialogOpen] = useState(false);
  const [isRoomUpdateDialogOpen, setIsRoomUpdateDialogOpen] = useState(false);
  const [selectedServiceType, setSelectedServiceType] = useState<string>("");

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

  // Fetch doctors for service assignment
  const { data: doctors = [] } = useQuery<Doctor[]>({
    queryKey: ["/api/doctors"],
  });

  // Fetch room types for admission form
  const { data: roomTypes = [] } = useQuery<any[]>({
    queryKey: ["/api/room-types"],
  });

  const serviceForm = useForm({
    mode: "onChange",
    defaultValues: {
      patientId: patientId || "",
      serviceType: "",
      serviceName: "",
      scheduledDate: "", // Will be set dynamically when dialog opens
      scheduledTime: "", // Will be set dynamically when dialog opens
      doctorId: "",
      notes: "",
      price: 0,
    },
  });

  const admissionForm = useForm({
    // Remove zodResolver to handle validation manually since reason is now optional
    defaultValues: {
      patientId: patientId,
      doctorId: "",
      wardType: "",
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
      const response = await fetch("/api/patient-services", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create service");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-services", patientId] });
      setIsServiceDialogOpen(false);
      serviceForm.reset();
      toast({
        title: "Service scheduled successfully",
        description: "The patient service has been scheduled.",
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
    onError: () => {
      toast({
        title: "Error creating admission",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const onServiceSubmit = (data: any) => {
    console.log("=== FORM SUBMISSION DEBUG ===");
    console.log("Form submitted with data:", data);
    console.log("Selected service type:", selectedServiceType);
    console.log("Form errors:", serviceForm.formState.errors);
    console.log("Form is valid:", serviceForm.formState.isValid);
    console.log("Doctors available:", doctors);
    
    // Check if form has validation errors
    if (Object.keys(serviceForm.formState.errors).length > 0) {
      console.error("Form has validation errors:", serviceForm.formState.errors);
      toast({
        title: "Form Validation Error",
        description: "Please fix the form errors before submitting",
        variant: "destructive",
      });
      return;
    }
    
    let serviceData;
    
    if (selectedServiceType === "opd") {
      // For OPD, validate doctor selection and use doctor's consultation fee
      if (!data.doctorId || data.doctorId === "none") {
        console.error("Doctor not selected for OPD");
        toast({
          title: "Doctor Required",
          description: "Please select a consulting doctor for OPD consultation",
          variant: "destructive",
        });
        return;
      }
      
      const selectedDoctor = doctors.find((d: Doctor) => d.id === data.doctorId);
      const consultationFee = selectedDoctor?.consultationFee || 0;
      
      serviceData = {
        ...data,
        serviceId: `SRV-${Date.now()}`,
        serviceName: "OPD Consultation",
        serviceType: "opd",
        price: consultationFee,
        doctorId: data.doctorId,
      };
    } else {
      serviceData = {
        ...data,
        serviceId: `SRV-${Date.now()}`,
        // Convert "none" back to empty string for the API
        doctorId: data.doctorId === "none" ? "" : data.doctorId,
      };
    }
    
    console.log("Final service data to submit:", serviceData);
    console.log("About to call mutation...");
    
    try {
      createServiceMutation.mutate(serviceData);
      console.log("Mutation called successfully");
    } catch (error) {
      console.error("Error calling mutation:", error);
      toast({
        title: "Submission Error",
        description: "Failed to submit form. Please try again.",
        variant: "destructive",
      });
    }
  };

  const onAdmissionSubmit = (data: any) => {
    // Validate required fields (reason is now optional)
    const requiredFields = ['doctorId', 'wardType', 'admissionDate', 'dailyCost'];
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
    mutationFn: async (admissionId: string) => {
      const response = await fetch(`/api/admissions/${admissionId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
        },
        body: JSON.stringify({ 
          status: "discharged",
          dischargeDate: new Date().toISOString() 
        }),
      });
      
      if (!response.ok) throw new Error("Failed to discharge patient");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admissions"] });
      setIsDischargeDialogOpen(false);
      toast({
        title: "Patient discharged successfully",
        description: "The patient has been discharged.",
      });
    },
  });

  const updateRoomMutation = useMutation({
    mutationFn: async (data: any) => {
      const currentAdmission = admissions?.find((adm: any) => adm.status === 'admitted');
      if (!currentAdmission) throw new Error("No active admission found");
      
      const response = await fetch(`/api/admissions/${currentAdmission.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) throw new Error("Failed to update room");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admissions"] });
      setIsRoomUpdateDialogOpen(false);
      roomUpdateForm.reset();
      toast({
        title: "Room updated successfully",
        description: "Patient room information has been updated.",
      });
    },
  });

  const onDischargePatient = () => {
    const currentAdmission = admissions?.find((adm: any) => adm.status === 'admitted');
    if (currentAdmission) {
      dischargePatientMutation.mutate(currentAdmission.id);
    }
  };

  const onRoomUpdate = (data: any) => {
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

  const serviceTypes = [
    { value: "opd", name: "OPD Consultation", icon: Stethoscope, price: 500 },
    { value: "labtest", name: "Laboratory Test", icon: TestTube, price: 0 },
    { value: "xray", name: "X-Ray", icon: X, price: 800 },
    { value: "ecg", name: "ECG", icon: Heart, price: 300 },
    { value: "consultation", name: "Doctor Consultation", icon: Stethoscope, price: 1000 },
    { value: "emergency", name: "Emergency Care", icon: ClipboardList, price: 2000 },
  ];

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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="font-medium">{patient.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Age</p>
                    <p className="font-medium">{patient.age} years</p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Gender</p>
                    <p className="font-medium capitalize">{patient.gender}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium">{patient.phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{patient.email || "N/A"}</p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Patient ID</p>
                    <p className="font-medium">{patient.patientId}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Emergency Contact</p>
                    <p className="font-medium">{patient.emergencyContact || "N/A"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Address</p>
                    <p className="font-medium">{patient.address || "N/A"}</p>
                  </div>
                </div>
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
                  serviceForm.setValue("serviceType", "opd");
                  serviceForm.setValue("serviceName", "OPD Consultation");
                  serviceForm.setValue("scheduledDate", currentDate);
                  serviceForm.setValue("scheduledTime", currentTime);
                  
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
                className="flex items-center gap-2"
                data-testid="button-pathology-tests"
              >
                <TestTube className="h-4 w-4" />
                Order Pathology Tests
              </Button>

              {/* Admission/Discharge Button */}
              {(() => {
                const currentAdmission = admissions?.find((adm: any) => adm.status === 'admitted');
                
                if (currentAdmission) {
                  // Patient is admitted - show discharge button
                  return (
                    <Button 
                      onClick={() => setIsDischargeDialogOpen(true)}
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
                        // Set current LOCAL date when opening admission dialog
                        const now = new Date();
                        const currentDate = now.getFullYear() + '-' + 
                          String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                          String(now.getDate()).padStart(2, '0');
                        
                        admissionForm.setValue("admissionDate", currentDate);
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
                    
                    serviceForm.setValue("scheduledDate", currentDate);
                    serviceForm.setValue("scheduledTime", currentTime);
                    
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
                        <TableHead>Price</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {services.map((service: any) => {
                        // Find doctor name from doctors array using doctorId
                        const doctor = doctors.find((d: Doctor) => d.id === service.doctorId);
                        const doctorName = doctor ? doctor.name : (service.doctorId ? "Unknown Doctor" : "No Doctor Assigned");
                        
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
                            <TableCell>₹{service.price}</TableCell>
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
                            // Set current LOCAL date when opening admission dialog  
                            const now = new Date();
                            const currentDate = now.getFullYear() + '-' + 
                              String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                              String(now.getDate()).padStart(2, '0');
                            
                            admissionForm.setValue("admissionDate", currentDate);
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
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Admission ID</TableHead>
                        <TableHead>Doctor</TableHead>
                        <TableHead>Ward</TableHead>
                        <TableHead>Admission Date</TableHead>
                        <TableHead>Discharge Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Days</TableHead>
                        <TableHead>Total Room Cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {admissions.map((admission: any) => (
                        <TableRow key={admission.id}>
                          <TableCell className="font-medium">{admission.admissionId}</TableCell>
                          <TableCell>{
                            (() => {
                              const doctor = doctors.find((d: Doctor) => d.id === admission.doctorId);
                              return doctor ? doctor.name : "No Doctor Assigned";
                            })()
                          }</TableCell>
                          <TableCell>{
                            (() => {
                              const wardDisplay = admission.wardType;
                              
                              return admission.roomNumber 
                                ? `${wardDisplay} (${admission.roomNumber})`
                                : wardDisplay;
                            })()
                          }</TableCell>
                          <TableCell>{formatDate(admission.admissionDate)}</TableCell>
                          <TableCell>{formatDate(admission.dischargeDate)}</TableCell>
                          <TableCell>
                            <Badge 
                              className={
                                admission.status === 'admitted' 
                                  ? 'bg-green-100 text-green-800' 
                                  : admission.status === 'discharged'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-gray-100 text-gray-800'
                              } 
                              variant="secondary"
                            >
                              {admission.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{
                            (() => {
                              // Calculate days admitted
                              const admissionDate = new Date(admission.admissionDate);
                              const dischargeDate = admission.dischargeDate ? new Date(admission.dischargeDate) : new Date();
                              const daysDiff = Math.ceil((dischargeDate.getTime() - admissionDate.getTime()) / (1000 * 60 * 60 * 24));
                              const totalDays = Math.max(1, daysDiff); // Minimum 1 day
                              
                              return totalDays;
                            })()
                          }</TableCell>
                          <TableCell>{
                            (() => {
                              // Calculate total room cost (only daily charges, no initial deposit)
                              const admissionDate = new Date(admission.admissionDate);
                              const dischargeDate = admission.dischargeDate ? new Date(admission.dischargeDate) : new Date();
                              const daysDiff = Math.ceil((dischargeDate.getTime() - admissionDate.getTime()) / (1000 * 60 * 60 * 24));
                              const totalDays = Math.max(1, daysDiff); // Minimum 1 day
                              const totalRoomCost = totalDays * (admission.dailyCost || 0);
                              
                              return `₹${totalRoomCost.toLocaleString()}`;
                            })()
                          }</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
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
                    // Create timeline events array
                    const timelineEvents = [];
                    
                    // Add registration event
                    timelineEvents.push({
                      id: 'registration',
                      type: 'registration',
                      title: 'Patient Registered',
                      date: patient.createdAt,
                      description: `Patient ID: ${patient.patientId}`,
                      color: 'bg-blue-500'
                    });
                    
                    // Add services
                    if (services && services.length > 0) {
                      services.forEach((service: any) => {
                        // Combine scheduled date and time for timeline
                        const scheduledDateTime = service.scheduledTime 
                          ? `${service.scheduledDate}T${service.scheduledTime}:00`
                          : service.scheduledDate;
                        
                        timelineEvents.push({
                          id: service.id,
                          type: 'service',
                          title: service.serviceName,
                          date: scheduledDateTime,
                          description: `Status: ${service.status}`,
                          color: 'bg-green-500'
                        });
                      });
                    }
                    
                    // Add admissions
                    if (admissions && admissions.length > 0) {
                      admissions.forEach((admission: any) => {
                        timelineEvents.push({
                          id: admission.id,
                          type: 'admission',
                          title: 'Patient Admission',
                          date: admission.createdAt || admission.admissionDate, // Use createdAt for accurate timestamp
                          description: (() => {
                            // Find doctor name and format ward type
                            const doctor = doctors.find((d: Doctor) => d.id === admission.doctorId);
                            const doctorName = doctor ? doctor.name : "No Doctor Assigned";
                            const wardDisplay = admission.wardType;
                            
                            const parts = [];
                            if (admission.reason) parts.push(`Reason: ${admission.reason}`);
                            parts.push(`Doctor: ${doctorName}`);
                            parts.push(`Ward: ${wardDisplay}`);
                            return parts.join(' • ');
                          })(),
                          color: 'bg-orange-500',
                          extraInfo: admission.dischargeDate ? `Discharged: ${new Date(admission.dischargeDate).toLocaleString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true,
                            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                          })}` : null
                        });
                      });
                    }
                    
                    // Add pathology orders
                    if (pathologyOrders && pathologyOrders.length > 0) {
                      pathologyOrders.forEach((orderData: any) => {
                        const order = orderData.order || orderData;
                        if (order && order.orderId) {
                          timelineEvents.push({
                            id: order.id,
                            type: 'pathology',
                            title: `Pathology Order: ${order.orderId}`,
                            date: order.createdAt || order.orderedDate, // Use createdAt for accurate timestamp, fallback to orderedDate
                            description: `Status: ${order.status} • Tests: ${orderData.tests ? orderData.tests.length : 0}`,
                            color: 'bg-purple-500',
                            extraInfo: order.completedDate ? `Completed: ${new Date(order.completedDate).toLocaleString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true,
                              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                            })}` : null
                          });
                        }
                      });
                    }
                    
                    // Sort events chronologically (latest first, most recent at bottom means earliest at top)
                    timelineEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                    
                    return timelineEvents.length > 0 ? timelineEvents.map((event) => (
                      <div key={event.id} className="flex items-start gap-3 p-3 border rounded-lg">
                        <div className={`w-3 h-3 ${event.color} rounded-full mt-1`} />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="font-medium">{event.title}</p>
                            <span className="text-sm text-muted-foreground">
                              {(() => {
                                // Handle UTC timestamps from database properly
                                let date = new Date(event.date);
                                
                                // If the date string doesn't include timezone info (from SQLite),
                                // it needs to be treated as UTC
                                if (typeof event.date === 'string' && !event.date.includes('T') && !event.date.includes('Z')) {
                                  // SQLite datetime format: "YYYY-MM-DD HH:MM:SS" - treat as UTC
                                  date = new Date(event.date + 'Z'); // Add Z to indicate UTC
                                }
                                
                                return date.toLocaleString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  hour12: true,
                                  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedServiceType === "opd" ? "Schedule OPD Consultation" : "Schedule Patient Service"}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={serviceForm.handleSubmit(onServiceSubmit)} className="space-y-4">
            {selectedServiceType !== "opd" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Service Type *</Label>
                  <Select 
                    value={serviceForm.watch("serviceType")}
                    onValueChange={(value) => {
                      serviceForm.setValue("serviceType", value);
                      const serviceType = serviceTypes.find(s => s.value === value);
                      if (serviceType) {
                        serviceForm.setValue("serviceName", serviceType.name);
                        serviceForm.setValue("price", serviceType.price);
                      }
                    }}
                    data-testid="select-service-type"
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select service type" />
                    </SelectTrigger>
                    <SelectContent>
                      {serviceTypes.map((service) => (
                        <SelectItem key={service.value} value={service.value}>
                          <div className="flex items-center gap-2">
                            <service.icon className="h-4 w-4" />
                            {service.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{selectedServiceType === "opd" ? "Consulting Doctor *" : "Doctor"}</Label>
                <Select 
                  value={serviceForm.watch("doctorId")}
                  onValueChange={(value) => serviceForm.setValue("doctorId", value)}
                  data-testid="select-service-doctor"
                >
                  <SelectTrigger>
                    <SelectValue placeholder={selectedServiceType === "opd" ? "Select consulting doctor (required)" : "Select doctor (optional)"} />
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
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Scheduled Date *</Label>
                <Input
                  type="date"
                  {...serviceForm.register("scheduledDate")}
                  data-testid="input-service-date"
                />
              </div>

              <div className="space-y-2">
                <Label>Scheduled Time *</Label>
                <Input
                  type="time"
                  {...serviceForm.register("scheduledTime")}
                  data-testid="input-service-time"
                />
              </div>
            </div>

            {selectedServiceType !== "opd" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Price (₹)</Label>
                  <Input
                    type="number"
                    {...serviceForm.register("price", { valueAsNumber: true })}
                    data-testid="input-service-price"
                  />
                </div>
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
                  serviceForm.reset();
                }}
                data-testid="button-cancel-service"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createServiceMutation.isPending}
                data-testid="button-schedule-service"
                onClick={(e) => {
                  console.log("=== BUTTON CLICKED ===");
                  console.log("Event:", e);
                  console.log("Form valid:", serviceForm.formState.isValid);
                  console.log("Form errors:", serviceForm.formState.errors);
                  console.log("Selected service type:", selectedServiceType);
                  console.log("Form values:", serviceForm.getValues());
                  
                  // If it's an OPD service but no service type is selected, set it
                  if (!selectedServiceType) {
                    console.log("No service type selected, checking service buttons...");
                  }
                  
                  // Prevent default and handle manually if needed
                  if (!selectedServiceType || selectedServiceType !== "opd") {
                    e.preventDefault();
                    console.log("Preventing default submission due to missing service type");
                    
                    // Set service type to OPD and try to submit
                    setSelectedServiceType("opd");
                    serviceForm.setValue("serviceType", "opd");
                    
                    // Manually trigger submission after setting values
                    setTimeout(() => {
                      const formData = serviceForm.getValues();
                      console.log("Manually triggering submission with data:", formData);
                      onServiceSubmit(formData);
                    }, 100);
                  }
                }}
              >
                {createServiceMutation.isPending 
                  ? "Scheduling..." 
                  : selectedServiceType === "opd" 
                    ? "Schedule OPD" 
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
                <Label>Ward Type *</Label>
                <Select 
                  value={admissionForm.watch("wardType")}
                  onValueChange={(value) => admissionForm.setValue("wardType", value)}
                  data-testid="select-ward-type"
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
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Room Number</Label>
                <Input
                  {...roomUpdateForm.register("roomNumber")}
                  placeholder="e.g., 101, A-204"
                  data-testid="input-room-number"
                />
              </div>

              <div className="space-y-2">
                <Label>Admission Date *</Label>
                <Input
                  type="date"
                  {...admissionForm.register("admissionDate")}
                  data-testid="input-admission-date"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Reason for Admission</Label>
              <Input
                {...admissionForm.register("reason")}
                placeholder="Brief reason for admission"
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
              onClick={onDischargePatient}
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
                onValueChange={(value) => roomUpdateForm.setValue("wardType", value)}
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
              <Label>Room Number</Label>
              <Input
                {...roomUpdateForm.register("roomNumber")}
                placeholder="e.g., 101, A-204"
                data-testid="input-update-room-number"
              />
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
    </div>
  );
}