import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import TopBar from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TestTube, Eye, Search, Plus, ShoppingCart } from "lucide-react";
import { insertPathologyOrderSchema } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { PathologyOrder, Patient, Doctor } from "@shared/schema";

export default function Pathology() {
  const [isNewTestOpen, setIsNewTestOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedCatalogTests, setSelectedCatalogTests] = useState<any[]>([]);
  const { toast } = useToast();

  const { data: pathologyOrders, isLoading } = useQuery({
    queryKey: ["/api/pathology"],
  });

  const { data: testCatalog } = useQuery({
    queryKey: ["/api/pathology/catalog"],
  });

  const { data: categories } = useQuery({
    queryKey: ["/api/pathology/catalog/categories"],
  });

  const { data: patients } = useQuery({
    queryKey: ["/api/patients"],
  });

  const { data: doctors } = useQuery({
    queryKey: ["/api/doctors"],
  });

  const createOrderMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log("Sending order data:", data);
      const response = await fetch("/api/pathology", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error("Order creation failed:", errorData);
        throw new Error(`Failed to create pathology order: ${errorData}`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pathology"] });
      setIsNewTestOpen(false);
      setSelectedCatalogTests([]);
      form.reset();
      toast({
        title: "Order placed successfully",
        description: "The pathology order has been placed.",
      });
    },
    onError: (error) => {
      console.error("Order mutation error:", error);
      toast({
        title: "Error placing order",
        description: `Please try again. ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const form = useForm({
    resolver: zodResolver(insertPathologyOrderSchema),
    defaultValues: {
      patientId: "",
      doctorId: "",
      orderedDate: new Date().toISOString().split('T')[0],
      remarks: "",
    },
  });

  const onSubmit = (data: any) => {
    if (selectedCatalogTests.length === 0) {
      toast({
        title: "No tests selected",
        description: "Please select at least one test from the catalog.",
        variant: "destructive",
      });
      return;
    }

    // Create single order with multiple tests
    const orderData = {
      patientId: data.patientId,
      doctorId: data.doctorId === "external" ? null : data.doctorId, // Make doctor optional
      orderedDate: data.orderedDate,
      remarks: data.remarks,
    };

    const tests = selectedCatalogTests.map(test => ({
      testName: test.test_name,
      testCategory: test.category,
      price: test.price,
    }));

    createOrderMutation.mutate({ orderData, tests });
  };

  const filteredOrders = (pathologyOrders || []).filter((orderData: any) => {
    if (!orderData?.order) return false;
    const order = orderData.order;
    const patient = orderData.patient;
    const matchesSearch = order.orderId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         patient?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         patient?.patientId?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredCatalog = (testCatalog || []).filter((test: any) => {
    const matchesCategory = selectedCategory === "all" || test.category === selectedCategory;
    const matchesSearch = test.test_name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

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

  const getPatientName = (patientId: string) => {
    const patient = (patients || []).find((p: Patient) => p.id === patientId);
    return patient?.name || "Unknown Patient";
  };

  const getDoctorName = (doctorId: string | null) => {
    if (!doctorId) return "External Patient";
    const doctor = (doctors || []).find((d: Doctor) => d.id === doctorId);
    return doctor?.name || "Unknown Doctor";
  };

  const toggleTestSelection = (test: any) => {
    const isSelected = selectedCatalogTests.some(t => t.test_name === test.test_name);
    if (isSelected) {
      setSelectedCatalogTests(prev => prev.filter(t => t.test_name !== test.test_name));
    } else {
      setSelectedCatalogTests(prev => [...prev, test]);
    }
  };

  const getTotalPrice = () => {
    return selectedCatalogTests.reduce((total, test) => total + test.price, 0);
  };

  return (
    <div className="space-y-6">
      <TopBar 
        title="Pathology Tests"
        searchPlaceholder="Search tests by name or ID..."
        onSearch={setSearchQuery}
        onNewAction={() => setIsNewTestOpen(true)}
        newActionLabel="Order Test"
      />
      
      <div className="p-6">
        <Tabs defaultValue="all-tests" className="space-y-6">
          <TabsList>
            <TabsTrigger value="all-tests" data-testid="tab-all-tests">All Tests</TabsTrigger>
            <TabsTrigger value="pending" data-testid="tab-pending-tests">Pending</TabsTrigger>
            <TabsTrigger value="completed" data-testid="tab-completed-tests">Completed</TabsTrigger>
          </TabsList>

          <TabsContent value="all-tests">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>All Pathology Orders</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Total: {filteredOrders.length} orders
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-40" data-testid="filter-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="ordered">Ordered</SelectItem>
                        <SelectItem value="collected">Collected</SelectItem>
                        <SelectItem value="processing">Processing</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-medical-blue mx-auto"></div>
                    <p className="text-sm text-muted-foreground mt-2">Loading tests...</p>
                  </div>
                ) : filteredOrders.length === 0 ? (
                  <div className="text-center py-8">
                    <TestTube className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No orders found</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      No pathology orders match your current search criteria.
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order ID</TableHead>
                        <TableHead>Patient</TableHead>
                        <TableHead>Doctor</TableHead>
                        <TableHead>Date Ordered</TableHead>
                        <TableHead>Tests Count</TableHead>
                        <TableHead>Total Price</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrders.map((orderData: any) => {
                        const order = orderData.order;
                        const patient = orderData.patient;
                        const doctor = orderData.doctor;
                        return (
                          <TableRow key={order.id} data-testid={`order-row-${order.id}`}>
                            <TableCell className="font-medium">{order.orderId}</TableCell>
                            <TableCell>{patient?.name || "Unknown Patient"}</TableCell>
                            <TableCell>{doctor?.name || "External Patient"}</TableCell>
                            <TableCell>{formatDate(order.orderedDate)}</TableCell>
                            <TableCell>Loading...</TableCell>
                            <TableCell>₹{order.totalPrice}</TableCell>
                            <TableCell>
                              <Badge className={getStatusColor(order.status)} variant="secondary">
                                {order.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedOrder(order)}
                                data-testid={`view-order-${order.id}`}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pending">
            <Card>
              <CardHeader>
                <CardTitle>Pending Tests</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">Pending tests will be displayed here</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="completed">
            <Card>
              <CardHeader>
                <CardTitle>Completed Tests</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">Completed tests will be displayed here</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Order New Test Dialog */}
      <Dialog open={isNewTestOpen} onOpenChange={setIsNewTestOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Order Pathology Tests</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="patientId">Patient *</Label>
                <Select 
                  onValueChange={(value) => form.setValue("patientId", value)}
                  data-testid="select-patient"
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select patient" />
                  </SelectTrigger>
                  <SelectContent>
                    {(patients || []).map((patient: Patient) => (
                      <SelectItem key={patient.id} value={patient.id}>
                        {patient.name} ({patient.patientId})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="doctorId">Doctor (Optional for External Patients)</Label>
                <Select 
                  onValueChange={(value) => form.setValue("doctorId", value)}
                  data-testid="select-doctor"
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select doctor (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="external">External Patient (No Doctor)</SelectItem>
                    {(doctors || []).map((doctor: Doctor) => (
                      <SelectItem key={doctor.id} value={doctor.id}>
                        {doctor.name} - {doctor.specialization}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Select Tests from Catalog</Label>
                <div className="flex items-center space-x-2">
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {(categories || []).map((category: string) => (
                        <SelectItem key={category} value={category}>{category}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="border rounded-lg max-h-64 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Select</TableHead>
                      <TableHead>Test Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Price (₹)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCatalog.map((test: any, index: number) => {
                      const isSelected = selectedCatalogTests.some(t => t.test_name === test.test_name);
                      return (
                        <TableRow 
                          key={`${test.category}-${test.test_name}-${index}`}
                          className={isSelected ? "bg-blue-50" : ""}
                        >
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleTestSelection(test)}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                          </TableCell>
                          <TableCell className="font-medium">{test.test_name}</TableCell>
                          <TableCell>{test.category}</TableCell>
                          <TableCell>₹{test.price}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {selectedCatalogTests.length > 0 && (
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">Selected Tests ({selectedCatalogTests.length})</h4>
                  <div className="space-y-1">
                    {selectedCatalogTests.map((test, index) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span>{test.test_name}</span>
                        <span>₹{test.price}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-blue-200 mt-2 pt-2 font-medium text-blue-900">
                    Total: ₹{getTotalPrice()}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="remarks">Remarks</Label>
              <Textarea
                {...form.register("remarks")}
                placeholder="Enter any additional remarks or instructions"
                data-testid="input-remarks"
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsNewTestOpen(false)}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createOrderMutation.isPending || selectedCatalogTests.length === 0}
                data-testid="button-order-tests"
              >
                {createOrderMutation.isPending ? "Ordering..." : `Order ${selectedCatalogTests.length} Test(s)`}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Order Details Dialog */}
      {selectedOrder && (
        <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Order Details - {selectedOrder.orderId}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Patient</Label>
                  <p className="text-sm text-muted-foreground">{getPatientName(selectedOrder.patientId)}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Doctor</Label>
                  <p className="text-sm text-muted-foreground">{getDoctorName(selectedOrder.doctorId)}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Status</Label>
                  <Badge className={getStatusColor(selectedOrder.status)} variant="secondary">
                    {selectedOrder.status}
                  </Badge>
                </div>
                <div>
                  <Label className="text-sm font-medium">Date Ordered</Label>
                  <p className="text-sm text-muted-foreground">{formatDate(selectedOrder.orderedDate)}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Total Price</Label>
                  <p className="text-sm text-muted-foreground">₹{selectedOrder.totalPrice}</p>
                </div>
              </div>
              {selectedOrder.remarks && (
                <div>
                  <Label className="text-sm font-medium">Remarks</Label>
                  <p className="text-sm text-muted-foreground">{selectedOrder.remarks}</p>
                </div>
              )}
              
              <div className="mt-6">
                <Label className="text-sm font-medium">Tests in this Order</Label>
                <div className="mt-2 border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Test Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Price (₹)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          Loading test details...
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}