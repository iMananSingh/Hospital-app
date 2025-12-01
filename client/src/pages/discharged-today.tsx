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
  UserX, 
  Calendar, 
  Clock,
  Search,
  Building2,
  Stethoscope,
  Phone,
  IndianRupee,
  TrendingUp,
  User,
  Eye
} from "lucide-react";
import { useTimezone } from "@/hooks/use-timezone";
import type { Admission, Patient, Doctor } from "@shared/schema";

interface AdmissionWithDetails extends Admission {
  patient: Patient;
  doctor: Doctor | null;
}

export default function DischargedTodayPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const { formatTime, formatDate } = useTimezone();

  // Fetch today's discharges with IST timezone
  const { data: todayDischarges = [], isLoading } = useQuery<AdmissionWithDetails[]>({
    queryKey: ["/api/inpatients/discharged-today"],
    staleTime: 0, // Always refetch for real-time data
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // Filter discharges based on search
  const filteredDischarges = useMemo(() => {
    if (!searchQuery) return todayDischarges;

    return todayDischarges.filter(admission => {
      const searchLower = searchQuery.toLowerCase();
      return (
        admission.patient?.name.toLowerCase().includes(searchLower) ||
        admission.patient?.patientId.toLowerCase().includes(searchLower) ||
        admission.admissionId.toLowerCase().includes(searchLower) ||
        admission.currentWardType?.toLowerCase().includes(searchLower) ||
        admission.doctor?.name.toLowerCase().includes(searchLower) ||
        admission.diagnosis?.toLowerCase().includes(searchLower)
      );
    });
  }, [todayDischarges, searchQuery]);

  const calculateStayDuration = (admissionDate: string, dischargeDate: string) => {
    if (!dischargeDate) return 0;
    const admission = new Date(admissionDate);
    const discharge = new Date(dischargeDate);
    const diffTime = Math.abs(discharge.getTime() - admission.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getTotalRevenue = () => {
    return todayDischarges.reduce((sum, admission) => sum + (admission.totalCost || 0), 0);
  };

  const getAverageStay = () => {
    if (todayDischarges.length === 0) return 0;
    const totalDays = todayDischarges.reduce((sum, admission) => 
      sum + calculateStayDuration(admission.admissionDate, admission.dischargeDate || ''), 0);
    return Math.round(totalDays / todayDischarges.length);
  };

  if (isLoading) {
    return (
      <div>
        <TopBar title="Patients Discharged Today" />
        <div className="px-6 pb-6 pt-4">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <TopBar title="Patients Discharged Today" />
      <div className="px-6 pb-6 pt-4">
        <Card>
          {/* Discharges Table */}
          <Card>
          <CardHeader>
            <div className="flex gap-4 items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by patient name, ID, admission ID, ward type, doctor, or diagnosis..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <CardDescription className="mt-3">
              Patients discharged today (IST timezone) - {new Date().toLocaleDateString('en-IN')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredDischarges.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Patient Details</TableHead>
                    <TableHead>Stay Details</TableHead>
                    <TableHead>Ward/Room</TableHead>
                    <TableHead>Doctor</TableHead>
                    <TableHead>Diagnosis</TableHead>
                    <TableHead>Total Cost</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDischarges.map((admission) => (
                    <TableRow key={admission.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{admission.patient?.name}</div>
                          <div className="text-sm text-gray-500">
                            ID: {admission.patient?.patientId}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="text-sm text-gray-500">
                            {admission.patient?.age}/{admission.patient?.gender?.charAt(0).toUpperCase()}
                          </div>
                          <div className="text-sm text-gray-500">
                            {admission.patient?.phone || 'N/A'}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium text-sm">{admission.admissionId}</div>
                          <div className="text-sm text-gray-500 flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(admission.admissionDate)} - {admission.dischargeDate ? formatDate(admission.dischargeDate) : 'N/A'}
                          </div>
                          <div className="text-sm text-gray-500 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Discharged: {formatTime(admission.updatedAt)}
                          </div>
                          <Badge variant="outline" className="mt-1">
                            {calculateStayDuration(admission.admissionDate, admission.dischargeDate || '')} days
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{admission.currentWardType || "Not specified"}</div>
                          <div className="text-sm text-gray-500">
                            Room: {admission.currentRoomNumber || "N/A"}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {admission.doctor ? (
                          <div className="font-medium text-sm">
                            {admission.doctor.name}
                          </div>
                        ) : (
                          <span className="text-gray-400">No doctor assigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs">
                          {admission.diagnosis ? (
                            <p className="text-sm">{admission.diagnosis}</p>
                          ) : (
                            <span className="text-gray-400">No diagnosis recorded</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-green-600">
                          ₹{(admission.totalCost || 0).toLocaleString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Link href={`/patients/${admission.patientId}`}>
                          <Button variant="outline" size="icon">
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
                <UserX className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">
                  {searchQuery ? "No discharges match your search criteria." : "No patients were discharged today."}
                </p>
                <Link href="/admissions">
                  <Button className="mt-4">
                    View All Admissions
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
        </Card>
      </div>
    </div>
  );
}