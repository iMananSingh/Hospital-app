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
  User, 
  Calendar, 
  Clock,
  Search,
  Building2,
  Stethoscope,
  Phone,
  MapPin,
  Eye
} from "lucide-react";
import type { Admission, Patient, Doctor } from "@shared/schema";

interface AdmissionWithDetails extends Admission {
  patient: Patient;
  doctor: Doctor | null;
}

export default function CurrentlyAdmittedPage() {
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch currently admitted patients
  const { data: admittedPatients = [], isLoading } = useQuery<AdmissionWithDetails[]>({
    queryKey: ["/api/inpatients/currently-admitted"],
    staleTime: 0, // Always refetch for real-time data
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // Filter patients based on search
  const filteredPatients = useMemo(() => {
    if (!searchQuery) return admittedPatients;

    return admittedPatients.filter(admission => {
      const searchLower = searchQuery.toLowerCase();
      return (
        admission.patient?.name.toLowerCase().includes(searchLower) ||
        admission.patient?.patientId.toLowerCase().includes(searchLower) ||
        admission.admissionId.toLowerCase().includes(searchLower) ||
        admission.currentWardType?.toLowerCase().includes(searchLower) ||
        admission.doctor?.name.toLowerCase().includes(searchLower)
      );
    });
  }, [admittedPatients, searchQuery]);

  const calculateDays = (admissionDate: string) => {
    const admission = new Date(admissionDate);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - admission.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (isLoading) {
    return (
      <div>
        <TopBar title="Currently Admitted Patients" />
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
      <TopBar title="Currently Admitted Patients" />
      <div className="px-6 pb-6 pt-4">
        {/* Single Card with Search in Header */}
        <Card>
          <CardHeader>
            <div>
              <p className="text-muted-foreground text-[16px] pl-[24px] pr-[24px]">
                All patients currently admitted to the hospital
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <Card>
              <CardHeader className="pt-[16px] pb-[16px] pl-[16px] pr-[16px] bg-[#BAFFB9] rounded-t-md">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by patient name, ID, admission ID, ward type, or doctor..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </CardHeader>
              <CardContent className="pl-[16px] pr-[16px] pt-[0px] pb-[0px]">
                {filteredPatients.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Patient Details</TableHead>
                        <TableHead>Admission Info</TableHead>
                        <TableHead>Ward/Room</TableHead>
                        <TableHead>Doctor</TableHead>
                        <TableHead>Stay Duration</TableHead>
                        <TableHead>Daily Cost</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPatients.map((admission) => (
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
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium text-sm">{admission.admissionId}</div>
                              <div className="text-sm text-gray-500 flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(admission.admissionDate).toLocaleDateString()}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{admission.currentWardType || "Not specified"}</div>
                              <div className="text-sm text-gray-500">
                                Room: {admission.currentRoomNumber || "TBA"}
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
                            <Badge variant="outline">
                              {calculateDays(admission.admissionDate)} days
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">₹{admission.dailyCost.toLocaleString()}</div>
                            <div className="text-xs text-gray-500">
                              Total: ₹{admission.totalCost.toLocaleString()}
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
                    <User className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      {searchQuery ? "No patients match your search criteria." : "No patients are currently admitted."}
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}