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

  // Fetch doctors for filter dropdown
  const { data: doctors = [] } = useQuery<any[]>({
    queryKey: ["/api/doctors"],
  });

  // Fetch OPD revenue data
  const opdUrl = `/api/patient-services?serviceType=opd&fromDate=${fromDate}&toDate=${toDate}${selectedDoctor !== "all" ? `&doctorId=${selectedDoctor}` : ""}`;
  const { data: opdData = [], isLoading: opdLoading } = useQuery<any[]>({
    queryKey: [opdUrl],
    enabled: leftActiveTab === "opd",
  });

  // Fetch Lab revenue data
  const labUrl = `/api/patient-services?serviceType=labtest&fromDate=${fromDate}&toDate=${toDate}`;
  const { data: labData = [], isLoading: labLoading } = useQuery<any[]>({
    queryKey: [labUrl],
    enabled: leftActiveTab === "lab",
  });

  // Fetch Diagnostic revenue data
  const diagnosticUrl = `/api/patient-services?serviceType=diagnostic&fromDate=${fromDate}&toDate=${toDate}${selectedDiagnosticService !== "all" ? `&serviceName=${encodeURIComponent(selectedDiagnosticService)}` : ""}`;
  const { data: diagnosticData = [], isLoading: diagnosticLoading } = useQuery<any[]>({
    queryKey: [diagnosticUrl],
    enabled: leftActiveTab === "diagnostic",
  });

  // Fetch Bills for credit/debit data
  const billsUrl = `/api/bills?fromDate=${fromDate}&toDate=${toDate}`;
  const { data: billsData = [], isLoading: billsLoading } = useQuery<any[]>({
    queryKey: [billsUrl],
    enabled: rightActiveTab === "credit" || rightActiveTab === "debit",
  });

  // Calculate totals
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
    return data.filter((bill: any) => bill.paymentStatus === 'paid').reduce((sum: number, bill: any) => sum + bill.totalAmount, 0);
  };

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

                  {/* OPD Tab */}
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
                          {doctors.map((doctor: any) => (
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
                              <th className="text-left p-3 font-medium">Name</th>
                              <th className="text-left p-3 font-medium">Sex/Age</th>
                              <th className="text-right p-3 font-medium">Fees</th>
                            </tr>
                          </thead>
                          <tbody>
                            {opdLoading ? (
                              <tr>
                                <td colSpan={4} className="text-center py-4 text-muted-foreground">
                                  Loading OPD data...
                                </td>
                              </tr>
                            ) : opdData.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="text-center py-4 text-muted-foreground">
                                  No OPD records found for the selected period
                                </td>
                              </tr>
                            ) : (
                              opdData.map((item: any, index: number) => (
                                <tr key={item.id} className="border-b hover:bg-muted/50" data-testid={`row-opd-${index}`}>
                                  <td className="p-3" data-testid={`text-opd-sno-${index}`}>{index + 1}</td>
                                  <td className="p-3" data-testid={`text-opd-name-${index}`}>{item.patient?.name || 'N/A'}</td>
                                  <td className="p-3" data-testid={`text-opd-age-${index}`}>{formatGenderAge(item.patient)}</td>
                                  <td className="p-3 text-right" data-testid={`text-opd-fees-${index}`}>
                                    {formatCurrency(item.calculatedAmount || item.price || 0)}
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
                          <span data-testid="text-opd-total">{formatCurrency(calculateOpdTotal(opdData))}</span>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  {/* Lab Tab */}
                  <TabsContent value="lab" className="flex-1 flex flex-col mt-2">
                    {/* Empty filter space for consistency */}
                    <div className="flex-shrink-0 mb-3">
                      {/* No filter for lab, but maintaining spacing consistency */}
                    </div>
                    
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
                            {labLoading ? (
                              <tr>
                                <td colSpan={5} className="text-center py-4 text-muted-foreground">
                                  Loading Lab data...
                                </td>
                              </tr>
                            ) : labData.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="text-center py-4 text-muted-foreground">
                                  No Lab records found for the selected period
                                </td>
                              </tr>
                            ) : (
                              labData.map((item: any, index: number) => (
                                <tr key={item.id} className="border-b hover:bg-muted/50" data-testid={`row-lab-${index}`}>
                                  <td className="p-3" data-testid={`text-lab-sno-${index}`}>{index + 1}</td>
                                  <td className="p-3" data-testid={`text-lab-name-${index}`}>{item.patient?.name || 'N/A'}</td>
                                  <td className="p-3" data-testid={`text-lab-age-${index}`}>{formatGenderAge(item.patient)}</td>
                                  <td className="p-3" data-testid={`text-lab-test-${index}`}>{item.serviceName}</td>
                                  <td className="p-3 text-right" data-testid={`text-lab-fees-${index}`}>
                                    {formatCurrency(item.calculatedAmount || item.price || 0)}
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
                          <span data-testid="text-lab-total">{formatCurrency(calculateLabTotal(labData))}</span>
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
                          {Array.from(new Set(diagnosticData.map((item: any) => item.serviceName))).sort().map((serviceName: string) => (
                            <SelectItem key={serviceName} value={serviceName}>
                              {serviceName}
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
                            {diagnosticLoading ? (
                              <tr>
                                <td colSpan={5} className="text-center py-4 text-muted-foreground">
                                  Loading Diagnostic data...
                                </td>
                              </tr>
                            ) : diagnosticData.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="text-center py-4 text-muted-foreground">
                                  No Diagnostic records found for the selected period
                                </td>
                              </tr>
                            ) : (
                              diagnosticData
                                .filter((item: any) => selectedDiagnosticService === "all" || item.serviceName === selectedDiagnosticService)
                                .map((item: any, index: number) => (
                                <tr key={item.id} className="border-b hover:bg-muted/50" data-testid={`row-diagnostic-${index}`}>
                                  <td className="p-3" data-testid={`text-diagnostic-sno-${index}`}>{index + 1}</td>
                                  <td className="p-3" data-testid={`text-diagnostic-name-${index}`}>{item.patient?.name || 'N/A'}</td>
                                  <td className="p-3" data-testid={`text-diagnostic-age-${index}`}>{formatGenderAge(item.patient)}</td>
                                  <td className="p-3" data-testid={`text-diagnostic-service-${index}`}>{item.serviceName}</td>
                                  <td className="p-3 text-right" data-testid={`text-diagnostic-fees-${index}`}>
                                    {formatCurrency(item.calculatedAmount || item.price || 0)}
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
                          <span data-testid="text-diagnostic-total">{formatCurrency(calculateDiagnosticTotal(diagnosticData.filter((item: any) => selectedDiagnosticService === "all" || item.serviceName === selectedDiagnosticService)))}</span>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  {/* Inpatient Tab */}
                  <TabsContent value="inpatient" className="flex-1 flex flex-col mt-2">
                    <div className="text-center py-8 text-muted-foreground flex-1 flex items-center justify-center">
                      Inpatient revenue data will be displayed here
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
                            {billsLoading ? (
                              <tr>
                                <td colSpan={5} className="text-center py-4 text-muted-foreground">
                                  Loading Credit data...
                                </td>
                              </tr>
                            ) : billsData.filter((bill: any) => bill.paymentStatus === 'paid').length === 0 ? (
                              <tr>
                                <td colSpan={5} className="text-center py-4 text-muted-foreground">
                                  No Credit transactions found for the selected period
                                </td>
                              </tr>
                            ) : (
                              billsData.filter((bill: any) => bill.paymentStatus === 'paid').map((bill: any, index: number) => (
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
                          <span data-testid="text-credit-total">{formatCurrency(calculateCreditTotal(billsData))}</span>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="debit" className="flex-1 flex flex-col mt-2">
                    <div className="text-center py-8 text-muted-foreground flex-1 flex items-center justify-center">
                      Debit transactions will be displayed here
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