import { useState, useMemo, Fragment, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  TestTube,
  Phone,
  Calendar,
  Eye,
  Filter,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Link } from "wouter";
import type { PathologyOrder, Patient, Doctor } from "@shared/schema";
import TopBar from "@/components/layout/topbar";

export default function LabTests() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedFromDate, setSelectedFromDate] = useState<string>("");
  const [selectedToDate, setSelectedToDate] = useState<string>("");
  const [expandedStatuses, setExpandedStatuses] = useState<Set<string>>(new Set());

  const toggleStatusSection = (status: string) => {
    const newExpanded = new Set(expandedStatuses);
    if (newExpanded.has(status)) {
      newExpanded.delete(status);
    } else {
      newExpanded.add(status);
    }
    setExpandedStatuses(newExpanded);
  };

  // Fetch server's today date for consistent timezone handling
  const { data: todayData } = useQuery<{ today: string }>({
    queryKey: ["/api/today"],
  });
  const today = todayData?.today || "";

  // Set default date range to today when data loads
  useEffect(() => {
    if (today && !selectedFromDate && !selectedToDate) {
      setSelectedFromDate(today);
      setSelectedToDate(today);
    }
  }, [today]);

  // Fetch all pathology orders
  const { data: pathologyOrders = [], isLoading } = useQuery({
    queryKey: ["/api/pathology"],
    refetchInterval: 30000,
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
        return dateB - dateA;
      });
    });

    return grouped;
  }, [pathologyOrders, searchQuery, selectedDoctor, selectedStatus, selectedFromDate, selectedToDate]);

  const getDoctorName = (doctorId: string | null) => {
    if (!doctorId) return "External Patient";
    const doctor = doctors.find(d => d.id === doctorId);
    return doctor ? doctor.name : "Unknown Doctor";
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    const d = new Date(dateString);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  const totalLabCount = pathologyOrders.length;
  const todayLabCount = today 
    ? pathologyOrders.filter((orderData: any) => orderData?.order?.orderedDate?.split('T')[0] === today).length 
    : 0;

  // Get unique statuses from pathology orders in the specified order
  const availableStatuses = useMemo(() => {
    const statuses = new Set<string>();
    pathologyOrders.forEach((orderData: any) => {
      if (orderData?.order?.status) {
        statuses.add(orderData.order.status);
      }
    });
    
    // Define the desired order
    const statusOrder = ["ordered", "paid", "collected", "processing", "completed", "cancelled"];
    
    // Sort statuses based on the desired order
    const sortedStatuses = Array.from(statuses).sort((a, b) => {
      const indexA = statusOrder.indexOf(a);
      const indexB = statusOrder.indexOf(b);
      // If both are in the defined order, sort by that order
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      // If only a is in the order, it comes first
      if (indexA !== -1) return -1;
      // If only b is in the order, it comes first
      if (indexB !== -1) return 1;
      // Otherwise, sort alphabetically
      return a.localeCompare(b);
    });
    
    return sortedStatuses;
  }, [pathologyOrders]);

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex justify-center items-center h-64">
          <p>Loading lab tests...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="h-full">
        <TopBar 
          title="Lab Tests"
          showDateFilter={true}
          fromDate={selectedFromDate}
          toDate={selectedToDate}
          onFromDateChange={setSelectedFromDate}
          onToDateChange={setSelectedToDate}
        />
        <div className="flex flex-col h-[calc(100%-84px)] pb-[24px] pt-[16px] pl-[24px] pr-[24px]">
          <Card className="flex flex-col h-full overflow-hidden rounded-b-md pl-[24px] pr-[24px]">
            {/* Fixed Header Section */}
            <div className="container mx-auto px-6 pt-6 pb-0 flex-shrink-0 pl-[0px] pr-[0px]">
              <div className="flex justify-between items-center mb-6 pl-[15px] pr-[15px]">
                <div>
                  <p className="text-muted-foreground">
                    Manage and view all lab tests by status
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge className="inline-flex items-center rounded-full border text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 px-3 py-1 bg-[#f6760a] text-[#ffffff]">
                    <Calendar className="w-4 h-4 mr-1" />
                    Today: {todayLabCount}
                  </Badge>
                  <Badge className="inline-flex items-center rounded-full border text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 px-3 py-1 bg-[#f6760a] text-[#ffffff]">
                    <TestTube className="w-4 h-4 mr-1" />
                    Total: {totalLabCount}
                  </Badge>
                </div>
              </div>

              {/* Filter Card - Fixed */}
              <Card className="rounded-b-none">
                <CardContent className="p-4 border-b bg-[#f6760a]/20 rounded-t-lg">
                  <div className="flex gap-4 items-center flex-wrap">
                    <div className="relative flex-grow min-w-[200px]">
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
                      <SelectTrigger data-testid="filter-doctor" className="w-64">
                        <SelectValue placeholder="Doctor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Doctors</SelectItem>
                        {doctors.map((doctor: Doctor) => (
                          <SelectItem key={doctor.id} value={doctor.id}>
                            {doctor.name}
                          </SelectItem>
                        ))}
                        <SelectItem value="external">External Patients</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                      <SelectTrigger data-testid="filter-status" className="w-36">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        {availableStatuses.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button 
                      variant="outline"
                      onClick={() => {
                        setSearchQuery("");
                        setSelectedDoctor("all");
                        setSelectedStatus("all");
                        setSelectedFromDate("");
                        setSelectedToDate("");
                      }}
                      data-testid="clear-filters"
                    >
                      <Filter className="w-4 h-4 mr-2" />
                      Clear
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto pb-[24px] ml-[0px] mr-[0px] scrollbar-blue">
              {Object.keys(labTestsByStatus).length === 0 ? (
                <div className="container mx-auto px-6 py-8 text-center">
                  <TestTube className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No lab tests found matching your criteria.</p>
                  <Link href="/pathology">
                    <Button className="mt-4">Order New Test</Button>
                  </Link>
                </div>
              ) : (
                <Card className="border bg-card text-card-foreground shadow-sm rounded-none rounded-b-md mt-[0px] mb-[0px] p-0 ml-[0px] mr-[0px] overflow-hidden">
                  <div className="overflow-x-auto w-full h-full">
                    <table className="w-full">
                      <tbody>
                        {(() => {
                          // Define the desired order of statuses
                          const statusOrder = ["ordered", "paid", "collected", "processing", "completed", "cancelled"];
                          
                          // Create ordered array of status entries, only including statuses that have data
                          const orderedEntries = statusOrder
                            .filter(status => labTestsByStatus[status])
                            .map(status => [status, labTestsByStatus[status]] as const);
                          
                          return orderedEntries.map(([status, orders]) => {
                            let rowNumber = 1;
                            const isExpanded = expandedStatuses.has(status);
                            return (
                              <Fragment key={status}>
                                {/* Status Section Header - Collapsible */}
                                <tr>
                                  <td colSpan={10} className="px-4 py-3 bg-blue-100 cursor-pointer hover:bg-blue-200 transition-colors w-full" onClick={() => toggleStatusSection(status)}>
                                    <div className="flex items-center gap-2 justify-between">
                                      <div className="flex items-center gap-2">
                                        {isExpanded ? (
                                          <ChevronDown className="w-5 h-5 text-blue-900 flex-shrink-0" />
                                        ) : (
                                          <ChevronRight className="w-5 h-5 text-blue-900 flex-shrink-0" />
                                        )}
                                        <span className="font-semibold text-lg text-blue-900">
                                          {status.charAt(0).toUpperCase() + status.slice(1)} Tests
                                        </span>
                                      </div>
                                      <Badge className="inline-flex items-center rounded-full border px-2.5 py-0.5 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-xs bg-[#0D71C9] text-[#ffffff] pl-[12px] pr-[12px] pt-[4px] pb-[4px]">
                                        {(orders as any[]).length} orders
                                      </Badge>
                                    </div>
                                  </td>
                                </tr>
                                {/* Table Header and Rows - Show only when expanded */}
                                {isExpanded && (
                                  <>
                                    {/* Table Header for this Status Section */}
                                    <tr className="border-b" style={{ backgroundColor: '#f7f7f7' }}>
                                      <th className="pl-4 pr-0 py-3 text-left text-sm font-semibold" style={{ color: '#6C757F', width: 'auto' }}>S.No</th>
                                      <th className="pl-4 pr-0 py-3 text-left text-sm font-semibold w-24" style={{ color: '#6C757F' }}>Date</th>
                                      <th className="pl-4 pr-0 py-3 text-left text-sm font-semibold w-16" style={{ color: '#6C757F' }}>Time</th>
                                      <th className="pl-4 pr-0 py-3 text-left text-sm font-semibold flex-grow min-w-32" style={{ color: '#6C757F' }}>Order ID</th>
                                      <th className="pl-4 pr-0 py-3 text-left text-sm font-semibold flex-grow min-w-48" style={{ color: '#6C757F' }}>Patient Name</th>
                                      <th className="pl-4 pr-0 py-3 text-sm font-semibold w-20 text-center" style={{ color: '#6C757F' }}>Sex/Age</th>
                                      <th className="pl-4 pr-0 py-3 text-left text-sm font-semibold w-32" style={{ color: '#6C757F' }}>Contact</th>
                                      <th className="pl-4 pr-0 py-3 text-left text-sm font-semibold w-40" style={{ color: '#6C757F' }}>Doctor</th>
                                      <th className="py-3 text-sm font-semibold w-24 pl-[24px] pr-[24px] text-center" style={{ color: '#6C757F' }}>Amount</th>
                                      <th className="py-3 text-center text-sm font-semibold w-12 pl-[16px] pr-[16px] border-l-2" style={{ color: '#6C757F', borderLeftColor: '#D6E7FE' }}>View</th>
                                    </tr>
                                    {/* Order Rows */}
                                    {(orders as any[]).map((orderData: any) => (
                                      <tr key={orderData.order.id} className="border-b hover:bg-muted/50 transition-colors">
                                        <td className="py-3 text-sm whitespace-nowrap pl-[0px] pr-[0px] text-center">{rowNumber++}</td>
                                        <td className="pl-4 pr-0 py-3 text-sm whitespace-nowrap">
                                          {formatDate(orderData.order.orderedDate)}
                                        </td>
                                        <td className="pl-4 pr-0 py-3 text-sm whitespace-nowrap">
                                          {orderData.order.orderedDate ? (() => {
                                            const time = orderData.order.orderedDate.split('T')[1]?.substring(0, 5) || 'N/A';
                                            return time;
                                          })() : 'N/A'}
                                        </td>
                                        <td className="pl-4 pr-0 py-3 text-sm">
                                          <div className="font-medium">{orderData.order.orderId}</div>
                                        </td>
                                        <td className="pl-4 pr-0 py-3 text-sm">
                                          <div className="font-medium">{orderData.patient?.name || 'Unknown'}</div>
                                          <div className="text-xs text-muted-foreground">{orderData.patient?.patientId || 'N/A'}</div>
                                        </td>
                                        <td className="pl-4 pr-0 py-3 text-sm whitespace-nowrap text-center">
                                          {orderData.patient?.gender ? orderData.patient.gender.charAt(0).toUpperCase() : '-'}/{orderData.patient?.age || '-'}
                                        </td>
                                        <td className="pl-4 pr-0 py-3 text-sm whitespace-nowrap">
                                          {orderData.patient?.phone || 'N/A'}
                                        </td>
                                        <td className="pl-4 pr-0 py-3 text-sm whitespace-nowrap">
                                          {getDoctorName(orderData.order.doctorId)}
                                        </td>
                                        <td className="py-3 text-sm whitespace-nowrap pl-[24px] pr-[24px] text-center">
                                          ₹{orderData.order.totalPrice}
                                        </td>
                                        <td className="py-3 text-center whitespace-nowrap pl-[16px] pr-[16px] border-l-2" style={{ borderLeftColor: '#D6E7FE' }}>
                                          <Link href={`/pathology`}>
                                            <Button variant="ghost" size="icon" data-testid={`view-order-${orderData.order.id}`}>
                                              <Eye className="w-4 h-4" />
                                            </Button>
                                          </Link>
                                        </td>
                                      </tr>
                                    ))}
                                  </>
                                )}
                              </Fragment>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
