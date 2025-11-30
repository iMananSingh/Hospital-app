import { useState, useMemo, Fragment } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
  Filter,
  Eye,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Link } from "wouter";
import TopBar from "@/components/layout/topbar";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { PatientService, Patient, Doctor } from "@shared/schema";

export default function OpdList() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedFromDate, setSelectedFromDate] = useState<string>("");
  const [selectedToDate, setSelectedToDate] = useState<string>("");
  const [expandedDoctors, setExpandedDoctors] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const toggleDoctorSection = (doctorId: string) => {
    const newExpanded = new Set(expandedDoctors);
    if (newExpanded.has(doctorId)) {
      newExpanded.delete(doctorId);
    } else {
      newExpanded.add(doctorId);
    }
    setExpandedDoctors(newExpanded);
  };

  // Helper function to determine which statuses are enabled for current status
  const getEnabledStatuses = (currentStatus: string): Set<string> => {
    const workflows: Record<string, Set<string>> = {
      scheduled: new Set(["cancelled"]), // paid is automatic
      paid: new Set(["completed", "cancelled"]),
      completed: new Set(["referred", "admitted"]),
      referred: new Set([]),
      cancelled: new Set([]),
      admitted: new Set([]),
    };
    return workflows[currentStatus] || new Set([]);
  };

  // Mutation for updating OPD visit status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ visitId, status }: { visitId: string; status: string }) => {
      const response = await fetch(`/api/opd-visits/${visitId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
        },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error("Failed to update status");
      return response.json();
    },
    onSuccess: () => {
      toast({ description: "Status updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/opd-visits"] });
    },
    onError: () => {
      toast({ description: "Failed to update status", variant: "destructive" });
    },
  });

  // Fetch server's today date for consistent timezone handling
  const { data: todayData } = useQuery<{ today: string }>({
    queryKey: ["/api/today"],
  });
  const today = todayData?.today || "";

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
      
      // Check if date is within the selected range
      let matchesDate = true;
      if (selectedFromDate || selectedToDate) {
        const visitDate = visit.scheduledDate;
        if (selectedFromDate && visitDate < selectedFromDate) matchesDate = false;
        if (selectedToDate && visitDate > selectedToDate) matchesDate = false;
      }

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
  }, [opdServices, searchQuery, selectedDoctor, selectedStatus, selectedFromDate, selectedToDate]);

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "in-progress":
        return "bg-blue-100 text-blue-800";
      case "paid":
        return "bg-blue-50 text-blue-800";
      case "scheduled":
        return "bg-[#FFEDD5] text-orange-800";
      case "referred":
        return "bg-purple-100 text-purple-800";
      case "admitted":
        return "bg-green-100 text-green-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const totalOpdCount = opdServices.length;
  const todayOpdCount = today 
    ? opdServices.filter(visit => visit.scheduledDate === today).length 
    : 0;

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
      <div className="h-full">
        <TopBar 
          title="OPD Appointments" 
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
            <div className="flex justify-between items-center mb-6 pl-[16px] pr-[16px]">
              <div>
                <p className="text-muted-foreground">
                  Manage and view all OPD consultations by doctor
                </p>
              </div>
              <div className="flex gap-2">
                <Badge className="inline-flex items-center rounded-full border text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 px-3 py-1 bg-[#f6760a] text-[#ffffff]">
                  <Calendar className="w-4 h-4 mr-1" />
                  Today: {todayOpdCount}
                </Badge>
                <Badge className="inline-flex items-center rounded-full border text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 px-3 py-1 bg-[#f6760a] text-[#ffffff]">
                  <User className="w-4 h-4 mr-1" />
                  Total: {totalOpdCount}
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
                      placeholder="Search by name, ID, or phone..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                      data-testid="search-opd-patients"
                    />
                  </div>

                  <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
                    <SelectTrigger data-testid="filter-doctor" className="w-64">
                      <SelectValue placeholder="Doctor" />
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
                    <SelectTrigger data-testid="filter-status" className="w-36">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="referred">Referred</SelectItem>
                      <SelectItem value="admitted">Admitted</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
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

          {/* Scrollable Table Content */}
          <div className="flex-1 overflow-y-auto pb-[24px] ml-[0px] mr-[0px] scrollbar-blue">
          {Object.keys(opdServicesByDoctor).length === 0 ? (
            <div className="container mx-auto px-6 py-8 text-center">
              <Stethoscope className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No OPD appointments found matching your criteria.</p>
              <Link href="/patients">
                <Button className="mt-4">Schedule New OPD</Button>
              </Link>
            </div>
          ) : (
            <Card className="border bg-card text-card-foreground shadow-sm rounded-none rounded-b-md mt-[0px] mb-[0px] p-0 ml-[0px] mr-[0px] overflow-hidden">
              <div className="overflow-x-auto w-full h-full">
                <table className="w-full">
                  <tbody>
                    {Object.entries(opdServicesByDoctor).map(([doctorId, services], doctorIndex) => {
                      let rowNumber = 1;
                      return (
                        <Fragment key={doctorId}>
                          {/* Doctor Section Header - Collapsible */}
                          <tr className={doctorIndex > 0 ? "border-t-2" : ""}>
                            <td colSpan={10} className="px-4 py-3 bg-blue-100 cursor-pointer hover:bg-blue-200 transition-colors w-full" onClick={() => toggleDoctorSection(doctorId)}>
                              <div className="flex items-center gap-2 justify-between">
                                <div className="flex items-center gap-2">
                                  {expandedDoctors.has(doctorId) ? (
                                    <ChevronDown className="w-5 h-5 text-blue-900 flex-shrink-0" />
                                  ) : (
                                    <ChevronRight className="w-5 h-5 text-blue-900 flex-shrink-0" />
                                  )}
                                  <span className="font-semibold text-lg text-blue-900">
                                    {getDoctorName(doctorId)}
                                  </span>
                                  <span className="text-sm text-blue-600">
                                    • {getDoctorSpecialization(doctorId)}
                                  </span>
                                </div>
                                <Badge className="inline-flex items-center rounded-full border px-2.5 py-0.5 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-xs bg-[#0D71C9] text-[#ffffff] pl-[12px] pr-[12px] pt-[4px] pb-[4px]">
                                  {(services as any[]).length} patients
                                </Badge>
                              </div>
                            </td>
                          </tr>
                          {/* Table Header and Rows - Show only when expanded */}
                          {expandedDoctors.has(doctorId) && (
                            <>
                              {/* Table Header for this Doctor Section */}
                              <tr className="border-b" style={{ backgroundColor: '#f7f7f7' }}>
                                <th className="py-3 text-sm font-semibold text-left pl-[16px] pr-[16px]" style={{ color: '#6C757F', width: 'auto' }}>S.No</th>
                                <th className="py-3 text-left text-sm font-semibold w-max pl-[0px] pr-[0px]" style={{ color: '#6C757F' }}>Date</th>
                                <th className="py-3 text-left text-sm font-semibold w-12 pl-[8px] pr-[8px]" style={{ color: '#6C757F' }}>Time</th>
                                <th className="pl-4 pr-0 py-3 text-left text-sm font-semibold w-32" style={{ color: '#6C757F' }}>Order ID</th>
                                <th className="pl-4 pr-0 py-3 text-left text-sm font-semibold flex-grow min-w-48" style={{ color: '#6C757F' }}>Name</th>
                                <th className="pl-4 pr-0 py-3 text-sm font-semibold w-20 text-center" style={{ color: '#6C757F' }}>Sex/Age</th>
                                <th className="pl-4 pr-0 py-3 text-left text-sm font-semibold w-32" style={{ color: '#6C757F' }}>Contact</th>
                                <th className="py-3 text-sm font-semibold w-24 text-center pl-[0px] pr-[0px]" style={{ color: '#6C757F' }}>Status</th>
                                <th className="py-3 text-right text-sm font-semibold w-20 pl-[24px] pr-[24px]" style={{ color: '#6C757F' }}>Fees</th>
                                <th className="py-3 text-center text-sm font-semibold pl-[16px] pr-[16px] border-l-2" style={{ color: '#6C757F', width: 'auto', borderLeftColor: '#D6E7FE' }}>Actions</th>
                              </tr>
                              {/* Patient Rows */}
                              {(services as any[]).sort((a, b) => {
                                const aDateTime = new Date(`${a.scheduledDate} ${a.scheduledTime}`);
                                const bDateTime = new Date(`${b.scheduledDate} ${b.scheduledTime}`);
                                return bDateTime.getTime() - aDateTime.getTime();
                              }).map((visit: any) => (
                                <tr key={visit.id} className="border-b hover:bg-muted/50 transition-colors">
                                  <td className="py-3 text-sm whitespace-nowrap pl-8 pr-2 text-left">{rowNumber++}</td>
                                  <td className="py-3 text-sm whitespace-nowrap pl-[0px] pr-[0px] text-left">
                                    {visit.scheduledDate ? (() => {
                                      const d = new Date(visit.scheduledDate);
                                      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                                      return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
                                    })() : 'N/A'}
                                  </td>
                                  <td className="py-3 text-sm whitespace-nowrap pl-[8px] pr-[8px]">{visit.scheduledTime || 'N/A'}</td>
                                  <td className="pl-4 pr-0 py-3 text-sm whitespace-nowrap">
                                    <div className="font-medium">{visit.visitId || 'N/A'}</div>
                                  </td>
                                  <td className="pl-4 pr-0 py-3 text-sm">
                                    <div className="font-medium">{visit.patientName || 'Unknown'}</div>
                                    <div className="text-xs text-muted-foreground">{visit.patientPatientId || 'N/A'}</div>
                                  </td>
                                  <td className="pl-4 pr-0 py-3 text-sm whitespace-nowrap text-center">
                                    {visit.patientGender ? visit.patientGender.charAt(0).toUpperCase() : '-'}/{visit.patientAge || '-'}
                                  </td>
                                  <td className="pl-4 pr-0 py-3 text-sm whitespace-nowrap">{visit.patientPhone || 'N/A'}</td>
                                  <td className="py-3 text-sm whitespace-nowrap text-center pl-[0px] pr-[0px]">
                                    <Badge 
                                      className={`${getStatusColor(visit.status)}`}
                                      variant="secondary"
                                      data-testid={`status-${visit.id}`}
                                    >
                                      {visit.status.charAt(0).toUpperCase() + visit.status.slice(1)}
                                    </Badge>
                                  </td>
                                  <td className="py-3 text-sm text-right whitespace-nowrap pl-[24px] pr-[24px]">
                                    ₹{visit.consultationFee ?? visit.doctorConsultationFee ?? 0}
                                  </td>
                                  <td className="py-3 text-center whitespace-nowrap pl-[16px] pr-[16px] border-l-2" style={{ borderLeftColor: '#D6E7FE' }}>
                                    <div className="flex gap-2 items-center justify-center">
                                      <Link href={`/patients/${visit.patientId}`}>
                                        <Button variant="ghost" size="icon" data-testid={`view-patient-${visit.id}`}>
                                          <Eye className="w-4 h-4" />
                                        </Button>
                                      </Link>
                                      <Select 
                                        value={visit.status} 
                                        onValueChange={(newStatus) => updateStatusMutation.mutate({ visitId: visit.id, status: newStatus })}
                                        disabled={updateStatusMutation.isPending}
                                      >
                                        <SelectTrigger className="w-32" data-testid={`status-select-${visit.id}`}>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {(() => {
                                            const enabledStatuses = getEnabledStatuses(visit.status);
                                            return (
                                              <>
                                                <SelectItem value="scheduled" disabled={visit.status !== "scheduled"}>Scheduled</SelectItem>
                                                <SelectItem value="paid" disabled>Paid</SelectItem>
                                                <SelectItem value="completed" disabled={!enabledStatuses.has("completed")}>Completed</SelectItem>
                                                <SelectItem value="referred" disabled={!enabledStatuses.has("referred")}>Referred</SelectItem>
                                                <SelectItem value="admitted" disabled={!enabledStatuses.has("admitted")}>Admitted</SelectItem>
                                                <SelectItem value="cancelled" disabled={!enabledStatuses.has("cancelled")}>Cancelled</SelectItem>
                                              </>
                                            );
                                          })()}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </td>
                                </tr>
                              ))}
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