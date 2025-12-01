import { useState, useMemo, Fragment, useEffect } from "react";
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
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [expectedDischargeDates, setExpectedDischargeDates] = useState<Record<string, string>>({});
  const [primaryDiagnosis, setPrimaryDiagnosis] = useState<Record<string, string>>({});

  // Load expected discharge dates from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("expectedDischargeDates");
    if (stored) {
      try {
        setExpectedDischargeDates(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse expected discharge dates from localStorage", e);
      }
    }
  }, []);

  // Save expected discharge dates to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("expectedDischargeDates", JSON.stringify(expectedDischargeDates));
  }, [expectedDischargeDates]);

  // Load primary diagnosis from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("primaryDiagnosis");
    if (stored) {
      try {
        setPrimaryDiagnosis(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse primary diagnosis from localStorage", e);
      }
    }
  }, []);

  // Save primary diagnosis to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("primaryDiagnosis", JSON.stringify(primaryDiagnosis));
  }, [primaryDiagnosis]);

  const toggleRow = (admissionId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(admissionId)) {
      newExpanded.delete(admissionId);
    } else {
      newExpanded.add(admissionId);
    }
    setExpandedRows(newExpanded);
  };

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

  const calculateDays = (admissionDate: string) => {
    const admission = new Date(admissionDate);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - admission.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const calculateExpectedStay = (admissionDate: string, dischargeDate: string | undefined) => {
    if (!dischargeDate) return "-";
    const admission = new Date(admissionDate);
    const discharge = new Date(dischargeDate);
    const diffTime = Math.abs(discharge.getTime() - admission.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? `${diffDays} days` : "-";
  };

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
          <CardHeader className="flex flex-col space-y-1.5 pt-[24px] pb-[24px] pl-[48px] pr-[48px]">
            <p className="text-sm text-muted-foreground pl-[0px] pr-[0px]">View all currently admitted patient details</p>
          </CardHeader>
          <Card className="flex-1 flex flex-col overflow-hidden m-0 ml-[24px] mr-[24px]">
            <CardContent className="flex-1 flex flex-col overflow-hidden p-0">
              {/* Search and Filter Section */}
              <div className="px-6 flex gap-3 items-center rounded-t-md pl-[16px] pr-[16px] pt-[16px] pb-[16px] bg-[#cbffc9]">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by patient name, ID, admission ID, ward type, or doctor..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-white border-0"
                  />
                </div>
              </div>

              {/* Table Section */}
              {filteredPatients.length > 0 ? (
                <div className="flex-1 overflow-y-auto pb-[24px] ml-[0px] mr-[0px] scrollbar-green">
                  <Table>
                    <TableHeader>
                      <TableRow style={{ backgroundColor: '#F7F7F7' }}>
                        <TableHead style={{ backgroundColor: '#F7F7F7', width: '40px' }}></TableHead>
                        <TableHead style={{ backgroundColor: '#F7F7F7' }}>Patient</TableHead>
                        <TableHead style={{ backgroundColor: '#F7F7F7' }}>Patient Details</TableHead>
                        <TableHead style={{ backgroundColor: '#F7F7F7' }}>Admission Info</TableHead>
                        <TableHead style={{ backgroundColor: '#F7F7F7' }}>Ward/Room</TableHead>
                        <TableHead style={{ backgroundColor: '#F7F7F7' }}>Doctor</TableHead>
                        <TableHead style={{ backgroundColor: '#F7F7F7' }}>Stay Duration</TableHead>
                        <TableHead style={{ backgroundColor: '#F7F7F7' }}>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPatients.map((admission) => (
                        <Fragment key={admission.id}>
                          <TableRow className="cursor-pointer hover:bg-gray-50" onClick={() => toggleRow(admission.id)}>
                            <TableCell className="w-10">
                              <ChevronDown 
                                className={`h-4 w-4 transition-transform ${expandedRows.has(admission.id) ? 'rotate-180' : ''}`}
                              />
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">{admission.patient?.name}</div>
                                <div className="text-gray-500 text-[12px]">
                                  ID: {admission.patient?.patientId}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm text-gray-500">
                                Age: {admission.patient?.age}
                              </div>
                              <div className="text-sm text-gray-500">
                                Gender: {admission.patient?.gender}
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
                                <div className="font-medium text-sm">
                                  {admission.doctor.name}
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
                              <Link href={`/patients/${admission.patientId}`}>
                                <Button variant="outline" size="icon">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </Link>
                            </TableCell>
                          </TableRow>
                          {expandedRows.has(admission.id) && (
                            <TableRow className="bg-gray-50">
                              <TableCell colSpan={8} className="p-4 pl-[64px] pr-[64px]">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                  <div>
                                    <p className="text-xs font-semibold text-gray-600 uppercase">Admission Date</p>
                                    <p className="text-sm font-medium mt-1">{new Date(admission.admissionDate).toLocaleString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true })}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs font-semibold text-gray-600 uppercase">Stay Duration</p>
                                    <p className="text-sm font-medium mt-1">{calculateDays(admission.admissionDate)} days</p>
                                  </div>
                                  <div>
                                    <p className="text-xs font-semibold text-gray-600 uppercase">Expected Discharge Date</p>
                                    <Input
                                      type="date"
                                      value={expectedDischargeDates[admission.id] || ""}
                                      onChange={(e) => setExpectedDischargeDates(prev => ({
                                        ...prev,
                                        [admission.id]: e.target.value
                                      }))}
                                      className="text-sm mt-1"
                                      data-testid={`input-expected-discharge-${admission.id}`}
                                    />
                                  </div>
                                  <div>
                                    <p className="text-xs font-semibold text-gray-600 uppercase">Expected Total Stay</p>
                                    <p className="text-sm font-medium mt-1">{calculateExpectedStay(admission.admissionDate, expectedDischargeDates[admission.id])}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs font-semibold text-gray-600 uppercase">Ward Type</p>
                                    <p className="text-sm font-medium mt-1">{admission.currentWardType || "Not specified"}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs font-semibold text-gray-600 uppercase">Room Number</p>
                                    <p className="text-sm font-medium mt-1">{admission.currentRoomNumber || "TBA"}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs font-semibold text-gray-600 uppercase">Attending Doctor</p>
                                    <p className="text-sm font-medium mt-1">{admission.doctor?.name || "Not assigned"}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs font-semibold text-gray-600 uppercase">Primary Diagnosis</p>
                                    <Input
                                      type="text"
                                      placeholder="Enter primary diagnosis"
                                      value={primaryDiagnosis[admission.id] || ""}
                                      onChange={(e) => setPrimaryDiagnosis(prev => ({
                                        ...prev,
                                        [admission.id]: e.target.value
                                      }))}
                                      className="text-sm mt-1"
                                      data-testid={`input-primary-diagnosis-${admission.id}`}
                                    />
                                  </div>
                                  <div>
                                    <p className="text-xs font-semibold text-gray-600 uppercase">Initial Deposit</p>
                                    <p className="text-sm font-medium mt-1 text-green-600">₹{admission.initialDeposit.toLocaleString()}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs font-semibold text-gray-600 uppercase">Total Paid</p>
                                    <p className="text-sm font-medium mt-1 text-green-600">₹0</p>
                                  </div>
                                  <div>
                                    <p className="text-xs font-semibold text-gray-600 uppercase">Daily Cost</p>
                                    <p className="text-sm font-medium mt-1 text-green-600">₹{admission.dailyCost.toLocaleString()}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs font-semibold text-gray-600 uppercase">Total Cost</p>
                                    <p className="text-sm font-medium mt-1 text-green-600">₹{admission.totalCost.toLocaleString()}</p>
                                  </div>
                                  {admission.notes && (
                                    <div className="col-span-2 md:col-span-4">
                                      <p className="text-xs font-semibold text-gray-600 uppercase">Notes</p>
                                      <p className="text-sm mt-1 text-gray-700">{admission.notes}</p>
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
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
        </Card>
      </div>
    </div>
  );
}
