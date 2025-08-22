import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Calendar, 
  Clock, 
  Search, 
  User, 
  Stethoscope,
  Phone,
  MapPin,
  Filter
} from "lucide-react";
import { Link } from "wouter";
import type { PatientService, Patient, Doctor } from "@shared/schema";

export default function OpdList() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<string>("");

  // Fetch all OPD services
  const { data: opdServices = [], isLoading } = useQuery<PatientService[]>({
    queryKey: ["/api/patient-services", "opd"],
    queryFn: async () => {
      const response = await fetch("/api/patient-services?serviceType=opd", {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch OPD services");
      return response.json();
    },
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

  // Group OPD services by doctor
  const opdServicesByDoctor = useMemo(() => {
    const filtered = opdServices.filter(service => {
      const matchesSearch = searchQuery === "" || 
        patients.find(p => p.id === service.patientId)?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        patients.find(p => p.id === service.patientId)?.patientId.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesDoctor = selectedDoctor === "all" || service.doctorId === selectedDoctor;
      const matchesStatus = selectedStatus === "all" || service.status === selectedStatus;
      const matchesDate = selectedDate === "" || service.scheduledDate === selectedDate;

      return matchesSearch && matchesDoctor && matchesStatus && matchesDate;
    });

    const grouped = filtered.reduce((groups, service) => {
      const doctorId = service.doctorId || "unassigned";
      if (!groups[doctorId]) {
        groups[doctorId] = [];
      }
      groups[doctorId].push(service);
      return groups;
    }, {} as Record<string, PatientService[]>);

    // Sort services within each doctor group by scheduled date and time
    Object.values(grouped).forEach(services => {
      services.sort((a, b) => {
        const dateCompare = new Date(`${a.scheduledDate}T${a.scheduledTime || '00:00'}`).getTime() - 
                           new Date(`${b.scheduledDate}T${b.scheduledTime || '00:00'}`).getTime();
        return dateCompare;
      });
    });

    return grouped;
  }, [opdServices, patients, searchQuery, selectedDoctor, selectedStatus, selectedDate]);

  const getDoctorName = (doctorId: string) => {
    if (doctorId === "unassigned") return "Unassigned";
    const doctor = doctors.find(d => d.id === doctorId);
    return doctor ? `Dr. ${doctor.name}` : "Unknown Doctor";
  };

  const getDoctorSpecialization = (doctorId: string) => {
    if (doctorId === "unassigned") return "No specialization";
    const doctor = doctors.find(d => d.id === doctorId);
    return doctor?.specialization || "Unknown";
  };

  const getPatientDetails = (patientId: string) => {
    return patients.find(p => p.id === patientId);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "scheduled": return "default";
      case "in-progress": return "secondary";
      case "completed": return "default";
      case "cancelled": return "destructive";
      default: return "outline";
    }
  };

  const totalOpdCount = opdServices.length;
  const todayOpdCount = opdServices.filter(service => 
    service.scheduledDate === new Date().toISOString().split('T')[0]
  ).length;

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex justify-center items-center h-64">
          <p>Loading OPD appointments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">OPD Appointments</h1>
          <p className="text-muted-foreground">
            Manage and view all OPD consultations by doctor
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="px-3 py-1">
            <Calendar className="w-4 h-4 mr-1" />
            Today: {todayOpdCount}
          </Badge>
          <Badge variant="outline" className="px-3 py-1">
            <User className="w-4 h-4 mr-1" />
            Total: {totalOpdCount}
          </Badge>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search patients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="search-opd-patients"
              />
            </div>
            
            <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
              <SelectTrigger data-testid="filter-doctor">
                <SelectValue placeholder="Filter by doctor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Doctors</SelectItem>
                {doctors.map(doctor => (
                  <SelectItem key={doctor.id} value={doctor.id}>
                    Dr. {doctor.name}
                  </SelectItem>
                ))}
                <SelectItem value="unassigned">Unassigned</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger data-testid="filter-status">
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

      {/* OPD Services by Doctor */}
      {Object.keys(opdServicesByDoctor).length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Stethoscope className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No OPD appointments found matching your criteria.</p>
            <Link href="/patients">
              <Button className="mt-4">Schedule New OPD</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(opdServicesByDoctor).map(([doctorId, services]) => (
            <Card key={doctorId}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Stethoscope className="w-5 h-5" />
                  {getDoctorName(doctorId)}
                  <Badge variant="outline">{services.length} patients</Badge>
                </CardTitle>
                <CardDescription>
                  {getDoctorSpecialization(doctorId)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {services.map(service => {
                    const patient = getPatientDetails(service.patientId);
                    const scheduledDateTime = new Date(`${service.scheduledDate}T${service.scheduledTime || '00:00'}`);
                    
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
                                {patient?.patientId || "N/A"}
                              </Badge>
                            </div>
                            
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {scheduledDateTime.toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric'
                                })}
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {scheduledDateTime.toLocaleTimeString('en-US', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
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
                            variant={getStatusBadgeVariant(service.status)}
                            data-testid={`status-${service.id}`}
                          >
                            {service.status.charAt(0).toUpperCase() + service.status.slice(1)}
                          </Badge>
                          
                          <div className="text-right">
                            <div className="font-medium">₹{service.price}</div>
                            <div className="text-xs text-muted-foreground">
                              Consultation Fee
                            </div>
                          </div>
                          
                          <Link href={`/patients/${service.patientId}`}>
                            <Button variant="outline" size="sm" data-testid={`view-patient-${service.id}`}>
                              View
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