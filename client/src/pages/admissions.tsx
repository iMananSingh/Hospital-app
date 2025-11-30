import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import TopBar from "@/components/layout/topbar";
import { useAuth } from "@/hooks/use-auth";
import AccessRestricted from "@/components/access-restricted";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Bed, 
  User, 
  Search,
  UserCheck,
  UserX,
  Eye
} from "lucide-react";
import type { Admission, Patient, RoomType } from "@shared/schema";

export default function InPatientManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { user } = useAuth();
  
  // Check if user has appropriate role for admission creation
  const currentUserRoles = user?.roles || [user?.role]; // Backward compatibility
  const isBillingStaff = currentUserRoles.includes('billing_staff') && !currentUserRoles.includes('admin') && !currentUserRoles.includes('super_user');

  // Fetch all admissions
  const { data: admissions = [], isLoading: isLoadingAdmissions } = useQuery<Admission[]>({
    queryKey: ["/api/admissions"],
  });

  // Fetch patients
  const { data: patients = [], isLoading: isLoadingPatients } = useQuery<Patient[]>({
    queryKey: ["/api/patients"],
  });

  // Fetch bed occupancy data for IST-based calculation
  const { data: bedOccupancyData = [] } = useQuery<any[]>({
    queryKey: ["/api/inpatients/bed-occupancy"],
    staleTime: 0, // Always refetch for real-time data
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // Fetch IST-based counts
  const { data: currentlyAdmittedData = [] } = useQuery<any[]>({
    queryKey: ["/api/inpatients/currently-admitted"],
    staleTime: 0, // Always refetch for real-time data
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  const { data: admittedTodayData = [] } = useQuery<any[]>({
    queryKey: ["/api/inpatients/admitted-today"],
    staleTime: 0, // Always refetch for real-time data
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  const { data: dischargedTodayData = [] } = useQuery<any[]>({
    queryKey: ["/api/inpatients/discharged-today"],
    staleTime: 0, // Always refetch for real-time data
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // Calculate statistics from IST-based API data
  const totalBeds = useMemo(() => {
    return bedOccupancyData.reduce((sum, roomType) => sum + (roomType.totalBeds || 0), 0);
  }, [bedOccupancyData]);

  const occupiedBeds = useMemo(() => {
    return bedOccupancyData.reduce((sum, roomType) => sum + (roomType.occupiedBeds || 0), 0);
  }, [bedOccupancyData]);

  const currentlyAdmitted = currentlyAdmittedData.length;
  const admittedToday = admittedTodayData.length;
  const dischargedToday = dischargedTodayData.length;

  // Filter admissions based on search and status
  const filteredAdmissions = useMemo(() => {
    let filtered = admissions;
    
    // Filter by status
    if (statusFilter !== "all") {
      filtered = filtered.filter(admission => admission.status === statusFilter);
    }
    
    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(admission => {
        const patient = patients.find(p => p.id === admission.patientId);
        return (
          patient?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          patient?.patientId.toLowerCase().includes(searchQuery.toLowerCase()) ||
          admission.admissionId.toLowerCase().includes(searchQuery.toLowerCase()) ||
          admission.currentWardType?.toLowerCase().includes(searchQuery.toLowerCase())
        );
      });
    }
    
    return filtered;
  }, [admissions, patients, searchQuery, statusFilter]);

  const getPatientName = (patientId: string) => {
    const patient = patients.find(p => p.id === patientId);
    return patient?.name || "Unknown Patient";
  };

  const getPatientId = (patientId: string) => {
    const patient = patients.find(p => p.id === patientId);
    return patient?.patientId || "N/A";
  };

  const getPatientSexAge = (patientId: string) => {
    const patient = patients.find(p => p.id === patientId);
    if (!patient) return "N/A";
    const sex = patient.gender ? patient.gender.charAt(0).toUpperCase() : '-';
    const age = patient.age || '-';
    return `${sex}/${age}`;
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "admitted": return "default";
      case "discharged": return "default";
      case "transferred": return "outline";
      default: return "outline";
    }
  };

  const getStatusBadgeClassName = (status: string) => {
    switch (status) {
      case "admitted": return "bg-green-100 text-green-800 hover:bg-green-100/80";
      case "discharged": return "bg-red-100 text-red-700 hover:bg-red-100/80";
      default: return "";
    }
  };

  return (
    <div>
      <TopBar title="In-Patient Management" />
      <div className="px-6 pb-6 pt-4">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <Link href="/bed-occupancy">
            <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Bed className="h-8 w-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Bed Occupancy</p>
                    <p className="text-2xl font-bold text-gray-900">{occupiedBeds}/{totalBeds}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/currently-admitted">
            <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
              <CardContent className="p-6">
                <div className="flex items-center">
                  <User className="h-8 w-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Currently Admitted</p>
                    <p className="text-2xl font-bold text-gray-900">{currentlyAdmitted}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admitted-today">
            <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
              <CardContent className="p-6">
                <div className="flex items-center">
                  <UserCheck className="h-8 w-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Admitted Today</p>
                    <p className="text-2xl font-bold text-gray-900">{admittedToday}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/discharged-today">
            <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
              <CardContent className="p-6">
                <div className="flex items-center">
                  <UserX className="h-8 w-8 text-red-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Discharged Today</p>
                    <p className="text-2xl font-bold text-gray-900">{dischargedToday}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Admissions Table */}
        <Card>
          <CardHeader style={{ backgroundColor: '#ffffff' }} className="rounded-t-lg pl-[48px] pr-[48px] pt-[24px] pb-[0px]">
            <CardTitle>
              Patient Admissions
            </CardTitle>
            <CardDescription>
              Manage all patient admissions and discharges
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6">
            {/* Inner Card */}
            <Card>
              <CardHeader style={{ backgroundColor: '#FDE4CE' }} className="rounded-t-lg pt-[16px] pb-[16px] pl-[16px] pr-[16px]">
                {/* Search and Filters */}
                <div className="flex gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search patients, admission ID, or ward type..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Patients</SelectItem>
                      <SelectItem value="admitted">Admitted</SelectItem>
                      <SelectItem value="discharged">Discharged</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>

              {/* Table */}
              <CardContent className="p-6 pt-0 pl-[0px] pr-[0px]">
                {/* Table */}
                {isLoadingAdmissions || isLoadingPatients ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">Loading admissions data...</p>
                    </div>
                  ) : filteredAdmissions.length > 0 ? (
                    <>
                      <div style={{ overflowY: 'scroll', overflowX: 'hidden', height: 0 }}>
                        <Table className="border-collapse" style={{ width: '100%', tableLayout: 'fixed' }}>
                          <TableHeader>
                            <TableRow style={{ backgroundColor: '#F7F7F7' }}>
                              <TableHead className="pt-[0px] pb-[0px]" style={{ width: '18%' }}>Admission ID</TableHead>
                              <TableHead className="pt-[0px] pb-[0px]" style={{ width: '23%' }}>Patient</TableHead>
                              <TableHead className="text-center pt-[0px] pb-[0px]" style={{ width: '8%' }}>Sex/Age</TableHead>
                              <TableHead className="text-left pt-[0px] pb-[0px]" style={{ width: '11%' }}>Ward/Room</TableHead>
                              <TableHead className="pt-[0px] pb-[0px]" style={{ width: '14%' }}>Admission Date</TableHead>
                              <TableHead className="pt-[0px] pb-[0px]" style={{ width: '10%' }}>Discharge Date</TableHead>
                              <TableHead className="pt-[0px] pb-[0px]" style={{ width: '10%' }}>Status</TableHead>
                              <TableHead className="border-l-2 text-center pt-[0px] pb-[0px]" style={{ width: '6%' }}>View</TableHead>
                            </TableRow>
                          </TableHeader>
                        </Table>
                      </div>
                      <Table className="border-collapse" style={{ width: '100%', tableLayout: 'fixed' }}>
                        <TableHeader>
                          <TableRow style={{ backgroundColor: '#F7F7F7' }}>
                            <TableHead className="pt-[0px] pb-[0px]" style={{ width: '18%' }}>Admission ID</TableHead>
                            <TableHead className="pt-[0px] pb-[0px]" style={{ width: '23%' }}>Patient</TableHead>
                            <TableHead className="text-center pt-[0px] pb-[0px]" style={{ width: '8%' }}>Sex/Age</TableHead>
                            <TableHead className="text-left pt-[0px] pb-[0px]" style={{ width: '11%' }}>Ward/Room</TableHead>
                            <TableHead className="pt-[0px] pb-[0px]" style={{ width: '14%' }}>Admission Date</TableHead>
                            <TableHead className="pt-[0px] pb-[0px]" style={{ width: '10%' }}>Discharge Date</TableHead>
                            <TableHead className="pt-[0px] pb-[0px]" style={{ width: '10%' }}>Status</TableHead>
                            <TableHead className="border-l-2 text-center pt-[0px] pb-[0px]" style={{ width: '6%' }}>View</TableHead>
                          </TableRow>
                        </TableHeader>
                      </Table>
                      <div className="overflow-y-auto scrollbar-peach" style={{ height: 'calc(100vh - 480px - 49px)', scrollbarGutter: 'stable' }}>
                        <Table className="border-collapse" style={{ width: '100%', tableLayout: 'fixed' }}>
                          <TableBody>
                            {filteredAdmissions.map((admission) => (
                              <TableRow key={admission.id}>
                                <TableCell className="font-medium" style={{ width: '18%' }}>
                                  {admission.admissionId}
                                </TableCell>
                                <TableCell style={{ width: '23%' }}>
                                  <div>
                                    <div className="font-medium">{getPatientName(admission.patientId)}</div>
                                    <div className="text-sm text-gray-500">{getPatientId(admission.patientId)}</div>
                                  </div>
                                </TableCell>
                                <TableCell className="text-center" style={{ width: '8%' }}>{getPatientSexAge(admission.patientId)}</TableCell>
                                <TableCell style={{ width: '11%' }}>
                                  <div>
                                    <div className="font-medium">{admission.currentWardType || "Not specified"}</div>
                                    <div className="text-sm text-gray-500">Room: {admission.currentRoomNumber || "TBA"}</div>
                                  </div>
                                </TableCell>
                                <TableCell style={{ width: '14%' }}>
                                  <div>
                                    <div>{new Date(admission.admissionDate).toLocaleDateString()}</div>
                                    <div className="text-xs text-gray-500">{new Date(admission.admissionDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                  </div>
                                </TableCell>
                                <TableCell style={{ width: '10%' }}>
                                  {admission.dischargeDate ? (
                                    <div>
                                      <div>{new Date(admission.dischargeDate).toLocaleDateString()}</div>
                                      <div className="text-xs text-gray-500">{new Date(admission.dischargeDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                    </div>
                                  ) : (
                                    <span className="text-gray-400">N/A</span>
                                  )}
                                </TableCell>
                                <TableCell style={{ width: '10%' }}>
                                  <Badge variant={getStatusBadgeVariant(admission.status)} className={getStatusBadgeClassName(admission.status)}>
                                    {admission.status.charAt(0).toUpperCase() + admission.status.slice(1)}
                                  </Badge>
                                </TableCell>
                                <TableCell className="border-l-2" style={{ width: '6%' }}>
                                  <Link href={`/patients/${admission.patientId}`}>
                                    <Button variant="outline" size="sm">
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  </Link>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8 px-6">
                      <Bed className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">
                        {searchQuery ? "No admissions match your search criteria." : "No patient admissions found."}
                      </p>
                      {!isBillingStaff && (
                        <Link href="/patients">
                          <Button className="mt-4">
                            Admit New Patient
                          </Button>
                        </Link>
                      )}
                    </div>
                  )}
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}