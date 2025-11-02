
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import TopBar from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Eye, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import type { Patient } from "@shared/schema";

interface PatientWithBalance extends Patient {
  pendingAmount: number;
}

type SortColumn = 'patientId' | 'pendingAmount' | null;
type SortDirection = 'asc' | 'desc';

export default function PendingBills() {
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortColumn>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Fetch patients with pending bills using optimized bulk endpoint
  const { data: patientsWithPending = [], isLoading } = useQuery<PatientWithBalance[]>({
    queryKey: ["/api/patients/pending-bills/bulk"],
    staleTime: 0,
    refetchOnMount: true,
  });

  const handleSort = (column: SortColumn) => {
    if (sortBy === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (column: SortColumn) => {
    if (sortBy !== column) {
      return <ArrowUpDown className="ml-1 h-4 w-4 inline" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="ml-1 h-4 w-4 inline" />
      : <ArrowDown className="ml-1 h-4 w-4 inline" />;
  };

  const filteredPatients = patientsWithPending.filter((patient) =>
    patient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    patient.patientId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    patient.phone.includes(searchQuery)
  );

  const sortedPatients = [...filteredPatients].sort((a, b) => {
    if (!sortBy) return 0;

    let comparison = 0;
    if (sortBy === 'patientId') {
      comparison = a.patientId.localeCompare(b.patientId);
    } else if (sortBy === 'pendingAmount') {
      comparison = a.pendingAmount - b.pendingAmount;
    }

    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const totalPending = sortedPatients.reduce((sum, patient) => sum + patient.pendingAmount, 0);

  if (isLoading) {
    return (
      <div>
        <TopBar title="Pending Bills" />
        <div className="px-6 pb-6 pt-4">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="ml-3 text-muted-foreground">Loading pending bills...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <TopBar 
        title="Pending Bills"
        searchPlaceholder="Search by patient name, ID, or phone..."
        onSearch={setSearchQuery}
      />

      <div className="px-6 pb-6 pt-4">
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
              {sortedPatients.length} patient{sortedPatients.length !== 1 ? 's' : ''} with outstanding payments
            </p>
          </CardHeader>
          <CardContent>
            {sortedPatients.length === 0 ? (
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
                      <TableHead 
                        className="cursor-pointer select-none hover:bg-muted/50"
                        onClick={() => handleSort('patientId')}
                        data-testid="header-patient-id"
                      >
                        Patient ID{getSortIcon('patientId')}
                      </TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Age/Gender</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead 
                        className="text-right cursor-pointer select-none hover:bg-muted/50"
                        onClick={() => handleSort('pendingAmount')}
                        data-testid="header-pending-amount"
                      >
                        Pending Amount{getSortIcon('pendingAmount')}
                      </TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedPatients.map((patient) => (
                      <TableRow key={patient.id}>
                        <TableCell className="font-medium" data-testid={`patient-id-${patient.id}`}>
                          {patient.patientId}
                        </TableCell>
                        <TableCell>{patient.name}</TableCell>
                        <TableCell>
                          {patient.age}y, {patient.gender}
                        </TableCell>
                        <TableCell>{patient.phone}</TableCell>
                        <TableCell className="text-right" data-testid={`pending-amount-${patient.id}`}>
                          <span className="font-semibold text-red-600">
                            ₹{patient.pendingAmount.toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/patients/${patient.id}`)}
                            data-testid={`button-view-patient-${patient.id}`}
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
