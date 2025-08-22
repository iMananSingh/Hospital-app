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
  Clock
} from "lucide-react";
import { insertPatientServiceSchema, insertAdmissionSchema } from "@shared/schema";
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
  const [selectedServiceType, setSelectedServiceType] = useState<string>("");

  // Fetch patient details
  const { data: patient } = useQuery({
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
  const { data: services } = useQuery({
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
  const { data: admissions } = useQuery({
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
  const { data: pathologyOrders } = useQuery({
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
  });

  // Fetch doctors for service assignment
  const { data: doctors } = useQuery({
    queryKey: ["/api/doctors"],
  });

  const serviceForm = useForm({
    resolver: zodResolver(insertPatientServiceSchema),
    defaultValues: {
      patientId: patientId,
      serviceType: "",
      serviceName: "",
      scheduledDate: new Date().toISOString().split('T')[0],
      doctorId: "",
      notes: "",
      price: 0,
    },
  });

  const admissionForm = useForm({
    resolver: zodResolver(insertAdmissionSchema),
    defaultValues: {
      patientId: patientId,
      doctorId: "",
      wardType: "",
      admissionDate: new Date().toISOString().split('T')[0],
      reason: "",
      diagnosis: "",
      notes: "",
      dailyCost: 0,
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
    const serviceData = {
      ...data,
      serviceId: `SRV-${Date.now()}`,
    };
    createServiceMutation.mutate(serviceData);
  };

  const onAdmissionSubmit = (data: any) => {
    createAdmissionMutation.mutate(data);
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
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
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
        onBack={() => navigate("/patients")}
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
                  setSelectedServiceType("opd");
                  setIsServiceDialogOpen(true);
                }}
                className="flex items-center gap-2"
                data-testid="button-schedule-opd"
              >
                <Stethoscope className="h-4 w-4" />
                Schedule OPD
              </Button>
              <Button 
                onClick={() => setIsAdmissionDialogOpen(true)}
                variant="outline"
                className="flex items-center gap-2"
                data-testid="button-admit-patient"
              >
                <Bed className="h-4 w-4" />
                Admit Patient
              </Button>
              <Button 
                onClick={() => {
                  setSelectedServiceType("labtest");
                  setIsServiceDialogOpen(true);
                }}
                variant="outline"
                className="flex items-center gap-2"
                data-testid="button-order-lab"
              >
                <TestTube className="h-4 w-4" />
                Order Lab Test
              </Button>
              <Button 
                onClick={() => navigate("/pathology")}
                variant="outline"
                className="flex items-center gap-2"
                data-testid="button-pathology-tests"
              >
                <TestTube className="h-4 w-4" />
                View Pathology Tests
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Patient History Tabs */}
        <Tabs defaultValue="services" className="space-y-4">
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
                  onClick={() => setIsServiceDialogOpen(true)}
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
                        <TableHead>Status</TableHead>
                        <TableHead>Price</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {services.map((service: any) => (
                        <TableRow key={service.id}>
                          <TableCell className="font-medium">{service.serviceName}</TableCell>
                          <TableCell>{service.serviceType}</TableCell>
                          <TableCell>{service.doctor?.name || "N/A"}</TableCell>
                          <TableCell>{formatDate(service.scheduledDate)}</TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(service.status)} variant="secondary">
                              {service.status}
                            </Badge>
                          </TableCell>
                          <TableCell>₹{service.price}</TableCell>
                        </TableRow>
                      ))}
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
                <Button
                  onClick={() => setIsAdmissionDialogOpen(true)}
                  size="sm"
                  className="flex items-center gap-2"
                  data-testid="button-add-admission"
                >
                  <Plus className="h-4 w-4" />
                  New Admission
                </Button>
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
                        <TableHead>Total Cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {admissions.map((admission: any) => (
                        <TableRow key={admission.id}>
                          <TableCell className="font-medium">{admission.admissionId}</TableCell>
                          <TableCell>{admission.doctor?.name || "N/A"}</TableCell>
                          <TableCell>{admission.wardType} - {admission.roomNumber}</TableCell>
                          <TableCell>{formatDate(admission.admissionDate)}</TableCell>
                          <TableCell>{formatDate(admission.dischargeDate)}</TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(admission.status)} variant="secondary">
                              {admission.status}
                            </Badge>
                          </TableCell>
                          <TableCell>₹{admission.totalCost}</TableCell>
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
                        const order = orderData.order;
                        return (
                          <TableRow key={order.id}>
                            <TableCell className="font-medium">{order.orderId}</TableCell>
                            <TableCell>{formatDate(order.orderedDate)}</TableCell>
                            <TableCell>
                              <Badge className={getStatusColor(order.status)} variant="secondary">
                                {order.status}
                              </Badge>
                            </TableCell>
                            <TableCell>₹{order.totalPrice}</TableCell>
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
                  <div className="flex items-center gap-4 p-3 border-l-4 border-blue-500 bg-blue-50">
                    <Clock className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="font-medium">Patient Registered</p>
                      <p className="text-sm text-muted-foreground">{formatDate(patient.createdAt)}</p>
                    </div>
                  </div>
                  {/* Add more timeline items based on services, admissions, etc. */}
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
            <DialogTitle>Schedule Patient Service</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={serviceForm.handleSubmit(onServiceSubmit)} className="space-y-4">
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

              <div className="space-y-2">
                <Label>Doctor</Label>
                <Select 
                  value={serviceForm.watch("doctorId")}
                  onValueChange={(value) => serviceForm.setValue("doctorId", value)}
                  data-testid="select-service-doctor"
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select doctor (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No doctor assigned</SelectItem>
                    {(doctors || []).map((doctor: Doctor) => (
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
                <Label>Price (₹)</Label>
                <Input
                  type="number"
                  {...serviceForm.register("price", { valueAsNumber: true })}
                  data-testid="input-service-price"
                />
              </div>
            </div>

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
                onClick={() => setIsServiceDialogOpen(false)}
                data-testid="button-cancel-service"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createServiceMutation.isPending}
                data-testid="button-schedule-service"
              >
                {createServiceMutation.isPending ? "Scheduling..." : "Schedule Service"}
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
                    {(doctors || []).map((doctor: Doctor) => (
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
                    <SelectItem value="general">General Ward</SelectItem>
                    <SelectItem value="private">Private Room</SelectItem>
                    <SelectItem value="icu">ICU</SelectItem>
                    <SelectItem value="emergency">Emergency</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Room Number</Label>
                <Input
                  {...admissionForm.register("roomNumber")}
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
              <Label>Reason for Admission *</Label>
              <Input
                {...admissionForm.register("reason")}
                placeholder="Brief reason for admission"
                data-testid="input-admission-reason"
              />
            </div>

            <div className="space-y-2">
              <Label>Diagnosis</Label>
              <Textarea
                {...admissionForm.register("diagnosis")}
                placeholder="Initial diagnosis..."
                data-testid="textarea-diagnosis"
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
                <Label>Notes</Label>
                <Textarea
                  {...admissionForm.register("notes")}
                  placeholder="Additional notes..."
                  data-testid="textarea-admission-notes"
                />
              </div>
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
    </div>
  );
}