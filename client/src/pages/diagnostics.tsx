import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar, 
  Clock, 
  Search, 
  User, 
  Stethoscope,
  Phone,
  MapPin,
  Filter,
  Eye,
  Heart
} from "lucide-react";
import { Link } from "wouter";
import type { PatientService, Patient, Doctor, Service } from "@shared/schema";

export default function Diagnostics() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedService, setSelectedService] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<string>("");

  // Fetch all patient services
  const { data: patientServices = [], isLoading } = useQuery({
    queryKey: ["/api/patient-services"],
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Fetch patients for service details
  const { data: patients = [] } = useQuery<Patient[]>({
    queryKey: ["/api/patients"],
  });

  // Fetch doctors for filtering
  const { data: doctors = [] } = useQuery<Doctor[]>({
    queryKey: ["/api/doctors"],
  });

  // Fetch all services to get diagnostic services
  const { data: allServices = [] } = useQuery<Service[]>({
    queryKey: ["/api/services"],
  });

  // Filter diagnostic services (radiology category or services with diagnostic-related names)
  const diagnosticServices = useMemo(() => {
    return allServices.filter(service => 
      service.category.toLowerCase() === 'radiology' || 
      service.category.toLowerCase() === 'diagnostic services' ||
      service.category.toLowerCase() === 'diagnostics' ||
      ['ecg', 'usg', 'x-ray', 'xray', 'ultrasound', 'electrocardiogram', 'endoscopy'].some(keyword => 
        service.name.toLowerCase().includes(keyword)
      )
    );
  }, [allServices]);

  // Filter patient services to only diagnostic ones
  const diagnosticPatientServices = useMemo(() => {
    return (patientServices as PatientService[]).filter((service: PatientService) => {
      // Check if the service name or type matches diagnostic services
      return diagnosticServices.some(diagService => 
        diagService.name.toLowerCase() === service.serviceName.toLowerCase() ||
        service.serviceType === 'xray' ||
        service.serviceType === 'ecg' ||
        service.serviceType === 'ultrasound' ||
        service.serviceType === 'diagnostic'
      );
    });
  }, [patientServices, diagnosticServices]);

  // Group diagnostic services by service type
  const diagnosticsByService = useMemo(() => {
    const filtered = diagnosticPatientServices.filter((service: PatientService) => {
      const patient = patients.find(p => p.id === service.patientId);

      const matchesSearch = searchQuery === "" || 
        service.serviceId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        patient?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        patient?.patientId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        patient?.phone?.includes(searchQuery) ||
        service.serviceName?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesDoctor = selectedDoctor === "all" || service.doctorId === selectedDoctor || 
        (selectedDoctor === "external" && !service.doctorId);
      
      const matchesStatus = selectedStatus === "all" || service.status === selectedStatus;
      
      const matchesService = selectedService === "all" || 
        service.serviceName.toLowerCase().includes(selectedService.toLowerCase());
      
      const matchesDate = selectedDate === "" || service.scheduledDate === selectedDate;

      return matchesSearch && matchesDoctor && matchesStatus && matchesService && matchesDate;
    });

    const grouped = filtered.reduce((groups: Record<string, PatientService[]>, service: PatientService) => {
      const serviceName = service.serviceName;
      if (!groups[serviceName]) {
        groups[serviceName] = [];
      }
      groups[serviceName].push(service);
      return groups;
    }, {} as Record<string, PatientService[]>);

    // Sort services within each group by scheduled date (most recent first)
    Object.values(grouped).forEach((services: PatientService[]) => {
      services.sort((a: PatientService, b: PatientService) => {
        const dateA = new Date(`${a.scheduledDate} ${a.scheduledTime}`).getTime();
        const dateB = new Date(`${b.scheduledDate} ${b.scheduledTime}`).getTime();
        return dateB - dateA; // Most recent first
      });
    });

    return grouped;
  }, [diagnosticPatientServices, patients, searchQuery, selectedDoctor, selectedStatus, selectedService, selectedDate]);

  const getDoctorName = (doctorId: string | null) => {
    if (!doctorId) return "External Patient";
    const doctor = doctors.find(d => d.id === doctorId);
    return doctor ? `Dr. ${doctor.name}` : "Unknown Doctor";
  };

  const getPatientDetails = (patientId: string) => {
    return patients.find(p => p.id === patientId);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in-progress':
        return 'bg-blue-100 text-blue-800';
      case 'scheduled':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusDisplayName = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'Ordered';
      case 'in-progress':
        return 'In Progress';
      case 'completed':
        return 'Completed Diagnosis';
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
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

  const formatTime = (timeString: string) => {
    if (!timeString) return "N/A";
    return timeString;
  };

  const totalDiagnosticsCount = diagnosticPatientServices.length;
  // Use Indian timezone (UTC+5:30) for consistent date calculation
  const now = new Date();
  const indianTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
  const today = indianTime.getFullYear() + '-' + 
    String(indianTime.getMonth() + 1).padStart(2, '0') + '-' + 
    String(indianTime.getDate()).padStart(2, '0');
  const todayDiagnosticsCount = diagnosticPatientServices.filter((service: PatientService) => 
    service.scheduledDate === today
  ).length;

  // Get unique service names for the service filter
  const uniqueServiceNames = useMemo(() => {
    const serviceNames = diagnosticServices.map(service => service.name);
    return Array.from(new Set(serviceNames)).sort();
  }, [diagnosticServices]);

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex justify-center items-center h-64">
          <p>Loading diagnostics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Diagnostics</h1>
          <p className="text-muted-foreground">
            Manage and view all diagnostic services by type
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="px-3 py-1">
            <Calendar className="w-4 h-4 mr-1" />
            Today: {todayDiagnosticsCount}
          </Badge>
          <Badge variant="outline" className="px-3 py-1">
            <Heart className="w-4 h-4 mr-1" />
            Total: {totalDiagnosticsCount}
          </Badge>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by service ID, name, patient ID, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="search-diagnostics"
              />
            </div>

            <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
              <SelectTrigger data-testid="filter-doctor">
                <SelectValue placeholder="Filter by doctor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Doctors</SelectItem>
                {doctors.map((doctor: Doctor) => (
                  <SelectItem key={doctor.id} value={doctor.id}>
                    {doctor.name} - {doctor.specialization}
                  </SelectItem>
                ))}
                <SelectItem value="external">External Patients</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger data-testid="filter-status">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="scheduled">Ordered</SelectItem>
                <SelectItem value="in-progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed Diagnosis</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedService} onValueChange={setSelectedService}>
              <SelectTrigger data-testid="filter-service">
                <SelectValue placeholder="Filter by service" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Services</SelectItem>
                {uniqueServiceNames.map((serviceName) => (
                  <SelectItem key={serviceName} value={serviceName}>
                    {serviceName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              data-testid="filter-date"
            />

            <Button 
              variant="outline" 
              onClick={() => {
                setSearchQuery("");
                setSelectedDoctor("all");
                setSelectedStatus("all");
                setSelectedService("all");
                setSelectedDate("");
              }}
              data-testid="clear-filters"
            >
              <Filter className="w-4 h-4 mr-2" />
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Diagnostic Services by Type */}
      {Object.keys(diagnosticsByService).length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Stethoscope className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No diagnostic services found matching your criteria.</p>
            <Link href="/services">
              <Button className="mt-4">Manage Services</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(diagnosticsByService).map(([serviceName, services]) => (
            <Card key={serviceName}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Stethoscope className="w-5 h-5" />
                  {serviceName}
                  <Badge variant="outline">{services.length} services</Badge>
                </CardTitle>
                <CardDescription>
                  Diagnostic services for {serviceName.toLowerCase()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {services.map((service: PatientService) => {
                    const patient = getPatientDetails(service.patientId);
                    const scheduledDate = new Date(service.scheduledDate);

                    return (
                      <div
                        key={service.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <User className="w-4 h-4 text-muted-foreground" />
                              <span className="font-medium">
                                {patient?.name || "Unknown Patient"}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {service.serviceId}
                              </Badge>
                            </div>

                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatDate(service.scheduledDate)}
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatTime(service.scheduledTime)}
                              </div>
                              <div className="flex items-center gap-1">
                                <Stethoscope className="w-3 h-3" />
                                {getDoctorName(service.doctorId)}
                              </div>
                              {patient?.phone && (
                                <div className="flex items-center gap-1">
                                  <Phone className="w-3 h-3" />
                                  {patient.phone}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <Badge 
                            className={getStatusColor(service.status)}
                            variant="secondary"
                            data-testid={`status-${service.id}`}
                          >
                            {getStatusDisplayName(service.status)}
                          </Badge>

                          <div className="text-right">
                            <div className="font-medium">₹{service.price}</div>
                            <div className="text-xs text-muted-foreground">
                              Service Fee
                            </div>
                          </div>

                          <Link href={`/patients/${service.patientId}`}>
                            <Button variant="outline" size="sm" data-testid={`view-patient-${service.id}`}>
                              <Eye className="w-4 h-4" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}