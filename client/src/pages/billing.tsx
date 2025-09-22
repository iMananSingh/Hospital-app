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

  // Search filters
  const [opdSearchQuery, setOpdSearchQuery] = useState<string>("");
  const [labSearchQuery, setLabSearchQuery] = useState<string>("");
  const [diagnosticSearchQuery, setDiagnosticSearchQuery] = useState<string>("");
  const [inpatientSearchQuery, setInpatientSearchQuery] = useState<string>("");

  // OPD specific filters
  const [selectedDoctor, setSelectedDoctor] = useState<string>("all");

  // Diagnostic specific filters
  const [selectedDiagnosticService, setSelectedDiagnosticService] = useState<string>("all");
  const [selectedService, setSelectedService] = useState<string>("all"); // For diagnostic filter

  const { data: doctorsFromApi = [] } = useQuery<any[]>({
    queryKey: ["/api/doctors"],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { data: opdDataApi = [] } = useQuery<any[]>({
    queryKey: [`/api/patient-services?serviceType=opd&fromDate=${fromDate}&toDate=${toDate}${selectedDoctor !== "all" ? `&doctorId=${selectedDoctor}` : ""}`],
    enabled: leftActiveTab === "opd",
  });

  const { data: labDataApi = [] } = useQuery<any[]>({
    queryKey: [`/api/pathology?fromDate=${fromDate}&toDate=${toDate}`],
    enabled: leftActiveTab === "lab",
  });

  const { data: diagnosticDataApi = [] } = useQuery<any[]>({
    queryKey: [`/api/patient-services?serviceType=diagnostic&fromDate=${fromDate}&toDate=${toDate}${selectedDiagnosticService !== "all" ? `&serviceName=${encodeURIComponent(selectedDiagnosticService)}` : ""}`],
    enabled: leftActiveTab === "diagnostic",
  });

  // Fetch inpatient services (procedures, operations, misc, and custom services)
  const { data: inpatientServicesApi = [] } = useQuery<any[]>({
    queryKey: [`/api/patient-services?fromDate=${fromDate}&toDate=${toDate}&serviceType=procedure,operation,misc,service`],
    enabled: leftActiveTab === "inpatient",
  });

  // Fetch admissions data
  const { data: admissionsDataApi = [] } = useQuery<any[]>({
    queryKey: [`/api/admissions?fromDate=${fromDate}&toDate=${toDate}`],
    enabled: leftActiveTab === "inpatient",
  });

  const { data: billsDataApi = [] } = useQuery<any[]>({
    queryKey: [rightActiveTab === "credit"
      ? `/api/bills?fromDate=${fromDate}&toDate=${toDate}&paymentStatus=paid`
      : `/api/bills?fromDate=${fromDate}&toDate=${toDate}`],
    enabled: rightActiveTab === "credit" || rightActiveTab === "debit",
  });

  // Filtered Data for display
  const filteredOpdServices = opdDataApi.filter(item => {
    const doctorMatch = selectedDoctor === "all" || String(item.doctorId) === selectedDoctor;
    const searchMatch = opdSearchQuery === "" || 
      item.patient?.name?.toLowerCase().includes(opdSearchQuery.toLowerCase()) ||
      item.doctor?.name?.toLowerCase().includes(opdSearchQuery.toLowerCase());
    return doctorMatch && searchMatch;
  });

  const filteredLabServices = labDataApi.map((orderData: any) => ({
    id: orderData.order?.id,
    patient: orderData.patient,
    orderId: orderData.order?.orderId || 'N/A',
    price: orderData.order?.totalPrice || 0,
    orderedDate: orderData.order?.orderedDate
  })).filter(item => {
    return labSearchQuery === "" || 
      item.patient?.name?.toLowerCase().includes(labSearchQuery.toLowerCase()) ||
      item.orderId?.toLowerCase().includes(labSearchQuery.toLowerCase());
  });

  const filteredDiagnosticServices = diagnosticDataApi.filter((item: any) => {
    const serviceMatch = selectedDiagnosticService === "all" || item.serviceName === selectedDiagnosticService;
    const searchMatch = diagnosticSearchQuery === "" || 
      item.patient?.name?.toLowerCase().includes(diagnosticSearchQuery.toLowerCase()) ||
      item.serviceName?.toLowerCase().includes(diagnosticSearchQuery.toLowerCase());
    return serviceMatch && searchMatch;
  });

  // Combine inpatient services and admissions
  const combinedInpatientData = [
    // Map patient services for procedures, operations, misc
    ...inpatientServicesApi.map((service: any) => ({
      ...service,
      type: 'service',
      price: service.calculatedAmount || service.price || 0
    })),
    // Map admissions data
    ...admissionsDataApi.map((admission: any) => ({
      ...admission,
      type: 'admission',
      patient: admission.patient,
      serviceName: `Admission - ${admission.currentWardType || 'General Ward'}`,
      scheduledDate: admission.admissionDate,
      price: admission.totalCost || admission.dailyCost || 0
    }))
  ];

  // Filter inpatient services based on selected service type
  const filteredInpatientServices = combinedInpatientData.filter((item: any) => {
    let serviceMatch = true;
    if (selectedService !== "all") {
      if (item.type === 'admission') {
        serviceMatch = selectedService === "admission";
      } else {
        // For patient services, check the service category/type
        if (item.serviceType === 'procedure' || item.serviceName?.toLowerCase().includes('procedure')) {
          serviceMatch = selectedService === "procedures";
        } else if (item.serviceType === 'operation' || item.serviceName?.toLowerCase().includes('operation') || item.serviceName?.toLowerCase().includes('surgery')) {
          serviceMatch = selectedService === "operations";
        } else if (item.serviceType === 'misc' || item.category === 'misc' || item.serviceType === 'service') {
          serviceMatch = selectedService === "misc";
        } else {
          serviceMatch = false;
        }
      }
    }

    const searchMatch = inpatientSearchQuery === "" || 
      item.patient?.name?.toLowerCase().includes(inpatientSearchQuery.toLowerCase()) ||
      item.serviceName?.toLowerCase().includes(inpatientSearchQuery.toLowerCase());

    return serviceMatch && searchMatch;
  });


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

  const getDoctorName = (doctorId: string | null) => {
    if (!doctorId) return "N/A";
    const doctor = doctorsFromApi.find(d => d.id === doctorId);
    return doctor ? doctor.name : "N/A";
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

  const calculateInpatientTotal = (data: any[]) => {
    return data.reduce((sum, item) => sum + (item.price || 0), 0);
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
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 h-full">
          {/* Left Section - Service Revenue (60%) */}
          <div className="flex flex-col h-full lg:col-span-3">
            <Card className="flex-1 flex flex-col">
              <CardHeader className="flex-shrink-0">
                <CardTitle>Service Revenue</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col overflow-hidden">
                <div className="w-full h-full flex flex-col">
                  <div className="grid w-full grid-cols-4 flex-shrink-0 inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground">
                    <button
                      onClick={() => setLeftActiveTab("opd")}
                      className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${leftActiveTab === "opd" ? "bg-background text-foreground shadow-sm" : ""}`}
                      data-testid="tab-opd"
                    >
                      OPD
                    </button>
                    <button
                      onClick={() => setLeftActiveTab("lab")}
                      className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${leftActiveTab === "lab" ? "bg-background text-foreground shadow-sm" : ""}`}
                      data-testid="tab-lab"
                    >
                      Lab
                    </button>
                    <button
                      onClick={() => setLeftActiveTab("diagnostic")}
                      className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${leftActiveTab === "diagnostic" ? "bg-background text-foreground shadow-sm" : ""}`}
                      data-testid="tab-diagnostic"
                    >
                      Diagnostic
                    </button>
                    <button
                      onClick={() => setLeftActiveTab("inpatient")}
                      className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${leftActiveTab === "inpatient" ? "bg-background text-foreground shadow-sm" : ""}`}
                      data-testid="tab-inpatient"
                    >
                      Inpatient
                    </button>
                  </div>

                  {leftActiveTab === "opd" && (
                    <div className="flex-1 flex flex-col mt-2">
                      {/* Search and Doctor Filter */}
                      <div className="flex items-center gap-2 flex-shrink-0 mb-2">
                        <Input
                          placeholder="Search patients or doctors..."
                          value={opdSearchQuery}
                          onChange={(e) => setOpdSearchQuery(e.target.value)}
                          className="flex-1"
                          data-testid="search-opd"
                        />
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

                      <div className="border rounded-lg flex-1 flex flex-col min-h-0">
                        <div className="overflow-y-auto flex-1" style={{ maxHeight: 'calc(100vh - 400px)' }}>
                          <table className="w-full">
                            <thead className="border-b bg-background sticky top-0 z-10">
                              <tr>
                                <th className="text-left p-3 font-medium bg-background">S.No</th>
                                <th className="text-left p-3 font-medium bg-background">Date</th>
                                <th className="text-left p-3 font-medium bg-background">Name</th>
                                <th className="text-left p-3 font-medium bg-background">Sex/Age</th>
                                <th className="text-left p-3 font-medium bg-background">Doctor</th>
                                <th className="text-right p-3 font-medium bg-background">Fees</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredOpdServices.length === 0 ? (
                                <tr>
                                  <td colSpan={6} className="text-center py-4 text-muted-foreground">
                                    No OPD records found for the selected period
                                  </td>
                                </tr>
                              ) : (
                                filteredOpdServices.map((item: any, index: number) => (
                                  <tr key={item.id} className="border-b hover:bg-muted/30">
                                    <td className="p-3">{index + 1}</td>
                                    <td className="p-3">
                                      {item.scheduledDate ? new Date(item.scheduledDate).toLocaleDateString('en-GB') : 'N/A'}
                                    </td>
                                    <td className="p-3">{item.patient?.name || "N/A"}</td>
                                    <td className="p-3">{formatGenderAge(item.patient)}</td>
                                    <td className="p-3">{getDoctorName(item.doctorId)}</td>
                                    <td className="p-3 text-right" data-testid={`opd-fee-${index}`}>
                                      {formatCurrency(item.calculatedAmount || item.price || 0)}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                        <div className="border-t p-2 bg-muted/30 flex-shrink-0">
                          <div className="flex justify-between font-semibold">
                            <span>Total:</span>
                            <span data-testid="text-opd-total">{formatCurrency(calculateOpdTotal(filteredOpdServices))}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {leftActiveTab === "lab" && (
                    <div className="flex-1 flex flex-col mt-2">
                      {/* Search Filter */}
                      <div className="flex items-center gap-2 flex-shrink-0 mb-2">
                        <Input
                          placeholder="Search patients or tests..."
                          value={labSearchQuery}
                          onChange={(e) => setLabSearchQuery(e.target.value)}
                          className="w-full"
                          data-testid="search-lab"
                        />
                      </div>

                      <div className="border rounded-lg flex-1 flex flex-col min-h-0">
                        <div className="overflow-y-auto flex-1" style={{ maxHeight: 'calc(100vh - 400px)' }}>
                          <table className="w-full">
                            <thead className="border-b bg-background sticky top-0 z-10">
                              <tr>
                                <th className="text-left p-3 font-medium bg-background">S.No</th>
                                <th className="text-left p-3 font-medium bg-background">Date</th>
                                <th className="text-left p-3 font-medium bg-background">Name</th>
                                <th className="text-left p-3 font-medium bg-background">Sex/Age</th>
                                <th className="text-left p-3 font-medium bg-background">Order ID</th>
                                <th className="text-right p-3 font-medium bg-background">Fees</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredLabServices.length === 0 ? (
                                <tr>
                                  <td colSpan={6} className="text-center py-4 text-muted-foreground">
                                    No Lab records found for the selected period
                                  </td>
                                </tr>
                              ) : (
                                filteredLabServices.map((item: any, index: number) => (
                                  <tr key={item.id} className="border-b hover:bg-muted/30">
                                    <td className="p-3">{index + 1}</td>
                                    <td className="p-3">
                                      {item.orderedDate ? new Date(item.orderedDate).toLocaleDateString('en-GB') : 'N/A'}
                                    </td>
                                    <td className="p-3">{item.patient?.name || "N/A"}</td>
                                    <td className="p-3">{formatGenderAge(item.patient)}</td>
                                    <td className="p-3">{item.orderId || "N/A"}</td>
                                    <td className="p-3 text-right" data-testid={`lab-fee-${index}`}>
                                      {formatCurrency(item.price || 0)}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                        <div className="border-t p-2 bg-muted/30 flex-shrink-0">
                          <div className="flex justify-between font-semibold">
                            <span>Total:</span>
                            <span data-testid="text-lab-total">{formatCurrency(calculateLabTotal(filteredLabServices))}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {leftActiveTab === "diagnostic" && (
                    <div className="flex-1 flex flex-col mt-2">
                      {/* Search and Service Filter for Diagnostic */}
                      <div className="flex items-center gap-2 flex-shrink-0 mb-2">
                        <Input
                          placeholder="Search patients or services..."
                          value={diagnosticSearchQuery}
                          onChange={(e) => setDiagnosticSearchQuery(e.target.value)}
                          className="flex-1"
                          data-testid="search-diagnostic"
                        />
                        <Label htmlFor="diagnostic-service-filter">Service:</Label>
                        <Select value={selectedDiagnosticService} onValueChange={setSelectedDiagnosticService}>
                          <SelectTrigger className="w-48" data-testid="select-diagnostic-service">
                            <SelectValue placeholder="Select service" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Services</SelectItem>
                            {Array.from(new Set(diagnosticDataApi.map((item: any) => item.serviceName).filter(Boolean))).sort().map((serviceName: string) => (
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
                            <thead className="border-b bg-background sticky top-0 z-10">
                              <tr>
                                <th className="text-left p-3 font-medium bg-background">S.No</th>
                                <th className="text-left p-3 font-medium bg-background">Date</th>
                                <th className="text-left p-3 font-medium bg-background">Name</th>
                                <th className="text-left p-3 font-medium bg-background">Sex/Age</th>
                                <th className="text-left p-3 font-medium bg-background">Service</th>
                                <th className="text-right p-3 font-medium bg-background">Fees</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredDiagnosticServices.length === 0 ? (
                                <tr>
                                  <td colSpan={6} className="text-center py-4 text-muted-foreground">
                                    No Diagnostic records found for the selected period
                                  </td>
                                </tr>
                              ) : (
                                filteredDiagnosticServices.map((item: any, index: number) => (
                                  <tr key={item.id} className="border-b hover:bg-muted/30">
                                    <td className="p-3">{index + 1}</td>
                                    <td className="p-3">
                                      {item.scheduledDate ? new Date(item.scheduledDate).toLocaleDateString('en-GB') : 'N/A'}
                                    </td>
                                    <td className="p-3">{item.patient?.name || "N/A"}</td>
                                    <td className="p-3">{formatGenderAge(item.patient)}</td>
                                    <td className="p-3">{item.serviceName || "N/A"}</td>
                                    <td className="p-3 text-right" data-testid={`diagnostic-fee-${index}`}>
                                      {formatCurrency(item.price || 0)}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                        <div className="border-t p-2 bg-muted/30 flex-shrink-0">
                          <div className="flex justify-between font-semibold">
                            <span>Total:</span>
                            <span data-testid="text-diagnostic-total">{formatCurrency(calculateDiagnosticTotal(filteredDiagnosticServices))}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {leftActiveTab === "inpatient" && (
                    <div className="flex-1 flex flex-col mt-2">
                      {/* Search and Service Filter for Inpatient */}
                      <div className="flex items-center gap-2 flex-shrink-0 mb-2">
                        <Input
                          placeholder="Search patients or services..."
                          value={inpatientSearchQuery}
                          onChange={(e) => setInpatientSearchQuery(e.target.value)}
                          className="flex-1"
                          data-testid="search-inpatient"
                        />
                        <Label htmlFor="inpatient-service-filter">Service:</Label>
                        <Select value={selectedService} onValueChange={setSelectedService}>
                          <SelectTrigger className="w-48" data-testid="select-inpatient-service">
                            <SelectValue placeholder="Select service" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Services</SelectItem>
                            <SelectItem value="procedures">Medical Procedures</SelectItem>
                            <SelectItem value="operations">Surgical Operations</SelectItem>
                            <SelectItem value="misc">Miscellaneous Services</SelectItem>
                            <SelectItem value="admission">Admission Services</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="border rounded-lg flex-1 flex flex-col min-h-0">
                        <div className="overflow-y-auto flex-1" style={{ maxHeight: 'calc(100vh - 400px)' }}>
                          <table className="w-full">
                            <thead className="border-b bg-background sticky top-0 z-10">
                              <tr>
                                <th className="text-left p-3 font-medium bg-background">S.No</th>
                                <th className="text-left p-3 font-medium bg-background">Date</th>
                                <th className="text-left p-3 font-medium bg-background">Name</th>
                                <th className="text-left p-3 font-medium bg-background">Sex/Age</th>
                                <th className="text-left p-3 font-medium bg-background">Service</th>
                                <th className="text-right p-3 font-medium bg-background">Fees</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredInpatientServices.length === 0 ? (
                                <tr>
                                  <td colSpan={6} className="text-center py-4 text-muted-foreground">
                                    No Inpatient records found for the selected period
                                  </td>
                                </tr>
                              ) : (
                                filteredInpatientServices.map((item: any, index: number) => (
                                  <tr key={item.id} className="border-b hover:bg-muted/30">
                                    <td className="p-3">{index + 1}</td>
                                    <td className="p-3">
                                      {item.type === 'admission' ? (item.admissionDate ? new Date(item.admissionDate).toLocaleDateString('en-GB') : 'N/A') :
                                       (item.scheduledDate ? new Date(item.scheduledDate).toLocaleDateString('en-GB') : 'N/A')}
                                    </td>
                                    <td className="p-3">{item.patient?.name || "N/A"}</td>
                                    <td className="p-3">{formatGenderAge(item.patient)}</td>
                                    <td className="p-3">
                                      {item.type === 'admission' ? 'Room Charges' : (item.serviceName || "N/A")}
                                    </td>
                                    <td className="p-3 text-right" data-testid={`inpatient-fee-${index}`}>
                                      {formatCurrency(item.price || item.totalAmount || 0)}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                        <div className="border-t p-2 bg-muted/30 flex-shrink-0">
                          <div className="flex justify-between font-semibold">
                            <span>Total:</span>
                            <span data-testid="text-inpatient-total">{formatCurrency(calculateInpatientTotal(filteredInpatientServices))}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Section - Payment Transactions (40%) */}
          <div className="flex flex-col h-full lg:col-span-2">
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
                          <thead className="border-b bg-background sticky top-0 z-10">
                              <tr>
                                <th className="text-left p-3 font-medium bg-background">S.No</th>
                                <th className="text-left p-3 font-medium bg-background">Bill No.</th>
                                <th className="text-left p-3 font-medium bg-background">Patient</th>
                                <th className="text-left p-3 font-medium bg-background">Payment Method</th>
                                <th className="text-right p-3 font-medium bg-background">Amount</th>
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
                      <div className="border-t p-2 bg-muted/30 flex-shrink-0">
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