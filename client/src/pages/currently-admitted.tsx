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
  Search,
  Eye,
  ChevronDown
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
    staleTime: 0,
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

  if (isLoading) {
    return (
      <div>
        <TopBar title="Patient Admissions" />
        <div className="px-6 pb-6 pt-4">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Patient Admissions" />
      <div className="px-6 flex-1 overflow-hidden pt-4 pb-4">
        <Card className="flex flex-col h-full">
          <CardHeader>
            <CardTitle>Patient Admissions</CardTitle>
            <CardDescription>Manage all patient admissions and discharges</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col overflow-hidden p-0">
            {/* Search and Filter Section */}
            <div className="px-6 pb-4 flex gap-3 items-center bg-[#FDE4CE] rounded-t-md">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search patients, admission ID, or ward type..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-white border-0"
                />
              </div>
              <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-md border border-gray-200">
                <span className="text-sm text-gray-600">All Patients</span>
                <ChevronDown className="h-4 w-4 text-gray-400" />
              </div>
            </div>

            {/* Table Section */}
            {filteredPatients.length > 0 ? (
              <div className="flex-1 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Admission ID</TableHead>
                      <TableHead>Patient</TableHead>
                      <TableHead>Sex/Age</TableHead>
                      <TableHead>Ward/Room</TableHead>
                      <TableHead>Admission Date</TableHead>
                      <TableHead>Discharge Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>View</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPatients.map((admission) => (
                      <TableRow key={admission.id}>
                        <TableCell className="font-medium">{admission.admissionId}</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium text-sm">{admission.patient?.name}</div>
                            <div className="text-xs text-gray-500">{admission.patient?.patientId}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {admission.patient?.gender}/{admission.patient?.age}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium text-sm">{admission.currentWardType || "Not specified"}</div>
                            <div className="text-xs text-gray-500">Room: {admission.currentRoomNumber || "TBA"}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {new Date(admission.admissionDate).toLocaleDateString()}
                            <div className="text-xs text-gray-500">
                              {new Date(admission.admissionDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-gray-500">N/A</div>
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                            Admitted
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Link href={`/patients/${admission.patientId}`}>
                            <Button variant="ghost" size="icon">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <User className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground mb-4">
                    {searchQuery ? "No patients match your search criteria." : "No patients are currently admitted."}
                  </p>
                  <Link href="/patients">
                    <Button>
                      Admit New Patient
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
