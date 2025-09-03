import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import TopBar from "@/components/layout/topbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  UserCheck, 
  Calendar, 
  Clock,
  Search,
  Building2,
  Stethoscope,
  Phone,
  IndianRupee,
  User
} from "lucide-react";
import type { Admission, Patient, Doctor } from "@shared/schema";

interface AdmissionWithDetails extends Admission {
  patient: Patient;
  doctor: Doctor | null;
}

export default function AdmittedTodayPage() {
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch today's admissions with IST timezone
  const { data: todayAdmissions = [], isLoading } = useQuery<AdmissionWithDetails[]>({
    queryKey: ["/api/inpatients/admitted-today"],
  });

  // Filter admissions based on search
  const filteredAdmissions = useMemo(() => {
    if (!searchQuery) return todayAdmissions;
    
    return todayAdmissions.filter(admission => {
      const searchLower = searchQuery.toLowerCase();
      return (
        admission.patient?.name.toLowerCase().includes(searchLower) ||
        admission.patient?.patientId.toLowerCase().includes(searchLower) ||
        admission.admissionId.toLowerCase().includes(searchLower) ||
        admission.currentWardType?.toLowerCase().includes(searchLower) ||
        admission.doctor?.name.toLowerCase().includes(searchLower) ||
        admission.reason?.toLowerCase().includes(searchLower)
      );
    });
  }, [todayAdmissions, searchQuery]);

  const formatTime = (dateTimeString: string) => {
    const date = new Date(dateTimeString);
    return date.toLocaleTimeString('en-IN', { 
      hour12: true, 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getTotalRevenue = () => {
    return todayAdmissions.reduce((sum, admission) => sum + (admission.initialDeposit || 0), 0);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <TopBar title="Patients Admitted Today" />
        <div className="p-6">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <TopBar title="Patients Admitted Today" />
      
      <div className="p-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <UserCheck className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Admissions</p>
                  <p className="text-2xl font-bold text-gray-900">{todayAdmissions.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <IndianRupee className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Deposits Collected</p>
                  <p className="text-2xl font-bold text-gray-900">₹{getTotalRevenue().toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Building2 className="h-8 w-8 text-orange-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Wards Occupied</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {new Set(todayAdmissions.map(p => p.currentWardType).filter(Boolean)).size}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Stethoscope className="h-8 w-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Doctors Involved</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {new Set(todayAdmissions.map(p => p.doctorId).filter(Boolean)).size}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by patient name, ID, admission ID, ward type, doctor, or reason..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Admissions Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Today's Admissions ({filteredAdmissions.length})
            </CardTitle>
            <CardDescription>
              Patients admitted today (IST timezone) - {new Date().toLocaleDateString('en-IN')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredAdmissions.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient Details</TableHead>
                    <TableHead>Admission Info</TableHead>
                    <TableHead>Ward/Room</TableHead>
                    <TableHead>Doctor</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Initial Deposit</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAdmissions.map((admission) => (
                    <TableRow key={admission.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{admission.patient?.name}</div>
                          <div className="text-sm text-gray-500">
                            ID: {admission.patient?.patientId}
                          </div>
                          <div className="text-sm text-gray-500 flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {admission.patient?.phone}
                          </div>
                          <div className="text-sm text-gray-500">
                            Age: {admission.patient?.age} • {admission.patient?.gender}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium text-sm">{admission.admissionId}</div>
                          <div className="text-sm text-gray-500 flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(admission.admissionDate).toLocaleDateString('en-IN')}
                          </div>
                          <div className="text-sm text-gray-500 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatTime(admission.createdAt)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{admission.currentWardType || "Not specified"}</div>
                          <div className="text-sm text-gray-500">
                            Room: {admission.currentRoomNumber || "TBA"}
                          </div>
                          <div className="text-sm text-gray-500">
                            Daily: ₹{admission.dailyCost.toLocaleString()}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {admission.doctor ? (
                          <div>
                            <div className="font-medium text-sm flex items-center gap-1">
                              <Stethoscope className="h-3 w-3" />
                              {admission.doctor.name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {admission.doctor.specialization}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400">No doctor assigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs">
                          {admission.reason ? (
                            <p className="text-sm">{admission.reason}</p>
                          ) : (
                            <span className="text-gray-400">No reason specified</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-green-600">
                          ₹{(admission.initialDeposit || 0).toLocaleString()}
                        </div>
                        {admission.initialDeposit && admission.initialDeposit > 0 && (
                          <Badge variant="outline" className="mt-1 text-xs">
                            Paid
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Link href={`/patients/${admission.patientId}`}>
                          <Button variant="outline" size="sm">
                            View Patient
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8">
                <UserCheck className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">
                  {searchQuery ? "No admissions match your search criteria." : "No patients were admitted today."}
                </p>
                <Link href="/patients">
                  <Button className="mt-4">
                    Admit New Patient
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}