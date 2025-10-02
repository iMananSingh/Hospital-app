
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import TopBar from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Eye } from "lucide-react";
import type { Patient } from "@shared/schema";

interface PatientWithBalance extends Patient {
  pendingAmount: number;
}

export default function PendingBills() {
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch all patients
  const { data: patients = [], isLoading } = useQuery<Patient[]>({
    queryKey: ["/api/patients"],
  });

  // Fetch financial summary for each patient and filter those with pending amounts
  const { data: patientsWithPending = [], isLoading: isLoadingBalances } = useQuery<PatientWithBalance[]>({
    queryKey: ["/api/patients/pending-bills"],
    queryFn: async () => {
      const results: PatientWithBalance[] = [];
      
      for (const patient of patients) {
        try {
          const response = await fetch(`/api/patients/${patient.id}/financial-summary`, {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("hospital_token")}`,
            },
          });
          
          if (response.ok) {
            const summary = await response.json();
            const pending = summary.balance || 0;
            
            // Only include patients with positive pending amounts
            if (pending > 0) {
              results.push({
                ...patient,
                pendingAmount: pending,
              });
            }
          }
        } catch (error) {
          console.error(`Error fetching financial summary for patient ${patient.id}:`, error);
        }
      }
      
      // Sort by pending amount (highest first)
      return results.sort((a, b) => b.pendingAmount - a.pendingAmount);
    },
    enabled: patients.length > 0,
    staleTime: 0,
    refetchOnMount: true,
  });

  const filteredPatients = patientsWithPending.filter((patient) =>
    patient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    patient.patientId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    patient.phone.includes(searchQuery)
  );

  const totalPending = filteredPatients.reduce((sum, patient) => sum + patient.pendingAmount, 0);

  if (isLoading || isLoadingBalances) {
    return (
      <div className="space-y-6">
        <TopBar title="Pending Bills" />
        <div className="p-6">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="ml-3 text-muted-foreground">Loading pending bills...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <TopBar 
        title="Pending Bills"
        searchPlaceholder="Search by patient name, ID, or phone..."
        onSearch={setSearchQuery}
      />

      <div className="p-6">
        {/* Summary Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Total Patients with Pending Bills</p>
                <p className="text-2xl font-bold text-orange-700">
                  {filteredPatients.length}
                </p>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Total Pending Amount</p>
                <p className="text-2xl font-bold text-red-700">
                  ₹{totalPending.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Patients Table */}
        <Card>
          <CardHeader>
            <CardTitle>Patients with Pending Bills</CardTitle>
            <p className="text-sm text-muted-foreground">
              {filteredPatients.length} patient{filteredPatients.length !== 1 ? 's' : ''} with outstanding payments
            </p>
          </CardHeader>
          <CardContent>
            {filteredPatients.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  {searchQuery ? "No matching patients found" : "No pending bills at this time"}
                </p>
              </div>
            ) : (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Patient ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Age/Gender</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead className="text-right">Pending Amount</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPatients.map((patient) => (
                      <TableRow key={patient.id}>
                        <TableCell className="font-medium">
                          {patient.patientId}
                        </TableCell>
                        <TableCell>{patient.name}</TableCell>
                        <TableCell>
                          {patient.age}y, {patient.gender}
                        </TableCell>
                        <TableCell>{patient.phone}</TableCell>
                        <TableCell className="text-right">
                          <span className="font-semibold text-red-600">
                            ₹{patient.pendingAmount.toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/patients/${patient.id}`)}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
