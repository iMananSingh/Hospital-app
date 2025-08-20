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
import { TestTube, Eye, Edit, Search, Plus, FileText } from "lucide-react";
import { insertPathologyTestSchema } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { PathologyTest, Patient, Doctor } from "@shared/schema";

export default function Pathology() {
  const [isNewTestOpen, setIsNewTestOpen] = useState(false);
  const [selectedTest, setSelectedTest] = useState<PathologyTest | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { toast } = useToast();

  const { data: pathologyTests, isLoading } = useQuery({
    queryKey: ["/api/pathology"],
  });

  const { data: patients } = useQuery({
    queryKey: ["/api/patients"],
  });

  const { data: doctors } = useQuery({
    queryKey: ["/api/doctors"],
  });

  const createTestMutation = useMutation({
    mutationFn: async (testData: any) => {
      const response = await fetch("/api/pathology", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
        },
        body: JSON.stringify(testData),
      });
      
      if (!response.ok) {
        throw new Error("Failed to create pathology test");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pathology"] });
      setIsNewTestOpen(false);
      form.reset();
      toast({
        title: "Test ordered successfully",
        description: "The pathology test has been ordered.",
      });
    },
    onError: () => {
      toast({
        title: "Error ordering test",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const form = useForm({
    resolver: zodResolver(insertPathologyTestSchema),
    defaultValues: {
      patientId: "",
      doctorId: "",
      testName: "",
      testCategory: "",
      orderedDate: new Date().toISOString().split('T')[0],
      remarks: "",
    },
  });

  const onSubmit = (data: any) => {
    createTestMutation.mutate(data);
  };

  const filteredTests = pathologyTests?.filter((test: PathologyTest) => {
    const matchesSearch = test.testName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         test.testId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || test.status === statusFilter;
    return matchesSearch && matchesStatus;
  }) || [];

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
    const patient = patients?.find((p: Patient) => p.id === patientId);
    return patient?.name || "Unknown Patient";
  };

  const getDoctorName = (doctorId: string) => {
    const doctor = doctors?.find((d: Doctor) => d.id === doctorId);
    return doctor?.name || "Unknown Doctor";
  };

  const testCategories = [
    "Blood Test",
    "Urine Test", 
    "Stool Test",
    "Biochemistry",
    "Microbiology",
    "Pathology",
    "Radiology",
    "Cardiology"
  ];

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
                    <CardTitle>All Pathology Tests</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Total: {filteredTests.length} tests
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
                ) : filteredTests.length === 0 ? (
                  <div className="text-center py-8">
                    <TestTube className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No pathology tests found</p>
                    <Button 
                      onClick={() => setIsNewTestOpen(true)}
                      className="mt-4"
                      data-testid="button-first-test"
                    >
                      Order your first test
                    </Button>
                  </div>
                ) : (
                  <Table data-testid="pathology-tests-table">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Test ID</TableHead>
                        <TableHead>Test Name</TableHead>
                        <TableHead>Patient</TableHead>
                        <TableHead>Doctor</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Ordered Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTests.map((test: PathologyTest) => (
                        <TableRow key={test.id} data-testid={`test-row-${test.id}`}>
                          <TableCell className="font-medium" data-testid={`test-id-${test.id}`}>
                            {test.testId}
                          </TableCell>
                          <TableCell data-testid={`test-name-${test.id}`}>
                            {test.testName}
                          </TableCell>
                          <TableCell data-testid={`test-patient-${test.id}`}>
                            {getPatientName(test.patientId)}
                          </TableCell>
                          <TableCell data-testid={`test-doctor-${test.id}`}>
                            {getDoctorName(test.doctorId)}
                          </TableCell>
                          <TableCell data-testid={`test-category-${test.id}`}>
                            {test.testCategory}
                          </TableCell>
                          <TableCell data-testid={`test-ordered-${test.id}`}>
                            {formatDate(test.orderedDate)}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant="secondary" 
                              className={getStatusColor(test.status)}
                              data-testid={`test-status-${test.id}`}
                            >
                              {test.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => setSelectedTest(test)}
                                data-testid={`button-view-${test.id}`}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                data-testid={`button-edit-${test.id}`}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
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
                <p className="text-sm text-muted-foreground">
                  Tests that require attention (ordered, collected, processing)
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredTests
                    .filter(test => ["ordered", "collected", "processing"].includes(test.status))
                    .map((test: PathologyTest) => (
                      <div 
                        key={test.id} 
                        className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                        data-testid={`pending-test-${test.id}`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{test.testName}</p>
                            <p className="text-sm text-muted-foreground">
                              {test.testId} • {getPatientName(test.patientId)}
                            </p>
                          </div>
                          <div className="text-right">
                            <Badge className={getStatusColor(test.status)}>
                              {test.status}
                            </Badge>
                            <p className="text-sm text-muted-foreground mt-1">
                              {formatDate(test.orderedDate)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  }
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="completed">
            <Card>
              <CardHeader>
                <CardTitle>Completed Tests</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Tests with results available
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredTests
                    .filter(test => test.status === "completed")
                    .map((test: PathologyTest) => (
                      <div 
                        key={test.id} 
                        className="p-4 border rounded-lg"
                        data-testid={`completed-test-${test.id}`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{test.testName}</p>
                            <p className="text-sm text-muted-foreground">
                              {test.testId} • {getPatientName(test.patientId)}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge className="bg-green-100 text-green-800">
                              Completed
                            </Badge>
                            <Button size="sm" data-testid={`view-report-${test.id}`}>
                              <FileText className="w-4 h-4 mr-2" />
                              View Report
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  }
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* New Test Order Dialog */}
      <Dialog open={isNewTestOpen} onOpenChange={setIsNewTestOpen}>
        <DialogContent className="max-w-2xl" data-testid="new-test-dialog">
          <DialogHeader>
            <DialogTitle>Order Pathology Test</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="patientId">Patient *</Label>
                <Select onValueChange={(value) => form.setValue("patientId", value)}>
                  <SelectTrigger data-testid="select-patient">
                    <SelectValue placeholder="Select patient" />
                  </SelectTrigger>
                  <SelectContent>
                    {patients?.map((patient: Patient) => (
                      <SelectItem key={patient.id} value={patient.id}>
                        {patient.name} ({patient.patientId})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.patientId && (
                  <p className="text-sm text-destructive">{form.formState.errors.patientId.message}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="doctorId">Ordering Doctor *</Label>
                <Select onValueChange={(value) => form.setValue("doctorId", value)}>
                  <SelectTrigger data-testid="select-doctor">
                    <SelectValue placeholder="Select doctor" />
                  </SelectTrigger>
                  <SelectContent>
                    {doctors?.map((doctor: Doctor) => (
                      <SelectItem key={doctor.id} value={doctor.id}>
                        {doctor.name} ({doctor.specialization})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.doctorId && (
                  <p className="text-sm text-destructive">{form.formState.errors.doctorId.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="testName">Test Name *</Label>
                <Input
                  id="testName"
                  {...form.register("testName")}
                  placeholder="e.g., Complete Blood Count"
                  data-testid="input-test-name"
                />
                {form.formState.errors.testName && (
                  <p className="text-sm text-destructive">{form.formState.errors.testName.message}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="testCategory">Category *</Label>
                <Select onValueChange={(value) => form.setValue("testCategory", value)}>
                  <SelectTrigger data-testid="select-test-category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {testCategories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.testCategory && (
                  <p className="text-sm text-destructive">{form.formState.errors.testCategory.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="orderedDate">Order Date *</Label>
              <Input
                id="orderedDate"
                type="date"
                {...form.register("orderedDate")}
                data-testid="input-order-date"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="remarks">Clinical Notes / Remarks</Label>
              <Textarea
                id="remarks"
                {...form.register("remarks")}
                placeholder="Enter any clinical notes or special instructions"
                rows={3}
                data-testid="input-remarks"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsNewTestOpen(false)}
                data-testid="button-cancel-test"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createTestMutation.isPending}
                className="bg-medical-blue hover:bg-medical-blue/90"
                data-testid="button-order-test"
              >
                {createTestMutation.isPending ? "Ordering..." : "Order Test"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Test Details Dialog */}
      {selectedTest && (
        <Dialog open={!!selectedTest} onOpenChange={() => setSelectedTest(null)}>
          <DialogContent className="max-w-2xl" data-testid="test-details-dialog">
            <DialogHeader>
              <DialogTitle>Test Details - {selectedTest.testId}</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Test Name</Label>
                  <p className="font-medium" data-testid="detail-test-name">{selectedTest.testName}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Category</Label>
                  <p className="font-medium" data-testid="detail-test-category">{selectedTest.testCategory}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Patient</Label>
                  <p className="font-medium" data-testid="detail-patient-name">{getPatientName(selectedTest.patientId)}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Ordering Doctor</Label>
                  <p className="font-medium" data-testid="detail-doctor-name">{getDoctorName(selectedTest.doctorId)}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Ordered Date</Label>
                  <p className="font-medium" data-testid="detail-ordered-date">{formatDate(selectedTest.orderedDate)}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Collected Date</Label>
                  <p className="font-medium" data-testid="detail-collected-date">{formatDate(selectedTest.collectedDate || '')}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Report Date</Label>
                  <p className="font-medium" data-testid="detail-report-date">{formatDate(selectedTest.reportDate || '')}</p>
                </div>
              </div>

              <div>
                <Label className="text-sm text-muted-foreground">Status</Label>
                <Badge className={getStatusColor(selectedTest.status)} data-testid="detail-status">
                  {selectedTest.status}
                </Badge>
              </div>

              {selectedTest.remarks && (
                <div>
                  <Label className="text-sm text-muted-foreground">Clinical Notes</Label>
                  <p className="font-medium" data-testid="detail-remarks">{selectedTest.remarks}</p>
                </div>
              )}

              {selectedTest.results && (
                <div>
                  <Label className="text-sm text-muted-foreground">Results</Label>
                  <p className="font-medium" data-testid="detail-results">{selectedTest.results}</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
