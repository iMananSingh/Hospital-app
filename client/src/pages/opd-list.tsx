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
import TopBar from "@/components/layout/topbar";
import type { PatientService, Patient, Doctor } from "@shared/schema";

export default function OpdList() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<string>("");

  // Fetch all OPD visits
  const { data: opdServices = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/opd-visits"],
    queryFn: async () => {
      const response = await fetch("/api/opd-visits", {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch OPD visits");
      return response.json();
    },
  });

  // Fetch doctors for filtering
  const { data: doctors = [] } = useQuery<Doctor[]>({
    queryKey: ["/api/doctors"],
  });

  // Group OPD visits by doctor
  const opdServicesByDoctor = useMemo(() => {
    const filtered = opdServices.filter(visit => {
      // Data already includes patient and doctor info from the join
      const matchesSearch = searchQuery === "" || 
        visit.patientName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        visit.patientPatientId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        visit.patientPhone?.includes(searchQuery);

      const matchesDoctor = selectedDoctor === "all" || visit.doctorId === selectedDoctor;
      const matchesStatus = selectedStatus === "all" || visit.status === selectedStatus;
      const matchesDate = selectedDate === "" || visit.scheduledDate === selectedDate;

      return matchesSearch && matchesDoctor && matchesStatus && matchesDate;
    });

    const grouped = filtered.reduce((groups, visit) => {
      const doctorId = visit.doctorId || "unassigned";
      if (!groups[doctorId]) {
        groups[doctorId] = [];
      }
      groups[doctorId].push(visit);
      return groups;
    }, {} as Record<string, any[]>);

    // Sort visits within each doctor group by scheduled date and time
    Object.values(grouped).forEach((visits) => {
      (visits as any[]).sort((a: any, b: any) => {
        const dateCompare = new Date(`${a.scheduledDate}T${a.scheduledTime || '00:00'}`).getTime() - 
                           new Date(`${b.scheduledDate}T${b.scheduledTime || '00:00'}`).getTime();
        return dateCompare;
      });
    });

    return grouped;
  }, [opdServices, searchQuery, selectedDoctor, selectedStatus, selectedDate]);

  const getDoctorName = (doctorId: string, visit?: any) => {
    if (doctorId === "unassigned") return "Unassigned";
    // Use joined data if available, fallback to doctors array
    if (visit?.doctorName) return visit.doctorName;
    const doctor = doctors.find(d => d.id === doctorId);
    return doctor ? doctor.name : "Unknown Doctor";
  };

  const getDoctorSpecialization = (doctorId: string, visit?: any) => {
    if (doctorId === "unassigned") return "No specialization";
    // Use joined data if available, fallback to doctors array
    if (visit?.doctorSpecialization) return visit.doctorSpecialization;
    const doctor = doctors.find(d => d.id === doctorId);
    return doctor?.specialization || "Unknown";
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
  // Use Indian timezone (UTC+5:30) for consistent date calculation
  const now = new Date();
  const indianTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
  const today = indianTime.getFullYear() + '-' + 
    String(indianTime.getMonth() + 1).padStart(2, '0') + '-' + 
    String(indianTime.getDate()).padStart(2, '0');
  
  const todayOpdCount = opdServices.filter(visit => 
    visit.scheduledDate === today
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
    <>
      <TopBar title="OPD Appointments" />
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
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
                placeholder="Search by name, ID, or phone..."
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
                    {doctor.name}
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
        <div>
          {Object.entries(opdServicesByDoctor).map(([doctorId, services]) => (
            <Card key={doctorId}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Stethoscope className="w-5 h-5" />
                  {getDoctorName(doctorId)}
                  <Badge variant="outline">{(services as any[]).length} patients</Badge>
                </CardTitle>
                <CardDescription>
                  {getDoctorSpecialization(doctorId)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(services as any[]).map((visit: any) => {
                    return (
                      <div
                        key={visit.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <User className="w-4 h-4 text-muted-foreground" />
                              <span className="font-medium">
                                {visit.patientName || "Unknown Patient"}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {visit.patientPatientId || "N/A"}
                              </Badge>
                            </div>

                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {visit.scheduledDate ? new Date(visit.scheduledDate).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric'
                                }) : 'N/A'}
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {visit.scheduledTime || 'N/A'}
                              </div>
                              {visit.patientPhone && (
                                <div className="flex items-center gap-1">
                                  <Phone className="w-3 h-3" />
                                  {visit.patientPhone}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <Badge 
                            variant={getStatusBadgeVariant(visit.status)}
                            data-testid={`status-${visit.id}`}
                          >
                            {visit.status.charAt(0).toUpperCase() + visit.status.slice(1)}
                          </Badge>

                          <div className="text-right">
                            <div className="font-medium">
                              ₹{visit.consultationFee ?? visit.doctorConsultationFee ?? 0}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Consultation Fee
                            </div>
                          </div>

                          <Link href={`/patients/${visit.patientId}`}>
                            <Button variant="outline" size="sm" data-testid={`view-patient-${visit.id}`}>
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
    </>
  );
}