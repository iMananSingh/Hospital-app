
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
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
import {
  Heart,
  Plus,
  Search,
  Calendar,
  Clock,
  User,
  Eye,
  CheckCircle,
  XCircle,
  AlertCircle
} from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import type { Service, PatientService, Patient, Doctor } from "@shared/schema";

export default function Diagnostics() {
  const { toast } = useToast();
  const [isServiceDialogOpen, setIsServiceDialogOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");

  // Fetch diagnostic services (category = "diagnostics")
  const { data: allServices = [], isLoading: servicesLoading } = useQuery<Service[]>({
    queryKey: ["/api/services"],
  });

  // Filter to get only diagnostic services
  const diagnosticServices = allServices.filter(service => 
    service.category === "diagnostics" && service.isActive
  );

  // Fetch all diagnostic patient services
  const { data: allPatientServices = [], isLoading: patientServicesLoading } = useQuery<PatientService[]>({
    queryKey: ["/api/patient-services"],
  });

  // Filter to get only diagnostic patient services
  const diagnosticPatientServices = allPatientServices.filter(ps => 
    ps.serviceType === "diagnostics" || 
    diagnosticServices.some(ds => ds.id === ps.serviceId || ds.name === ps.serviceName)
  );

  // Fetch patients and doctors for service details
  const { data: patients = [] } = useQuery<Patient[]>({
    queryKey: ["/api/patients"],
  });

  const { data: doctors = [] } = useQuery<Doctor[]>({
    queryKey: ["/api/doctors"],
  });

  const serviceForm = useForm({
    defaultValues: {
      patientId: "",
      serviceId: "",
      serviceName: "",
      scheduledDate: "",
      scheduledTime: "09:00",
      doctorId: "",
      notes: "",
      price: 0,
    },
  });

  // Create patient service mutation
  const createPatientServiceMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/patient-services", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create diagnostic service");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-services"] });
      setIsServiceDialogOpen(false);
      serviceForm.reset();
      toast({
        title: "Success",
        description: "Diagnostic service scheduled successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to schedule diagnostic service",
        variant: "destructive",
      });
    },
  });

  // Update service status mutation
  const updateServiceMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const response = await fetch(`/api/patient-services/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update service");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-services"] });
      toast({
        title: "Success",
        description: "Service updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update service",
        variant: "destructive",
      });
    },
  });

  const onServiceSubmit = (data: any) => {
    if (!selectedService) return;

    // Generate receipt number
    const now = new Date();
    const dateStr = now.toISOString().slice(2, 10).replace(/-/g, '');
    const timeStr = now.getTime().toString().slice(-4);
    const receiptNumber = `${dateStr}-DIG-${timeStr}`;

    const serviceData = {
      ...data,
      serviceId: selectedService.id,
      serviceName: selectedService.name,
      serviceType: "diagnostics",
      price: selectedService.price,
      receiptNumber,
      status: "scheduled",
    };

    createPatientServiceMutation.mutate(serviceData);
  };

  const openServiceDialog = (service: Service) => {
    setSelectedService(service);
    const now = new Date();
    const currentDate = now.getFullYear() + '-' + 
      String(now.getMonth() + 1).padStart(2, '0') + '-' + 
      String(now.getDate()).padStart(2, '0');
    const currentTime = String(now.getHours()).padStart(2, '0') + ':' + 
      String(now.getMinutes()).padStart(2, '0');

    serviceForm.reset({
      patientId: "",
      serviceId: service.id,
      serviceName: service.name,
      scheduledDate: currentDate,
      scheduledTime: currentTime,
      doctorId: "",
      notes: "",
      price: service.price,
    });
    setIsServiceDialogOpen(true);
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
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "N/A";
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short", 
      day: "numeric",
    });
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return "N/A";
    return timeString;
  };

  // Filter patient services based on search and filters
  const filteredPatientServices = diagnosticPatientServices.filter(service => {
    const patient = patients.find(p => p.id === service.patientId);
    const doctor = doctors.find(d => d.id === service.doctorId);
    
    const matchesSearch = searchQuery === "" || 
      patient?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      patient?.patientId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      service.serviceName.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || service.status === statusFilter;
    const matchesDate = dateFilter === "" || service.scheduledDate === dateFilter;

    return matchesSearch && matchesStatus && matchesDate;
  });

  const updateServiceStatus = (serviceId: string, newStatus: string) => {
    const updateData = { status: newStatus };
    if (newStatus === 'completed') {
      updateData.completedDate = new Date().toISOString().split('T')[0];
    }
    updateServiceMutation.mutate({ id: serviceId, ...updateData });
  };

  if (servicesLoading || patientServicesLoading) {
    return (
      <div className="space-y-6">
        <TopBar title="Diagnostic Services" />
        <div className="p-6">
          <div className="flex items-center justify-center h-64">
            Loading diagnostic services...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <TopBar title="Diagnostic Services" />

      <div className="p-6 space-y-6">
        {/* Available Diagnostic Services */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5" />
              Available Diagnostic Services
            </CardTitle>
          </CardHeader>
          <CardContent>
            {diagnosticServices.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {diagnosticServices.map((service) => (
                  <div key={service.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium">{service.name}</h3>
                      <span className="text-lg font-semibold text-green-600">
                        ₹{service.price}
                      </span>
                    </div>
                    {service.description && (
                      <p className="text-sm text-muted-foreground mb-3">{service.description}</p>
                    )}
                    <Button
                      onClick={() => openServiceDialog(service)}
                      className="w-full"
                      size="sm"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Schedule Service
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Heart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No diagnostic services available</p>
                <p className="text-sm text-gray-400 mt-2">
                  Add diagnostic services in Service Management to see them here
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Scheduled Diagnostic Services */}
        <Card>
          <CardHeader className="space-y-4">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Scheduled Diagnostic Services
            </CardTitle>
            
            {/* Filters */}
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-64">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search by patient name, ID, or service..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-48"
                placeholder="Filter by date"
              />
            </div>
          </CardHeader>
          <CardContent>
            {filteredPatientServices.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Doctor</TableHead>
                    <TableHead>Scheduled</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPatientServices.map((service) => {
                    const patient = patients.find(p => p.id === service.patientId);
                    const doctor = doctors.find(d => d.id === service.doctorId);
                    
                    return (
                      <TableRow key={service.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{patient?.name || "Unknown"}</div>
                            <div className="text-sm text-muted-foreground">
                              {patient?.patientId || "N/A"}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{service.serviceName}</TableCell>
                        <TableCell>{doctor?.name || "Not assigned"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            {formatDate(service.scheduledDate)}
                            <Clock className="h-4 w-4 ml-2" />
                            {formatTime(service.scheduledTime)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(service.status)} variant="secondary">
                            {service.status.charAt(0).toUpperCase() + service.status.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell>₹{service.price}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {service.status === 'scheduled' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => updateServiceStatus(service.id, 'in-progress')}
                                >
                                  <AlertCircle className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => updateServiceStatus(service.id, 'completed')}
                                  className="text-green-600 hover:text-green-700"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            {service.status === 'in-progress' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateServiceStatus(service.id, 'completed')}
                                className="text-green-600 hover:text-green-700"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            )}
                            <Link href={`/patients/${service.patientId}`}>
                              <Button size="sm" variant="outline">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No diagnostic services scheduled</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Schedule Service Dialog */}
        <Dialog open={isServiceDialogOpen} onOpenChange={setIsServiceDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                Schedule {selectedService?.name}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={serviceForm.handleSubmit(onServiceSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Patient *</Label>
                  <Select
                    value={serviceForm.watch("patientId")}
                    onValueChange={(value) => serviceForm.setValue("patientId", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select patient" />
                    </SelectTrigger>
                    <SelectContent>
                      {patients.map((patient) => (
                        <SelectItem key={patient.id} value={patient.id}>
                          {patient.name} ({patient.patientId})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Doctor (Optional)</Label>
                  <Select
                    value={serviceForm.watch("doctorId")}
                    onValueChange={(value) => serviceForm.setValue("doctorId", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select doctor (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No doctor assigned</SelectItem>
                      {doctors.map((doctor) => (
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
                  />
                </div>

                <div className="space-y-2">
                  <Label>Scheduled Time *</Label>
                  <Input
                    type="time"
                    {...serviceForm.register("scheduledTime")}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  {...serviceForm.register("notes")}
                  placeholder="Additional notes for this service"
                  rows={3}
                />
              </div>

              {selectedService && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Service: {selectedService.name}</span>
                    <span className="text-lg font-semibold">₹{selectedService.price}</span>
                  </div>
                  {selectedService.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {selectedService.description}
                    </p>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsServiceDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createPatientServiceMutation.isPending}
                >
                  {createPatientServiceMutation.isPending
                    ? "Scheduling..."
                    : "Schedule Service"
                  }
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
