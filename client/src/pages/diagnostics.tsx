import { useState, useMemo, Fragment } from "react";
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
import TopBar from "@/components/layout/topbar";

export default function Diagnostics() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedService, setSelectedService] = useState<string>("all");
  const [selectedFromDate, setSelectedFromDate] = useState<string>("");
  const [selectedToDate, setSelectedToDate] = useState<string>("");

  // Fetch server's today date for consistent timezone handling
  const { data: todayData } = useQuery<{ today: string }>({
    queryKey: ["/api/today"],
  });
  const today = todayData?.today || "";

  // Fetch all patient services
  const { data: patientServices = [], isLoading } = useQuery({
    queryKey: ["/api/patient-services"],
    refetchInterval: 5000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
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
        service.serviceName.toLowerCase() === selectedService.toLowerCase();

      const matchesDateRange = (() => {
        if (!selectedFromDate && !selectedToDate) return true;
        const serviceDate = service.scheduledDate;
        if (!serviceDate) return false;
        
        if (selectedFromDate && selectedToDate) {
          return serviceDate >= selectedFromDate && serviceDate <= selectedToDate;
        } else if (selectedFromDate) {
          return serviceDate >= selectedFromDate;
        } else if (selectedToDate) {
          return serviceDate <= selectedToDate;
        }
        return true;
      })();

      return matchesSearch && matchesDoctor && matchesStatus && matchesService && matchesDateRange;
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
        return dateB - dateA;
      });
    });

    return grouped;
  }, [diagnosticPatientServices, patients, searchQuery, selectedDoctor, selectedStatus, selectedService, selectedFromDate, selectedToDate]);

  const getDoctorName = (doctorId: string | null) => {
    if (!doctorId) return "External Patient";
    const doctor = doctors.find(d => d.id === doctorId);
    return doctor ? `Dr. ${doctor.name}` : "Unknown Doctor";
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
    const d = new Date(dateString);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return "N/A";
    return timeString;
  };

  const totalDiagnosticsCount = diagnosticPatientServices.length;
  const todayDiagnosticsCount = today 
    ? diagnosticPatientServices.filter((service: PatientService) => service.scheduledDate === today).length 
    : 0;

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
    <>
      <div className="h-full">
        <TopBar 
          title="Diagnostics"
          showDateFilter={true}
          fromDate={selectedFromDate}
          toDate={selectedToDate}
          onFromDateChange={setSelectedFromDate}
          onToDateChange={setSelectedToDate}
        />
        <div className="flex flex-col h-[calc(100%-84px)] pb-[24px] pt-[16px] pl-[24px] pr-[24px]">
          <Card className="flex flex-col h-full overflow-hidden rounded-b-md pl-[24px] pr-[24px]">
            {/* Fixed Header Section */}
            <div className="container mx-auto px-6 pt-6 pb-0 flex-shrink-0 pl-[0px] pr-[0px]">
              <div className="flex justify-between items-center mb-6 pl-[15px] pr-[15px]">
                <div>
                  <p className="text-muted-foreground">
                    Manage and view all diagnostic services
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge className="inline-flex items-center rounded-full border text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 px-3 py-1 bg-[#f6760a] text-[#ffffff]">
                    <Calendar className="w-4 h-4 mr-1" />
                    Today: {todayDiagnosticsCount}
                  </Badge>
                  <Badge className="inline-flex items-center rounded-full border text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 px-3 py-1 bg-[#f6760a] text-[#ffffff]">
                    <Heart className="w-4 h-4 mr-1" />
                    Total: {totalDiagnosticsCount}
                  </Badge>
                </div>
              </div>

              {/* Filter Card - Fixed */}
              <Card className="rounded-b-none">
                <CardContent className="p-4 border-b bg-[#f6760a]/20 rounded-t-lg">
                  <div className="flex gap-4 items-center flex-wrap">
                    <div className="relative flex-grow min-w-[200px]">
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
                      <SelectTrigger data-testid="filter-doctor" className="w-64">
                        <SelectValue placeholder="Doctor" />
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
                      <SelectTrigger data-testid="filter-status" className="w-36">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="scheduled">Ordered</SelectItem>
                        <SelectItem value="in-progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed Diagnosis</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={selectedService} onValueChange={setSelectedService}>
                      <SelectTrigger data-testid="filter-service" className="w-28">
                        <SelectValue placeholder="Service" />
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

                    <Button 
                      variant="outline"
                      onClick={() => {
                        setSearchQuery("");
                        setSelectedDoctor("all");
                        setSelectedStatus("all");
                        setSelectedService("all");
                        setSelectedFromDate("");
                        setSelectedToDate("");
                      }}
                      data-testid="clear-filters"
                    >
                      <Filter className="w-4 h-4 mr-2" />
                      Clear
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto pb-[24px] ml-[0px] mr-[0px] scrollbar-blue">
              {Object.keys(diagnosticsByService).length === 0 ? (
                <div className="container mx-auto px-6 py-8 text-center">
                  <Stethoscope className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No diagnostic services found matching your criteria.</p>
                  <Link href="/services">
                    <Button className="mt-4">Manage Services</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(diagnosticsByService).map(([serviceName, services]) => (
                    <div key={serviceName} className="px-6">
                      <div className="mb-4">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                          <Stethoscope className="w-5 h-5" />
                          {serviceName}
                          <Badge variant="outline">{services.length} services</Badge>
                        </h3>
                      </div>
                      <div className="space-y-2">
                        {services.map((service: PatientService) => {
                          const patient = patients.find(p => p.id === service.patientId);
                          return (
                            <div
                              key={service.id}
                              className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                            >
                              <div className="flex items-center gap-4 flex-1">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
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

                                <div className="text-right min-w-[80px]">
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
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
