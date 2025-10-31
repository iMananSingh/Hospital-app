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
  const [mainActiveTab, setMainActiveTab] = useState("revenue");
  const [leftActiveTab, setLeftActiveTab] = useState("opd");

  // Get system settings for timezone
  const { data: systemSettings } = useQuery({
    queryKey: ["/api/settings/system"],
  });

  // Get timezone-adjusted today date
  const getTodayInTimezone = () => {
    const timezone = systemSettings?.timezone || "UTC";
    const now = new Date();

    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

    const parts = formatter.formatToParts(now);
    const year = parts.find((p) => p.type === "year")?.value;
    const month = parts.find((p) => p.type === "month")?.value;
    const day = parts.find((p) => p.type === "day")?.value;

    return `${year}-${month}-${day}`;
  };

  // Date filters - initialize with empty string and update when settings load
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Update dates when system settings are loaded
  useEffect(() => {
    if (systemSettings && (!fromDate || !toDate)) {
      const today = getTodayInTimezone();
      setFromDate(today);
      setToDate(today);
    }
  }, [systemSettings]);

  // Update dates when system settings are loaded
  useEffect(() => {
    if (systemSettings && (!fromDate || !toDate)) {
      const today = getTodayInTimezone();
      setFromDate(today);
      setToDate(today);
    }
  }, [systemSettings]);

  // Search filters
  const [opdSearchQuery, setOpdSearchQuery] = useState<string>("");
  const [labSearchQuery, setLabSearchQuery] = useState<string>("");
  const [diagnosticSearchQuery, setDiagnosticSearchQuery] = useState<string>("");
  const [inpatientSearchQuery, setInpatientSearchQuery] = useState<string>("");

  // OPD specific filters
  const [selectedDoctor, setSelectedDoctor] = useState<string>("all");

  // Diagnostic specific filters
  const [selectedDiagnosticService, setSelectedDiagnosticService] = useState<string>("all");
  const [selectedDiagnosticDoctor, setSelectedDiagnosticDoctor] = useState<string>("all");

  // Inpatient specific filters
  const [selectedService, setSelectedService] = useState<string>("all");
  const [selectedInpatientDoctor, setSelectedInpatientDoctor] = useState<string>("all");

  const { data: doctorsFromApi = [] } = useQuery<any[]>({
    queryKey: ["/api/doctors"],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { data: opdDataApi = [] } = useQuery<any[]>({
    queryKey: [`/api/opd-visits?fromDate=${fromDate}&toDate=${toDate}${selectedDoctor !== "all" ? `&doctorId=${selectedDoctor}` : ""}`],
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

  // Fetch all patient services (we'll filter out diagnostics on the frontend)
  const { data: inpatientServicesApi = [] } = useQuery<any[]>({
    queryKey: [`/api/patient-services?fromDate=${fromDate}&toDate=${toDate}`],
    enabled: leftActiveTab === "inpatient",
  });

  // Fetch admissions data
  const { data: admissionsDataApi = [] } = useQuery<any[]>({
    queryKey: [`/api/admissions?fromDate=${fromDate}&toDate=${toDate}`],
    enabled: leftActiveTab === "inpatient",
  });

  // Fetch bills data with date filters for the Credit/Payments tab
  const { data: billsDataApi = [], isLoading: isBillsLoading } = useQuery<any[]>({
    queryKey: ["/api/bills", { fromDate, toDate, paymentStatus: "paid" }],
    enabled: mainActiveTab === "payments",
  });

  // Fetch patient payments data with date filters
  const { data: patientPaymentsData = [], isLoading: isPaymentsLoading } = useQuery<any[]>({
    queryKey: ["/api/patient-payments", fromDate, toDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (fromDate) params.append('fromDate', fromDate);
      if (toDate) params.append('toDate', toDate);
      
      const response = await fetch(`/api/patient-payments?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("hospital_token")}`,
        },
      });
      
      if (!response.ok) throw new Error("Failed to fetch patient payments");
      return response.json();
    },
    enabled: mainActiveTab === "payments" && !!fromDate && !!toDate,
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
    orderedDate: orderData.order?.orderedDate,
    doctorId: orderData.order?.doctorId // Assuming doctorId is available in order data
  })).filter(item => {
    return labSearchQuery === "" ||
      item.patient?.name?.toLowerCase().includes(labSearchQuery.toLowerCase()) ||
      item.orderId?.toLowerCase().includes(labSearchQuery.toLowerCase());
  });

  const filteredDiagnosticServices = diagnosticDataApi.filter((item: any) => {
    const serviceMatch = selectedDiagnosticService === "all" || item.serviceName === selectedDiagnosticService;
    const doctorMatch = selectedDiagnosticDoctor === "all" || String(item.doctorId) === selectedDiagnosticDoctor;
    const searchMatch = diagnosticSearchQuery === "" ||
      item.patient?.name?.toLowerCase().includes(diagnosticSearchQuery.toLowerCase()) ||
      item.serviceName?.toLowerCase().includes(diagnosticSearchQuery.toLowerCase());
    return serviceMatch && doctorMatch && searchMatch;
  });

  // Combine inpatient services and admissions - exclude ONLY diagnostic services
  const combinedInpatientData = [
    // Map ALL patient services EXCEPT diagnostic services
    ...inpatientServicesApi
      .filter((service: any) => {
        // Exclude only services with serviceType 'diagnostic'
        const isDiagnostic = service.serviceType === 'diagnostic';
        return !isDiagnostic;
      })
      .map((service: any) => ({
        ...service,
        type: 'service',
        price: service.calculatedAmount || service.price || 0,
        doctorId: service.doctorId
      })),
    // Map admissions data
    ...admissionsDataApi.map((admission: any) => ({
      ...admission,
      type: 'admission',
      patient: admission.patient,
      serviceName: `Admission - ${admission.currentWardType || 'General Ward'}`,
      scheduledDate: admission.admissionDate,
      price: admission.totalCost || admission.dailyCost || 0,
      doctorId: admission.doctorId
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
        const serviceType = (item.serviceType || '').toLowerCase();
        const serviceName = (item.serviceName || '').toLowerCase();
        const category = (item.category || '').toLowerCase();

        if (serviceType === 'opd') {
          serviceMatch = selectedService === "opd";
        } else if (serviceType === 'admission' || category === 'admissions') {
          serviceMatch = selectedService === "admission";
        } else if (serviceType === 'procedure' || serviceName.includes('procedure')) {
          serviceMatch = selectedService === "procedures";
        } else if (serviceType === 'operation' || serviceName.includes('operation') || serviceName.includes('surgery')) {
          serviceMatch = selectedService === "operations";
        } else if (serviceType === 'misc' || serviceType === 'service' || category === 'misc') {
          serviceMatch = selectedService === "misc";
        } else {
          // If no specific match, include it in misc category
          serviceMatch = selectedService === "misc";
        }
      }
    }

    const doctorMatch = selectedInpatientDoctor === "all" || String(item.doctorId) === selectedInpatientDoctor;

    const searchMatch = inpatientSearchQuery === "" ||
      item.patient?.name?.toLowerCase().includes(inpatientSearchQuery.toLowerCase()) ||
      item.patientName?.toLowerCase().includes(inpatientSearchQuery.toLowerCase()) ||
      item.serviceName?.toLowerCase().includes(inpatientSearchQuery.toLowerCase());

    return serviceMatch && doctorMatch && searchMatch;
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
    return data.reduce((sum, item) => sum + (item.consultationFee ?? item.doctorConsultationFee ?? 0), 0);
  };

  const calculateLabTotal = (data: any[]) => {
    return data.reduce((sum, item) => sum + (item.price || 0), 0);
  };

  const calculateDiagnosticTotal = (data: any[]) => {
    return data.reduce((sum, item) => sum + (item.price || 0), 0);
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
          const todayDate = getTodayInTimezone();
          setFromDate(todayDate);
          setToDate(todayDate);
        }}
      />

      <div className="flex-1 p-6 overflow-hidden">
        {/* Main Navigation */}
        <div className="mb-6">
          <div className="grid w-full max-w-md grid-cols-2 inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground">
            <button
              onClick={() => setMainActiveTab("revenue")}
              className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${mainActiveTab === "revenue" ? "bg-background text-foreground shadow-sm" : ""}`}
              data-testid="tab-revenue"
            >
              Revenue
            </button>
            <button
              onClick={() => setMainActiveTab("payments")}
              className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${mainActiveTab === "payments" ? "bg-background text-foreground shadow-sm" : ""}`}
              data-testid="tab-payments"
            >
              Payments
            </button>
          </div>
        </div>

        {mainActiveTab === "revenue" && (
          <div className="h-full">
            <Card className="flex-1 flex flex-col h-full">
              <CardHeader className="flex-shrink-0">
                <CardTitle>Revenue</CardTitle>
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
                                <th className="text-left font-medium bg-background w-10 pl-3 pr-0">S.No</th>
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
                                    <td className="py-3 pl-3 pr-0">{index + 1}</td>
                                    <td className="p-3">
                                      {item.scheduledDate ? new Date(item.scheduledDate).toLocaleDateString('en-GB') : 'N/A'}
                                    </td>
                                    <td className="p-3">{item.patientName || "N/A"}</td>
                                    <td className="p-3">{formatGenderAge({ name: item.patientName, age: item.patientAge, gender: item.patientGender })}</td>
                                    <td className="p-3">{item.doctorName || getDoctorName(item.doctorId)}</td>
                                    <td className="p-3 text-right" data-testid={`opd-fee-${index}`}>
                                      {formatCurrency(item.consultationFee ?? item.doctorConsultationFee ?? 0)}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                        <div className="border-t p-2 bg-muted/30 flex-shrink-0">
                          <div className="flex justify-between font-semibold">
                            <span>Count: {filteredOpdServices.length} | Total:</span>
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
                                <th className="text-left font-medium bg-background w-10 pl-3 pr-0">S.No</th>
                                <th className="text-left p-3 font-medium bg-background">Date</th>
                                <th className="text-left p-3 font-medium bg-background">Name</th>
                                <th className="text-left p-3 font-medium bg-background">Sex/Age</th>
                                <th className="text-left p-3 font-medium bg-background">Doctor</th>
                                <th className="text-left p-3 font-medium bg-background">Order ID</th>
                                <th className="text-right p-3 font-medium bg-background">Fees</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredLabServices.length === 0 ? (
                                <tr>
                                  <td colSpan={7} className="text-center py-4 text-muted-foreground">
                                    No Lab records found for the selected period
                                  </td>
                                </tr>
                              ) : (
                                filteredLabServices.map((item: any, index: number) => (
                                  <tr key={item.id} className="border-b hover:bg-muted/30">
                                    <td className="py-3 pl-3 pr-0">{index + 1}</td>
                                    <td className="p-3">
                                      {item.orderedDate ? new Date(item.orderedDate).toLocaleDateString('en-GB') : 'N/A'}
                                    </td>
                                    <td className="p-3">{item.patient?.name || "N/A"}</td>
                                    <td className="p-3">{formatGenderAge(item.patient)}</td>
                                    <td className="p-3">{getDoctorName(item.doctorId)}</td>
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
                            <span>Count: {filteredLabServices.length} | Total:</span>
                            <span data-testid="text-lab-total">{formatCurrency(calculateLabTotal(filteredLabServices))}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {leftActiveTab === "diagnostic" && (
                    <div className="flex-1 flex flex-col mt-2">
                      {/* Search and Filters for Diagnostic */}
                      <div className="flex items-center gap-2 flex-shrink-0 mb-2">
                        <Input
                          placeholder="Search patients or services..."
                          value={diagnosticSearchQuery}
                          onChange={(e) => setDiagnosticSearchQuery(e.target.value)}
                          className="flex-1"
                          data-testid="search-diagnostic"
                        />
                        <Label htmlFor="diagnostic-doctor-filter">Doctor:</Label>
                        <Select value={selectedDiagnosticDoctor} onValueChange={setSelectedDiagnosticDoctor}>
                          <SelectTrigger className="w-48" data-testid="select-diagnostic-doctor">
                            <SelectValue placeholder="Select doctor" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Doctors</SelectItem>
                            {doctorsFromApi.map((doctor: any) => (
                              <SelectItem key={doctor.id} value={doctor.id}>
                                {doctor.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                                <th className="text-left font-medium bg-background w-10 pl-3 pr-0">S.No</th>
                                <th className="text-left p-3 font-medium bg-background">Date</th>
                                <th className="text-left p-3 font-medium bg-background">Name</th>
                                <th className="text-left p-3 font-medium bg-background">Sex/Age</th>
                                <th className="text-left p-3 font-medium bg-background">Doctor</th>
                                <th className="text-left p-3 font-medium bg-background">Service</th>
                                <th className="text-right p-3 font-medium bg-background">Fees</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredDiagnosticServices.length === 0 ? (
                                <tr>
                                  <td colSpan={7} className="text-center py-4 text-muted-foreground">
                                    No Diagnostic records found for the selected period
                                  </td>
                                </tr>
                              ) : (
                                filteredDiagnosticServices.map((item: any, index: number) => (
                                  <tr key={item.id} className="border-b hover:bg-muted/30">
                                    <td className="py-3 pl-3 pr-0">{index + 1}</td>
                                    <td className="p-3">
                                      {item.scheduledDate ? new Date(item.scheduledDate).toLocaleDateString('en-GB') : 'N/A'}
                                    </td>
                                    <td className="p-3">{item.patientName || "N/A"}</td>
                                    <td className="p-3">{formatGenderAge({ name: item.patientName, age: item.patientAge, gender: item.patientGender })}</td>
                                    <td className="p-3">{item.doctorName && item.doctorName.trim() !== '' ? item.doctorName : getDoctorName(item.doctorId)}</td>
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
                            <span>Count: {filteredDiagnosticServices.length} | Total:</span>
                            <span data-testid="text-diagnostic-total">{formatCurrency(calculateDiagnosticTotal(filteredDiagnosticServices))}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {leftActiveTab === "inpatient" && (
                    <div className="flex-1 flex flex-col mt-2">
                      {/* Search and Filters for Inpatient */}
                      <div className="flex items-center gap-2 flex-shrink-0 mb-2">
                        <Input
                          placeholder="Search patients or services..."
                          value={inpatientSearchQuery}
                          onChange={(e) => setInpatientSearchQuery(e.target.value)}
                          className="flex-1"
                          data-testid="search-inpatient"
                        />
                        <Label htmlFor="inpatient-doctor-filter">Doctor:</Label>
                        <Select value={selectedInpatientDoctor} onValueChange={setSelectedInpatientDoctor}>
                          <SelectTrigger className="w-48" data-testid="select-inpatient-doctor">
                            <SelectValue placeholder="Select doctor" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Doctors</SelectItem>
                            {doctorsFromApi.map((doctor: any) => (
                              <SelectItem key={doctor.id} value={doctor.id}>
                                {doctor.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Label htmlFor="inpatient-service-filter">Service:</Label>
                        <Select value={selectedService} onValueChange={setSelectedService}>
                          <SelectTrigger className="w-48" data-testid="select-inpatient-service">
                            <SelectValue placeholder="Select service" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Services</SelectItem>
                            <SelectItem value="admission">Admission Services</SelectItem>
                            <SelectItem value="procedures">Medical Procedures</SelectItem>
                            <SelectItem value="operations">Surgical Operations</SelectItem>
                            <SelectItem value="misc">Miscellaneous Services</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="border rounded-lg flex-1 flex flex-col min-h-0">
                        <div className="overflow-y-auto flex-1" style={{ maxHeight: 'calc(100vh - 400px)' }}>
                          <table className="w-full">
                            <thead className="border-b bg-background sticky top-0 z-10">
                              <tr>
                                <th className="text-left font-medium bg-background w-10 pl-3 pr-0">S.No</th>
                                <th className="text-left p-3 font-medium bg-background">Date</th>
                                <th className="text-left p-3 font-medium bg-background">Name</th>
                                <th className="text-left p-3 font-medium bg-background">Sex/Age</th>
                                <th className="text-left p-3 font-medium bg-background">Doctor</th>
                                <th className="text-left p-3 font-medium bg-background">Service</th>
                                <th className="text-right p-3 font-medium bg-background">Fees</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredInpatientServices.length === 0 ? (
                                <tr>
                                  <td colSpan={7} className="text-center py-4 text-muted-foreground">
                                    No Inpatient records found for the selected period
                                  </td>
                                </tr>
                              ) : (
                                filteredInpatientServices.map((item: any, index: number) => (
                                  <tr key={item.id} className="border-b hover:bg-muted/30">
                                    <td className="py-3 pl-3 pr-0">{index + 1}</td>
                                    <td className="p-3">
                                      {item.type === 'admission' ? (item.admissionDate ? new Date(item.admissionDate).toLocaleDateString('en-GB') : 'N/A') :
                                       (item.scheduledDate ? new Date(item.scheduledDate).toLocaleDateString('en-GB') : 'N/A')}
                                    </td>
                                    <td className="p-3">{item.patient?.name || item.patientName || "N/A"}</td>
                                    <td className="p-3">{formatGenderAge(item.patient || { name: item.patientName, age: item.patientAge, gender: item.patientGender })}</td>
                                    <td className="p-3">{item.doctorName && item.doctorName.trim() !== '' ? item.doctorName : getDoctorName(item.doctorId)}</td>
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
                            <span>Count: {filteredInpatientServices.length} | Total:</span>
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
        )}

        {mainActiveTab === "payments" && (
          <div className="h-full">
            <Card className="flex-1 flex flex-col h-full">
              <CardHeader className="flex-shrink-0">
                <CardTitle>Payment Transactions</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col overflow-hidden">
                <div className="border rounded-lg flex-1 flex flex-col min-h-0">
                  <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 400px)' }}>
                    <table className="w-full">
                      <thead className="border-b bg-background sticky top-0 z-10">
                          <tr>
                            <th className="text-left font-medium bg-background w-10 pl-3 pr-0">S.No</th>
                            <th className="text-left p-3 font-medium bg-background">Date</th>
                            <th className="text-left p-3 font-medium bg-background">Patient</th>
                            <th className="text-left p-3 font-medium bg-background">Payment Method</th>
                            <th className="text-right p-3 font-medium bg-background">Amount</th>
                          </tr>
                        </thead>
                      <tbody>
                        {patientPaymentsData.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="text-center py-4 text-muted-foreground">
                              No payment transactions found for the selected period
                            </td>
                          </tr>
                        ) : (
                          patientPaymentsData.map((payment: any, index: number) => (
                            <tr key={payment.id} className="border-b hover:bg-muted/50" data-testid={`row-credit-${index}`}>
                              <td className="py-3 pl-3 pr-0" data-testid={`text-credit-sno-${index}`}>{index + 1}</td>
                              <td className="p-3" data-testid={`text-credit-date-${index}`}>
                                {payment.paymentDate ? format(new Date(payment.paymentDate), 'dd MMM yyyy') : 'N/A'}
                              </td>
                              <td className="p-3" data-testid={`text-credit-patient-${index}`}>{payment.patientName || 'N/A'}</td>
                              <td className="p-3 capitalize" data-testid={`text-credit-method-${index}`}>{payment.paymentMethod}</td>
                              <td className="p-3 text-right" data-testid={`text-credit-amount-${index}`}>
                                {formatCurrency(payment.amount)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="border-t p-2 bg-muted/30 flex-shrink-0">
                    <div className="flex justify-between font-semibold">
                      <span>Count: {patientPaymentsData.length} | Total:</span>
                      <span data-testid="text-credit-total">{formatCurrency(patientPaymentsData.reduce((sum: number, payment: any) => sum + payment.amount, 0))}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}