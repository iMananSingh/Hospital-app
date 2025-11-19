import { useState, useEffect, useRef } from "react";
import { useParams } from "wouter";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import TopBar from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Download, Stethoscope, IndianRupee, Calculator, Wallet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

interface Doctor {
  id: string;
  name: string;
  specialization: string;
  qualification: string;
  consultationFee: number;
  profilePicture?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface DoctorEarning {
  earningId: string;
  serviceName: string;
  serviceCategory: string;
  serviceDate: string;
  earnedAmount: number;
  status: string;
  patientId: string;
  servicePrice: number;
  rateType: string;
  rateAmount: number;
}

interface DoctorRate {
  id: string;
  serviceName: string;
  serviceCategory: string;
  rateType: string;
  rateAmount: number;
  isActive: boolean;
}

export default function DoctorDetail() {
  const { doctorId } = useParams<{ doctorId: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch doctor details
  const { data: doctor, isLoading: isDoctorLoading } = useQuery({
    queryKey: ["/api/doctors", doctorId],
    enabled: !!doctorId,
  });

  // Fetch doctor earnings - fetch all statuses to see the complete picture
  const { data: earnings = [], isLoading: isEarningsLoading, refetch: refetchEarnings } = useQuery({
    queryKey: ["/api/doctors", doctorId, "earnings"],
    enabled: !!doctorId,
  });

  // Fetch doctor salary rates
  const { data: salaryRates = [], isLoading: isRatesLoading } = useQuery({
    queryKey: ["/api/doctors", doctorId, "salary-rates"],
    enabled: !!doctorId,
  });

  // Sync preview image with doctor profile picture
  useEffect(() => {
    if (doctor?.profilePicture) {
      setPreviewImage(doctor.profilePicture);
    }
  }, [doctor]);

  // Mutation for updating profile picture
  const updateProfilePictureMutation = useMutation({
    mutationFn: async (profilePicture: string) => {
      const response = await fetch(`/api/doctors/${doctorId}/profile-picture`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
        },
        body: JSON.stringify({ profilePicture }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update profile picture");
      }

      return response.json();
    },
    onSuccess: (updatedDoctor) => {
      toast({
        title: "Profile picture updated",
        description: "Doctor profile picture has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/doctors", doctorId] });
      queryClient.invalidateQueries({ queryKey: ["/api/doctors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/recent-activities"] });
      setPreviewImage(updatedDoctor.profilePicture || null);
      setIsImageDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update profile picture",
        variant: "destructive",
      });
    },
  });

  // Mutation for marking individual earning as paid
  const markEarningAsPaidMutation = useMutation({
    mutationFn: async (earningId: string) => {
      const response = await fetch(`/api/doctors/earnings/${earningId}/mark-paid`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to mark earning as paid");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Earning marked as paid",
        description: "The earning has been successfully marked as paid.",
      });
      // Invalidate all related queries to update pending amounts everywhere
      queryClient.invalidateQueries({ queryKey: ["/api/doctors", doctorId, "earnings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/doctors", doctorId] });
      queryClient.invalidateQueries({ queryKey: ["/api/doctors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/doctors/all-earnings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/recent-activities"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to mark as paid",
        description: error.message || "An error occurred while marking the earning as paid",
        variant: "destructive",
      });
    },
  });

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 2MB",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setPreviewImage(base64String);
      updateProfilePictureMutation.mutate(base64String);
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteImage = () => {
    setPreviewImage(null);
    updateProfilePictureMutation.mutate("");
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const exportToExcel = () => {
    if (!doctor) return;

    try {
      // Create a new workbook
      const workbook = XLSX.utils.book_new();

      // Doctor Summary Sheet
      const doctorSummary = [
        ["Doctor Details", ""],
        ["Name", doctor.name],
        ["Specialization", doctor.specialization],
        ["Qualification", doctor.qualification],
        ["Consultation Fee", doctor.consultationFee],
        ["Status", doctor.isActive ? "Active" : "Inactive"],
        ["Joined Date", formatDate(doctor.createdAt)],
        [""],
        ["Earnings Summary", ""],
        ["Total Pending Earnings", earnings.filter((e: DoctorEarning) => e.status === 'pending').reduce((sum: number, e: DoctorEarning) => sum + e.earnedAmount, 0)],
        ["Total Services", earnings.length],
        [""],
      ];

      const summarySheet = XLSX.utils.aoa_to_sheet(doctorSummary);
      XLSX.utils.book_append_sheet(workbook, summarySheet, "Doctor Summary");

      // Salary Rates Sheet
      if (salaryRates.length > 0) {
        const ratesData = [
          ["Service Name", "Category", "Rate Type", "Rate Amount", "Status"],
          ...salaryRates.map((rate: DoctorRate) => [
            rate.serviceName,
            rate.serviceCategory,
            rate.rateType,
            rate.rateAmount,
            rate.isActive ? "Active" : "Inactive"
          ])
        ];

        const ratesSheet = XLSX.utils.aoa_to_sheet(ratesData);
        XLSX.utils.book_append_sheet(workbook, ratesSheet, "Salary Rates");
      }

      // Earnings Sheet
      if (earnings.length > 0) {
        const earningsData = [
          ["Earning ID", "Service Name", "Category", "Date", "Service Price", "Rate Type", "Rate Amount", "Earned Amount", "Status"],
          ...earnings.map((earning: DoctorEarning) => [
            earning.earningId,
            earning.serviceName,
            earning.serviceCategory,
            formatDate(earning.serviceDate),
            earning.servicePrice,
            earning.rateType,
            earning.rateAmount,
            earning.earnedAmount,
            earning.status
          ])
        ];

        const earningsSheet = XLSX.utils.aoa_to_sheet(earningsData);
        XLSX.utils.book_append_sheet(workbook, earningsSheet, "Earnings");
      }

      // Export the file
      const fileName = `${doctor.name.replace(/[^a-zA-Z0-9]/g, '_')}_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      toast({
        title: "Excel Export Successful",
        description: `Doctor report exported as ${fileName}`,
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Export Failed",
        description: "Failed to export doctor data to Excel",
        variant: "destructive",
      });
    }
  };

  if (isDoctorLoading) {
    return (
      <div>
        <TopBar title="Loading..." />
        <div className="p-6 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-medical-blue"></div>
        </div>
      </div>
    );
  }

  if (!doctor) {
    return (
      <div>
        <TopBar title="Doctor Not Found" />
        <div className="p-6 text-center">
          <p className="text-muted-foreground">Doctor not found</p>
          <Button onClick={() => setLocation("/doctors")} className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Doctors
          </Button>
        </div>
      </div>
    );
  }

  // Debug logging to see what we're getting
  console.log("Doctor earnings data:", earnings);
  console.log("Number of earnings:", earnings.length);

  const pendingEarnings = earnings.filter((e: DoctorEarning) => e.status === 'pending');
  console.log("Pending earnings:", pendingEarnings);

  const totalPendingEarnings = pendingEarnings.reduce((sum: number, e: DoctorEarning) => sum + e.earnedAmount, 0);
  console.log("Total pending amount:", totalPendingEarnings);

  return (
    <div>
      <TopBar title={`Dr. ${doctor.name}`} />

      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => setLocation("/doctors")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Doctors
          </Button>
          <Button onClick={exportToExcel} className="bg-green-600 hover:bg-green-700">
            <Download className="w-4 h-4 mr-2" />
            Export to Excel
          </Button>
        </div>

        {/* Doctor Profile Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-4">
              <div 
                className="relative group cursor-pointer" 
                onClick={() => setIsImageDialogOpen(true)}
                data-testid="doctor-profile-picture-trigger"
              >
                <div className="w-16 h-16 bg-healthcare-green rounded-full flex items-center justify-center overflow-hidden">
                  {previewImage || doctor.profilePicture ? (
                    <img 
                      src={previewImage || doctor.profilePicture} 
                      alt={doctor.name} 
                      className="w-full h-full object-cover" 
                      data-testid="doctor-profile-image"
                    />
                  ) : (
                    <span className="text-white font-medium text-lg" data-testid="doctor-initials">
                      {getInitials(doctor.name)}
                    </span>
                  )}
                </div>
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 rounded-full flex items-center justify-center transition-all duration-500 ease-in-out">
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-500 ease-in-out" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
              </div>
              <div>
                <CardTitle className="text-2xl">{doctor.name}</CardTitle>
                <p className="text-muted-foreground text-lg">{doctor.specialization}</p>
                <Badge variant={doctor.isActive ? "default" : "secondary"} className="mt-2">
                  {doctor.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="text-sm text-muted-foreground">Qualification</label>
                <p className="font-medium">{doctor.qualification}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Consultation Fee</label>
                <p className="font-medium">{formatCurrency(doctor.consultationFee)}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Joined Date</label>
                <p className="font-medium">{formatDate(doctor.createdAt)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending Earnings</p>
                  <p className="text-xl font-semibold text-green-600">
                    {formatCurrency(totalPendingEarnings)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <Calculator className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Services</p>
                  <p className="text-xl font-semibold text-blue-600">{earnings.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                  <IndianRupee className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Salary Rates</p>
                  <p className="text-xl font-semibold text-purple-600">{salaryRates.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Information Tabs */}
        <Tabs defaultValue="salary-rates" className="space-y-6">
          <TabsList>
            <TabsTrigger value="salary-rates">Salary Rates</TabsTrigger>
            <TabsTrigger value="earnings">Earnings</TabsTrigger>
          </TabsList>

          <TabsContent value="salary-rates">
            <Card>
              <CardHeader>
                <CardTitle>Salary Rate Configuration</CardTitle>
              </CardHeader>
              <CardContent>
                {salaryRates.length === 0 ? (
                  <div className="text-center py-8">
                    <Calculator className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No salary rates configured</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Service Name</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Rate Type</TableHead>
                          <TableHead>Rate Amount</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {salaryRates.map((rate: DoctorRate) => {
                          return (
                            <TableRow key={rate.id}>
                              <TableCell className="font-medium">{rate.serviceName}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{rate.serviceCategory}</Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary">
                                  {rate.rateType === 'amount' ? 'Amount' : 
                                   rate.rateType === 'percentage' ? 'Percentage' : 
                                   rate.rateType === 'fixed_daily' ? 'Fixed Daily' : 
                                   rate.rateType}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {rate.rateType === 'percentage' 
                                  ? `${rate.rateAmount}%` 
                                  : `₹${rate.rateAmount.toFixed(2)}`}
                              </TableCell>
                              <TableCell>
                                <Badge variant={rate.isActive ? 'default' : 'secondary'}>
                                  {rate.isActive ? 'Active' : 'Inactive'}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="earnings">
            <Card>
              <CardHeader>
                <CardTitle>Earnings History</CardTitle>
              </CardHeader>
              <CardContent>
                {earnings.length === 0 ? (
                  <div className="text-center py-8">
                    <Wallet className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No earnings recorded</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Service</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Service Price</TableHead>
                          <TableHead>Rate</TableHead>
                          <TableHead>Earned Amount</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {earnings.map((earning: DoctorEarning) => (
                          <TableRow key={earning.earningId}>
                            <TableCell className="font-medium">{earning.serviceName}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{earning.serviceCategory}</Badge>
                            </TableCell>
                            <TableCell>{formatDate(earning.serviceDate)}</TableCell>
                            <TableCell>{formatCurrency(earning.servicePrice)}</TableCell>
                            <TableCell>
                              {earning.rateType === 'percentage' ? `${earning.rateAmount}%` : formatCurrency(earning.rateAmount)}
                            </TableCell>
                            <TableCell className="font-medium text-green-600">
                              {formatCurrency(earning.earnedAmount)}
                            </TableCell>
                            <TableCell>
                              <Badge variant={earning.status === 'pending' ? "default" : "secondary"}>
                                {earning.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {earning.status === 'pending' ? (
                                <Button
                                  size="sm"
                                  onClick={() => markEarningAsPaidMutation.mutate(earning.earningId)}
                                  disabled={markEarningAsPaidMutation.isPending}
                                  data-testid={`button-mark-paid-${earning.earningId}`}
                                >
                                  {markEarningAsPaidMutation.isPending ? "Marking..." : "Mark as Paid"}
                                </Button>
                              ) : (
                                <span className="text-muted-foreground text-sm">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Profile Picture Dialog */}
        <Dialog open={isImageDialogOpen} onOpenChange={setIsImageDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Doctor Profile Picture</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center space-y-4 py-4">
              <div className="w-32 h-32 rounded-full overflow-hidden bg-healthcare-green flex items-center justify-center">
                {previewImage || doctor.profilePicture ? (
                  <img 
                    src={previewImage || doctor.profilePicture} 
                    alt={doctor.name} 
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <span className="text-white font-medium text-3xl">
                    {getInitials(doctor.name)}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                {previewImage || doctor.profilePicture ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={updateProfilePictureMutation.isPending}
                      data-testid="button-update-doctor-picture"
                    >
                      {updateProfilePictureMutation.isPending ? "Updating..." : "Update"}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={handleDeleteImage}
                      disabled={updateProfilePictureMutation.isPending}
                      data-testid="button-delete-doctor-picture"
                    >
                      Delete
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={updateProfilePictureMutation.isPending}
                    data-testid="button-upload-doctor-picture"
                  >
                    Upload Picture
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                PNG, JPG up to 2MB
              </p>
            </div>
          </DialogContent>
        </Dialog>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageChange}
          className="hidden"
          data-testid="input-doctor-profile-picture"
        />
      </div>
    </div>
  );
}