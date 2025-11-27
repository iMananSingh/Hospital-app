import { useState, useMemo, Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
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
  Filter,
  Eye,
  Heart,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Link } from "wouter";
import type { PatientService, Patient, Doctor, Service } from "@shared/schema";
import TopBar from "@/components/layout/topbar";

export default function Diagnostics() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedFromDate, setSelectedFromDate] = useState<string>("");
  const [selectedToDate, setSelectedToDate] = useState<string>("");
  const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set());

  const toggleServiceSection = (serviceName: string) => {
    const newExpanded = new Set(expandedServices);
    if (newExpanded.has(serviceName)) {
      newExpanded.delete(serviceName);
    } else {
      newExpanded.add(serviceName);
    }
    setExpandedServices(newExpanded);
  };

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

      return matchesSearch && matchesDoctor && matchesStatus && matchesDateRange;
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
  }, [diagnosticPatientServices, patients, searchQuery, selectedDoctor, selectedStatus, selectedFromDate, selectedToDate]);

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
                            {doctor.name}
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

                    <Button 
                      variant="outline"
                      onClick={() => {
                        setSearchQuery("");
                        setSelectedDoctor("all");
                        setSelectedStatus("all");
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
                <Card className="border bg-card text-card-foreground shadow-sm rounded-none rounded-b-md mt-[0px] mb-[0px] p-0 ml-[0px] mr-[0px] overflow-hidden">
                  <div className="overflow-x-auto w-full h-full">
                    <table className="w-full">
                      <tbody>
                        {Object.entries(diagnosticsByService).map(([serviceName, services]) => {
                          let rowNumber = 1;
                          return (
                            <Fragment key={serviceName}>
                              {/* Service Section Header - Collapsible */}
                              <tr>
                                <td colSpan={9} className="px-4 py-3 bg-blue-100 cursor-pointer hover:bg-blue-200 transition-colors" onClick={() => toggleServiceSection(serviceName)}>
                                  <div className="flex items-center gap-2 justify-between">
                                    <div className="flex items-center gap-2">
                                      {expandedServices.has(serviceName) ? (
                                        <ChevronDown className="w-5 h-5 text-blue-900 flex-shrink-0" />
                                      ) : (
                                        <ChevronRight className="w-5 h-5 text-blue-900 flex-shrink-0" />
                                      )}
                                      <span className="font-semibold text-lg text-blue-900">
                                        {serviceName}
                                      </span>
                                    </div>
                                    <Badge className="inline-flex items-center rounded-full border px-2.5 py-0.5 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-xs bg-[#0D71C9] text-[#ffffff] pl-[12px] pr-[12px] pt-[4px] pb-[4px]">
                                      {(services as any[]).length} services
                                    </Badge>
                                  </div>
                                </td>
                              </tr>
                              {/* Table Header and Rows - Show only when expanded */}
                              {expandedServices.has(serviceName) && (
                                <>
                                  {/* Table Header for this Service Section */}
                                  <tr className="border-b" style={{ backgroundColor: '#f7f7f7' }}>
                                    <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: '#6C757F', width: 'auto' }}>S.No</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold w-24" style={{ color: '#6C757F' }}>Date</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold w-16" style={{ color: '#6C757F' }}>Time</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold flex-grow min-w-48" style={{ color: '#6C757F' }}>Patient Name</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold w-20" style={{ color: '#6C757F' }}>Sex/Age</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold w-32" style={{ color: '#6C757F' }}>Contact</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold w-32" style={{ color: '#6C757F' }}>Doctor</th>
                                    <th className="px-4 py-3 text-right text-sm font-semibold w-24" style={{ color: '#6C757F' }}>Fee</th>
                                    <th className="px-4 py-3 text-center text-sm font-semibold w-12" style={{ color: '#6C757F' }}>View</th>
                                  </tr>
                                  {/* Service Rows */}
                                  {(services as any[]).map((service: PatientService) => {
                                    const patient = patients.find(p => p.id === service.patientId);
                                    return (
                                      <tr key={service.id} className="border-b hover:bg-muted/50 transition-colors">
                                        <td className="px-4 py-3 text-sm whitespace-nowrap">{rowNumber++}</td>
                                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                                          {formatDate(service.scheduledDate)}
                                        </td>
                                        <td className="px-4 py-3 text-sm whitespace-nowrap">{formatTime(service.scheduledTime)}</td>
                                        <td className="px-4 py-3 text-sm">
                                          <div className="font-medium">{patient?.name || 'Unknown'}</div>
                                          <div className="text-xs text-muted-foreground">{patient?.patientId || 'N/A'}</div>
                                        </td>
                                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                                          {patient?.gender ? patient.gender.charAt(0).toUpperCase() : '-'}/{patient?.age || '-'}
                                        </td>
                                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                                          {patient?.phone || 'N/A'}
                                        </td>
                                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                                          {getDoctorName(service.doctorId)}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-right whitespace-nowrap">
                                          ₹{service.price}
                                        </td>
                                        <td className="px-4 py-3 text-center whitespace-nowrap">
                                          <Link href={`/patients/${service.patientId}`}>
                                            <Button variant="ghost" size="icon" data-testid={`view-patient-${service.id}`}>
                                              <Eye className="w-4 h-4" />
                                            </Button>
                                          </Link>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </>
                              )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
