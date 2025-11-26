import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  User, 
  TestTube,
  Phone,
  Calendar,
  Eye,
} from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import type { PathologyOrder, Patient, Doctor } from "@shared/schema";
import TopBar from "@/components/layout/topbar";

export default function LabTests() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedFromDate, setSelectedFromDate] = useState<string>("");
  const [selectedToDate, setSelectedToDate] = useState<string>("");

  // Fetch all pathology orders
  const { data: pathologyOrders = [], isLoading } = useQuery({
    queryKey: ["/api/pathology"],
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Fetch patients for order details
  const { data: patients = [] } = useQuery<Patient[]>({
    queryKey: ["/api/patients"],
  });

  // Fetch doctors for filtering
  const { data: doctors = [] } = useQuery<Doctor[]>({
    queryKey: ["/api/doctors"],
  });

  // Group lab tests by status
  const labTestsByStatus = useMemo(() => {
    const filtered = pathologyOrders.filter((orderData: any) => {
      if (!orderData?.order) return false;
      const order = orderData.order;
      const patient = orderData.patient;

      const matchesSearch = searchQuery === "" || 
        order.orderId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        patient?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        patient?.patientId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        patient?.phone?.includes(searchQuery);

      const matchesDoctor = selectedDoctor === "all" || order.doctorId === selectedDoctor || 
        (selectedDoctor === "external" && !order.doctorId);
      const matchesStatus = selectedStatus === "all" || order.status === selectedStatus;
      
      const matchesDateRange = (() => {
        if (!selectedFromDate && !selectedToDate) return true;
        const orderDate = order.orderedDate?.split('T')[0];
        if (!orderDate) return false;
        
        if (selectedFromDate && selectedToDate) {
          return orderDate >= selectedFromDate && orderDate <= selectedToDate;
        } else if (selectedFromDate) {
          return orderDate >= selectedFromDate;
        } else if (selectedToDate) {
          return orderDate <= selectedToDate;
        }
        return true;
      })();

      return matchesSearch && matchesDoctor && matchesStatus && matchesDateRange;
    });

    const grouped = filtered.reduce((groups, orderData) => {
      const order = orderData.order;
      const status = order.status || "ordered";
      if (!groups[status]) {
        groups[status] = [];
      }
      groups[status].push(orderData);
      return groups;
    }, {} as Record<string, any[]>);

    // Sort orders within each status group by ordered date
    Object.values(grouped).forEach(orders => {
      orders.sort((a, b) => {
        const dateA = new Date(a.order.orderedDate).getTime();
        const dateB = new Date(b.order.orderedDate).getTime();
        return dateB - dateA; // Most recent first
      });
    });

    return grouped;
  }, [pathologyOrders, searchQuery, selectedDoctor, selectedStatus, selectedFromDate, selectedToDate]);

  const getDoctorName = (doctorId: string | null) => {
    if (!doctorId) return "External Patient";
    const doctor = doctors.find(d => d.id === doctorId);
    return doctor ? `Dr. ${doctor.name}` : "Unknown Doctor";
  };

  const getPatientDetails = (patientId: string) => {
    return patients.find(p => p.id === patientId);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "ordered": return "secondary";
      case "collected": return "default";
      case "processing": return "outline";
      case "completed": return "default";
      default: return "outline";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'collected':
        return 'bg-yellow-100 text-yellow-800';
      case 'ordered':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const totalLabCount = pathologyOrders.length;
  // Use Indian timezone (UTC+5:30) for consistent date calculation
  const now = new Date();
  const indianTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
  const today = indianTime.getFullYear() + '-' + 
    String(indianTime.getMonth() + 1).padStart(2, '0') + '-' + 
    String(indianTime.getDate()).padStart(2, '0');
  const todayLabCount = pathologyOrders.filter((orderData: any) => {
    const orderDate = orderData?.order?.orderedDate;
    if (!orderDate) return false;
    // Extract date part (YYYY-MM-DD) from datetime string
    const dateOnly = orderDate.split('T')[0];
    return dateOnly === today;
  }).length;

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <TopBar />
        <div className="flex justify-center items-center h-64">
          <p>Loading lab tests...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <TopBar 
        title="Lab Tests"
        showDateFilter={true}
        fromDate={selectedFromDate}
        toDate={selectedToDate}
        onFromDateChange={setSelectedFromDate}
        onToDateChange={setSelectedToDate}
        actions={
          <>
            <Badge variant="outline" className="px-3 py-1">
              <Calendar className="w-4 h-4 mr-1" />
              Today: {todayLabCount}
            </Badge>
            <Badge variant="outline" className="px-3 py-1 ml-2">
              <TestTube className="w-4 h-4 mr-1" />
              Total: {totalLabCount}
            </Badge>
          </>
        }
      />
      <div className="container mx-auto p-6">

        {/* Filters */}
        <Card className="mb-6 sticky top-[84px] z-40 bg-background">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground mb-4">
              Manage and view all pathology orders by status
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
              <div className="relative lg:col-span-2">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by order ID, name, patient ID, or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="search-lab-tests"
                />
              </div>

              <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
                <SelectTrigger data-testid="filter-doctor">
                  <SelectValue placeholder="Filter by doctor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Doctors</SelectItem>
                  {doctors.map((doctor: Doctor) => (
                    <SelectItem key={doctor.id} value={doctor.id}>
                      {doctor.name} - {doctor.specialization}
                    </SelectItem>
                  ))}
                  <SelectItem value="external">External Patients</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger data-testid="filter-status">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="ordered">Ordered</SelectItem>
                  <SelectItem value="collected">Collected</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>

              <Button 
                variant="outline"
                className="h-10 px-4 w-fit justify-self-end"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedDoctor("all");
                  setSelectedStatus("all");
                  setSelectedFromDate("");
                  setSelectedToDate("");
                }}
                data-testid="clear-filters"
              >
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Lab Tests by Status */}
        {Object.keys(labTestsByStatus).length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <TestTube className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No lab tests found matching your criteria.</p>
              <Link href="/pathology">
                <Button className="mt-4">Order New Test</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div>
            {Object.entries(labTestsByStatus).map(([status, orders]) => (
              <Card key={status}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TestTube className="w-5 h-5" />
                    {status.charAt(0).toUpperCase() + status.slice(1)} Tests
                    <Badge variant="outline">{orders.length} orders</Badge>
                  </CardTitle>
                  <CardDescription>
                    Lab tests with {status} status
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {orders.map((orderData: any) => {
                      const order = orderData.order;
                      const patient = orderData.patient;
                      const doctor = orderData.doctor;
                      const orderedDate = new Date(order.orderedDate);

                      return (
                        <div
                          key={order.id}
                          className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <User className="w-4 h-4 text-muted-foreground" />
                                <span className="font-medium">
                                  {patient?.name || "Unknown Patient"}
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  {order.orderId}
                                </Badge>
                              </div>

                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {formatDate(order.orderedDate)}
                                </div>
                                <div className="flex items-center gap-1">
                                  <TestTube className="w-3 h-3" />
                                  {getDoctorName(order.doctorId)}
                                </div>
                                {patient?.phone && (
                                  <div className="flex items-center gap-1">
                                    <Phone className="w-3 h-3" />
                                    {patient.phone}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <Badge 
                              className={getStatusColor(order.status)}
                              variant="secondary"
                              data-testid={`status-${order.id}`}
                            >
                              {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                            </Badge>

                            <div className="text-right">
                              <div className="font-medium">₹{order.totalPrice}</div>
                              <div className="text-xs text-muted-foreground">
                                Total Amount
                              </div>
                            </div>

                            <Link href={`/pathology`}>
                              <Button variant="outline" size="sm" data-testid={`view-order-${order.id}`}>
                                <Eye className="w-4 h-4" />
                              </Button>
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}