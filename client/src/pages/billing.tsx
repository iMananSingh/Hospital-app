import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import TopBar from "@/components/layout/topbar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, CalendarDays } from "lucide-react";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"; // Assuming you have a Table component

// Placeholder for ReceiptTemplate component
const ReceiptTemplate = ({ receiptData, hospitalInfo, onPrint }) => (
  <button onClick={onPrint}>Print Receipt</button>
);

export default function Billing() {
  const [leftActiveTab, setLeftActiveTab] = useState("opd");
  const [rightActiveTab, setRightActiveTab] = useState("credit");

  // Date filters - default to today
  const today = new Date().toISOString().split('T')[0];
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);

  // OPD specific filters
  const [selectedDoctor, setSelectedDoctor] = useState<string>("all");

  // Diagnostic specific filters
  const [selectedDiagnosticService, setSelectedDiagnosticService] = useState<string>("all");
  const [selectedService, setSelectedService] = useState<string>("all"); // For diagnostic filter

  // Dummy data for demonstration if API calls fail or are not set up
  const doctors = [{ id: "1", name: "Dr. John Doe" }, { id: "2", name: "Dr. Jane Smith" }];
  const patients = [{ id: "p1", patientId: "P001", name: "Alice", gender: "female", age: 30 }, { id: "p2", patientId: "P002", name: "Bob", gender: "male", age: 45 }];
  const hospitalInfo = { name: "City Hospital", address: "123 Main St", phone: "555-1234" };

  // Mock fetch calls for query hooks
  const { data: doctorsFromApi = [] } = useQuery<any[]>({
    queryKey: ["/api/doctors"],
    initialData: doctors, // Fallback to dummy data
  });

  // OPD Data Simulation (replace with actual API fetch)
  const opdData = [
    { id: "opd1", patientId: "p1", scheduledDate: "2023-10-26T10:00:00Z", doctorId: "1", price: 500, description: "Consultation", receiptNumber: "R1001" },
    { id: "opd2", patientId: "p2", scheduledDate: "2023-10-27T11:00:00Z", doctorId: "2", price: 600, description: "Follow-up", receiptNumber: "R1002" },
  ];
  const { data: opdDataApi = [] } = useQuery<any[]>({
    queryKey: [`/api/patient-services?serviceType=opd&fromDate=${fromDate}&toDate=${toDate}${selectedDoctor !== "all" ? `&doctorId=${selectedDoctor}` : ""}`],
    initialData: opdData, // Fallback to dummy data
    enabled: leftActiveTab === "opd",
  });

  // Lab Data Simulation
  const labData = [
    { id: "lab1", patientId: "p1", scheduledDate: "2023-10-26T10:00:00Z", doctorId: "1", price: 200, title: "Blood Test", description: "Routine Blood Work", receiptNumber: "R1003" },
    { id: "lab2", patientId: "p2", scheduledDate: "2023-10-27T11:00:00Z", doctorId: "2", price: 350, title: "X-Ray", description: "Chest X-Ray", receiptNumber: "R1004" },
  ];
  const { data: labDataApi = [] } = useQuery<any[]>({
    queryKey: ["/api/patient-services?serviceType=labtest&fromDate=${fromDate}&toDate=${toDate}"],
    initialData: labData, // Fallback to dummy data
    enabled: leftActiveTab === "lab",
  });

  // Diagnostic Data Simulation
  const diagnosticData = [
    { id: "diag1", patientId: "p1", scheduledDate: "2023-10-26T10:00:00Z", doctorId: "1", price: 400, title: "ECG", description: "Electrocardiogram", category: "diagnostics", receiptNumber: "R1005" },
    { id: "diag2", patientId: "p2", scheduledDate: "2023-10-27T11:00:00Z", doctorId: "2", price: 700, title: "MRI Scan", description: "Brain MRI", category: "diagnostics", receiptNumber: "R1006" },
  ];
  const { data: diagnosticDataApi = [] } = useQuery<any[]>({
    queryKey: [`/api/patient-services?serviceType=diagnostic&fromDate=${fromDate}&toDate=${toDate}${selectedDiagnosticService !== "all" ? `&serviceName=${encodeURIComponent(selectedDiagnosticService)}` : ""}`],
    initialData: diagnosticData, // Fallback to dummy data
    enabled: leftActiveTab === "diagnostic",
  });

  // Bills Data Simulation
  const billsData = [
    { id: "bill1", billNumber: "B101", patientId: "p1", paymentMethod: "credit", totalAmount: 500, scheduledDate: "2023-10-26T10:00:00Z", patient: { name: "Alice" } },
    { id: "bill2", billNumber: "B102", patientId: "p2", paymentMethod: "debit", totalAmount: 600, scheduledDate: "2023-10-27T11:00:00Z", patient: { name: "Bob" } },
    { id: "bill3", billNumber: "B103", patientId: "p1", paymentMethod: "credit", totalAmount: 200, scheduledDate: "2023-10-26T10:00:00Z", patient: { name: "Alice" } },
  ];
  const { data: billsDataApi = [] } = useQuery<any[]>({
    queryKey: [rightActiveTab === "credit"
      ? `/api/bills?fromDate=${fromDate}&toDate=${toDate}&paymentStatus=paid`
      : `/api/bills?fromDate=${fromDate}&toDate=${toDate}`],
    initialData: billsData, // Fallback to dummy data
    enabled: rightActiveTab === "credit" || rightActiveTab === "debit",
  });

  // Filtered Data for display
  const filteredOpdServices = opdDataApi.filter(item => selectedDoctor === "all" || String(item.doctorId) === selectedDoctor);
  const filteredLabServices = labDataApi;
  const filteredDiagnosticServices = diagnosticDataApi.filter((item: any) => selectedService === "all" || item.category === selectedService);


  const formatGenderAge = (patient: any) => {
    if (!patient) return "N/A";
    const gender = patient.gender === "male" ? "M" : patient.gender === "female" ? "F" : "O";
    return `${gender}/${patient.age}`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const calculateOpdTotal = (data: any[]) => {
    return data.reduce((sum, item) => sum + (item.calculatedAmount || item.price || 0), 0);
  };

  const calculateLabTotal = (data: any[]) => {
    return data.reduce((sum, item) => sum + (item.calculatedAmount || item.price || 0), 0);
  };

  const calculateDiagnosticTotal = (data: any[]) => {
    return data.reduce((sum, item) => sum + (item.calculatedAmount || item.price || 0), 0);
  };

  const calculateCreditTotal = (data: any[]) => {
    return data.reduce((sum: number, bill: any) => sum + (bill.totalAmount || 0), 0);
  };

  return (
    <div className="flex flex-col h-screen">
      <TopBar
        title="Revenue and Payments"
        searchPlaceholder="Search revenue data..."
        showNotifications={true}
        notificationCount={3}
        showDateFilter={true}
        fromDate={fromDate}
        toDate={toDate}
        onFromDateChange={setFromDate}
        onToDateChange={setToDate}
        onTodayClick={() => {
          setFromDate(today);
          setToDate(today);
        }}
      />

      <div className="flex-1 p-6 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
          {/* Left Half - Service Revenue */}
          <div className="flex flex-col h-full">
            <Card className="flex-1 flex flex-col">
              <CardHeader className="flex-shrink-0">
                <CardTitle>Service Revenue</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col overflow-hidden">
                <Tabs value={leftActiveTab} onValueChange={setLeftActiveTab} className="w-full h-full flex flex-col">
                  <TabsList className="grid w-full grid-cols-4 flex-shrink-0">
                    <TabsTrigger value="opd" data-testid="tab-opd">OPD</TabsTrigger>
                    <TabsTrigger value="lab" data-testid="tab-lab">Lab</TabsTrigger>
                    <TabsTrigger value="diagnostic" data-testid="tab-diagnostic">Diagnostic</TabsTrigger>
                    <TabsTrigger value="inpatient" data-testid="tab-inpatient">Inpatient</TabsTrigger>
                  </TabsList>

                  <TabsContent value="opd" className="flex-1 flex flex-col mt-2">
                    {/* Doctor Filter */}
                    <div className="flex items-center gap-2 flex-shrink-0 mb-3">
                      <Label htmlFor="doctor-filter">Doctor:</Label>
                      <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
                        <SelectTrigger className="w-48" data-testid="select-doctor">
                          <SelectValue placeholder="Select doctor" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Doctors</SelectItem>
                          {doctorsFromApi.map((doctor: any) => (
                            <SelectItem key={doctor.id} value={String(doctor.id)}>
                              {doctor.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* OPD Data Table */}
                    <div className="border rounded-lg flex-1 flex flex-col min-h-0">
                      <div className="overflow-y-auto flex-1" style={{ maxHeight: 'calc(100vh - 400px)' }}>
                        <table className="w-full">
                          <thead className="border-b bg-muted/50 sticky top-0">
                            <tr>
                              <th className="text-left p-3 font-medium">S.No</th>
                              <th className="text-left p-3 font-medium">Date</th>
                              <th className="text-left p-3 font-medium">Name</th>
                              <th className="text-left p-3 font-medium">Sex/Age</th>
                              <th className="text-right p-3 font-medium">Fees</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredOpdServices.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="text-center py-4 text-muted-foreground">
                                  No OPD records found for the selected period
                                </td>
                              </tr>
                            ) : (
                              filteredOpdServices.map((item: any, index: number) => (
                                <tr key={item.id} className="border-b hover:bg-muted/50" data-testid={`row-opd-${index}`}>
                                  <td className="p-3" data-testid={`text-opd-sno-${index}`}>{index + 1}</td>
                                  <td className="p-3" data-testid={`text-opd-date-${index}`}>
                                    {new Date(item.scheduledDate).toLocaleDateString('en-GB')}
                                  </td>
                                  <td className="p-3" data-testid={`text-opd-name-${index}`}>{item.patient?.name || 'N/A'}</td>
                                  <td className="p-3" data-testid={`text-opd-age-${index}`}>{formatGenderAge(item.patient)}</td>
                                  <td className="p-3 text-right" data-testid={`text-opd-fees-${index}`}>
                                    {formatCurrency(item.price || 0)}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                      <div className="border-t p-3 bg-muted/30 flex-shrink-0">
                        <div className="flex justify-between font-semibold">
                          <span>Total:</span>
                          <span data-testid="text-opd-total">{formatCurrency(calculateOpdTotal(filteredOpdServices))}</span>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  {/* Lab Tab */}
                  <TabsContent value="lab" className="flex-1 flex flex-col mt-2">
                    <div className="border rounded-lg flex-1 flex flex-col min-h-0">
                      <div className="overflow-y-auto flex-1" style={{ maxHeight: 'calc(100vh - 400px)' }}>
                        <table className="w-full">
                          <thead className="border-b bg-muted/50 sticky top-0">
                            <tr>
                              <th className="text-left p-3 font-medium">S.No</th>
                              <th className="text-left p-3 font-medium">Name</th>
                              <th className="text-left p-3 font-medium">Sex/Age</th>
                              <th className="text-left p-3 font-medium">Test</th>
                              <th className="text-right p-3 font-medium">Fees</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredLabServices.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="text-center py-4 text-muted-foreground">
                                  No Lab records found for the selected period
                                </td>
                              </tr>
                            ) : (
                              filteredLabServices.map((item: any, index: number) => (
                                <tr key={item.id} className="border-b hover:bg-muted/50" data-testid={`row-lab-${index}`}>
                                  <td className="p-3" data-testid={`text-lab-sno-${index}`}>{index + 1}</td>
                                  <td className="p-3" data-testid={`text-lab-name-${index}`}>{item.patient?.name || 'N/A'}</td>
                                  <td className="p-3" data-testid={`text-lab-age-${index}`}>{formatGenderAge(item.patient)}</td>
                                  <td className="p-3" data-testid={`text-lab-test-${index}`}>{item.title || item.description || 'Lab Test'}</td>
                                  <td className="p-3 text-right" data-testid={`text-lab-fees-${index}`}>
                                    {formatCurrency(item.price || 0)}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                      <div className="border-t p-3 bg-muted/30 flex-shrink-0">
                        <div className="flex justify-between font-semibold">
                          <span>Total:</span>
                          <span data-testid="text-lab-total">{formatCurrency(calculateLabTotal(filteredLabServices))}</span>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  {/* Diagnostic Tab */}
                  <TabsContent value="diagnostic" className="flex-1 flex flex-col mt-2">
                    {/* Service Filter */}
                    <div className="flex items-center gap-2 flex-shrink-0 mb-3">
                      <Label htmlFor="diagnostic-service-filter">Service:</Label>
                      <Select value={selectedDiagnosticService} onValueChange={setSelectedDiagnosticService}>
                        <SelectTrigger className="w-48" data-testid="select-diagnostic-service">
                          <SelectValue placeholder="Select service" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Services</SelectItem>
                          {Array.from(new Set(diagnosticDataApi.map((item: any) => item.category))).sort().map((serviceCategory: string) => (
                            <SelectItem key={serviceCategory} value={serviceCategory}>
                              {serviceCategory.charAt(0).toUpperCase() + serviceCategory.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="border rounded-lg flex-1 flex flex-col min-h-0">
                      <div className="overflow-y-auto flex-1" style={{ maxHeight: 'calc(100vh - 400px)' }}>
                        <table className="w-full">
                          <thead className="border-b bg-muted/50 sticky top-0">
                            <tr>
                              <th className="text-left p-3 font-medium">S.No</th>
                              <th className="text-left p-3 font-medium">Name</th>
                              <th className="text-left p-3 font-medium">Sex/Age</th>
                              <th className="text-left p-3 font-medium">Service</th>
                              <th className="text-right p-3 font-medium">Fees</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredDiagnosticServices.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="text-center py-4 text-muted-foreground">
                                  No Diagnostic records found for the selected period
                                </td>
                              </tr>
                            ) : (
                              filteredDiagnosticServices.map((item: any, index: number) => (
                                <tr key={item.id} className="border-b hover:bg-muted/50" data-testid={`row-diagnostic-${index}`}>
                                  <td className="p-3" data-testid={`text-diagnostic-sno-${index}`}>{index + 1}</td>
                                  <td className="p-3" data-testid={`text-diagnostic-name-${index}`}>{item.patient?.name || 'N/A'}</td>
                                  <td className="p-3" data-testid={`text-diagnostic-age-${index}`}>{formatGenderAge(item.patient)}</td>
                                  <td className="p-3" data-testid={`text-diagnostic-service-${index}`}>{item.title || item.description || 'Service'}</td>
                                  <td className="p-3 text-right" data-testid={`text-diagnostic-fees-${index}`}>
                                    {formatCurrency(item.price || 0)}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                      <div className="border-t p-3 bg-muted/30 flex-shrink-0">
                        <div className="flex justify-between font-semibold">
                          <span>Total:</span>
                          <span data-testid="text-diagnostic-total">{formatCurrency(calculateDiagnosticTotal(filteredDiagnosticServices))}</span>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  {/* Inpatient Tab */}
                  <TabsContent value="inpatient" className="flex-1 flex flex-col mt-2">
                    <div className="border rounded-lg flex-1 flex items-center justify-center">
                      <p className="text-center py-8 text-muted-foreground">
                        Inpatient revenue data will be displayed here
                      </p>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Right Half - Payment Transactions */}
          <div className="flex flex-col h-full">
            <Card className="flex-1 flex flex-col">
              <CardHeader className="flex-shrink-0">
                <CardTitle>Payment Transactions</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col overflow-hidden">
                <Tabs value={rightActiveTab} onValueChange={setRightActiveTab} className="w-full h-full flex flex-col">
                  <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
                    <TabsTrigger value="credit" data-testid="tab-credit">Credit</TabsTrigger>
                    <TabsTrigger value="debit" data-testid="tab-debit">Debit</TabsTrigger>
                  </TabsList>

                  <TabsContent value="credit" className="flex-1 flex flex-col mt-2">
                    <div className="border rounded-lg flex-1 flex flex-col min-h-0">
                      <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 400px)' }}>
                        <table className="w-full">
                          <thead className="border-b bg-muted/50 sticky top-0">
                            <tr>
                              <th className="text-left p-3 font-medium">S.No</th>
                              <th className="text-left p-3 font-medium">Bill No.</th>
                              <th className="text-left p-3 font-medium">Patient</th>
                              <th className="text-left p-3 font-medium">Payment Method</th>
                              <th className="text-right p-3 font-medium">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {billsDataApi.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="text-center py-4 text-muted-foreground">
                                  No Credit transactions found for the selected period
                                </td>
                              </tr>
                            ) : (
                              billsDataApi.map((bill: any, index: number) => (
                                <tr key={bill.id} className="border-b hover:bg-muted/50" data-testid={`row-credit-${index}`}>
                                  <td className="p-3" data-testid={`text-credit-sno-${index}`}>{index + 1}</td>
                                  <td className="p-3" data-testid={`text-credit-bill-${index}`}>{bill.billNumber}</td>
                                  <td className="p-3" data-testid={`text-credit-patient-${index}`}>{bill.patient?.name || 'N/A'}</td>
                                  <td className="p-3 capitalize" data-testid={`text-credit-method-${index}`}>{bill.paymentMethod}</td>
                                  <td className="p-3 text-right" data-testid={`text-credit-amount-${index}`}>
                                    {formatCurrency(bill.totalAmount)}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                      <div className="border-t p-3 bg-muted/30 flex-shrink-0">
                        <div className="flex justify-between font-semibold">
                          <span>Total:</span>
                          <span data-testid="text-credit-total">{formatCurrency(calculateCreditTotal(billsDataApi))}</span>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="debit" className="flex-1 flex flex-col mt-2">
                    <div className="border rounded-lg flex-1 flex items-center justify-center">
                      <p className="text-center py-8 text-muted-foreground">
                        Debit transactions will be displayed here
                      </p>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}