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
  Calendar, 
  Clock,
  Search,
  Building2,
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
  const { data: admissions = [] } = useQuery<Admission[]>({
    queryKey: ["/api/admissions"],
  });

  // Fetch patients
  const { data: patients = [] } = useQuery<Patient[]>({
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

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "admitted": return "default";
      case "discharged": return "secondary";
      case "transferred": return "outline";
      default: return "outline";
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

        {/* Search and Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
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
                  <SelectItem value="admitted">Admitted Only</SelectItem>
                  <SelectItem value="discharged">Discharged Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Admissions Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Patient Admissions
            </CardTitle>
            <CardDescription>
              Manage all patient admissions and discharges
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredAdmissions.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Admission ID</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Ward/Room Type</TableHead>
                    <TableHead>Room Number</TableHead>
                    <TableHead>Admission Date</TableHead>
                    <TableHead>Discharge Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAdmissions.map((admission) => (
                    <TableRow key={admission.id}>
                      <TableCell className="font-medium">
                        {admission.admissionId}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{getPatientName(admission.patientId)}</div>
                          <div className="text-sm text-gray-500">ID: {getPatientId(admission.patientId)}</div>
                        </div>
                      </TableCell>
                      <TableCell>{admission.currentWardType || "Not specified"}</TableCell>
                      <TableCell>{admission.currentRoomNumber || "TBA"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-gray-400" />
                          {new Date(admission.admissionDate).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        {admission.dischargeDate ? (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-gray-400" />
                            {new Date(admission.dischargeDate).toLocaleDateString()}
                          </div>
                        ) : (
                          <span className="text-gray-400">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(admission.status)}>
                          {admission.status.charAt(0).toUpperCase() + admission.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>
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
            ) : (
              <div className="text-center py-8">
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
      </div>
    </div>
  );
}