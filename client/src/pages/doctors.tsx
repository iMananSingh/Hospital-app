import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation } from "wouter";
import TopBar from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserPlus, Eye, Edit, Trash2, Stethoscope, IndianRupee, Calculator, Wallet, Settings, Shield, Check } from "lucide-react";
import { insertDoctorSchema } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import type { Doctor, Service, DoctorServiceRate } from "@shared/schema";
import AccessRestricted from "@/components/access-restricted";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function Doctors() {
  const [isNewDoctorOpen, setIsNewDoctorOpen] = useState(false);
  const [isEditDoctorOpen, setIsEditDoctorOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isPermanentDeleteDialogOpen, setIsPermanentDeleteDialogOpen] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [doctorToDelete, setDoctorToDelete] = useState<Doctor | null>(null);
  const [doctorToPermanentlyDelete, setDoctorToPermanentlyDelete] = useState<Doctor | null>(null);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const { user } = useAuth();
  // Check if user can access doctor management at all
  const currentUserRoles = user?.roles || [user?.role]; // Backward compatibility
  const isAdmin = currentUserRoles.includes('admin');
  const isBillingStaff = currentUserRoles.includes('billing_staff');
  const isSuperUser = currentUserRoles.includes('super_user');

  const hasAccess = isAdmin || isBillingStaff || isSuperUser;

  if (!hasAccess) {
    return (
      <div>
        <TopBar title="Doctor Management" />
        <div className="px-6 pb-6 pt-4">
          <AccessRestricted 
            title="Access Restricted"
            description="Only administrators, billing staff, and super users can access doctor management."
          />
        </div>
      </div>
    );
  }

  // Salary Management States
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");
  const [serviceSelections, setServiceSelections] = useState<{
    [key: string]: {
      isSelected: boolean;
      salaryBasis: 'amount' | 'percentage' | '';
      amount: number;
      percentage: number;
    }
  }>({});

  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: doctors = [], isLoading } = useQuery<Doctor[]>({
    queryKey: ["/api/doctors"],
  });

  const { data: deletedDoctors = [], isLoading: isLoadingDeleted } = useQuery<Doctor[]>({
    queryKey: ["/api/doctors/deleted"],
  });

  // Fetch services for salary management
  const { data: services = [] } = useQuery<Service[]>({
    queryKey: ["/api/services"],
  });

  // Fetch pathology tests for salary management
  const { data: pathologyData } = useQuery({
    queryKey: ["/api/pathology-tests/combined"],
  });

  // Fetch doctor salary rates when doctor is selected
  const { data: doctorRates = [], refetch: refetchDoctorRates } = useQuery<DoctorServiceRate[]>({
    queryKey: ["/api/doctors", selectedDoctorId, "salary-rates"],
    enabled: !!selectedDoctorId,
  });

  // Fetch all doctor payments to calculate paid this month
  const { data: allDoctorPayments = [] } = useQuery({
    queryKey: ["/api/doctors/payments"],
  });

  const filteredDoctors = doctors?.filter((doctor: Doctor) =>
    doctor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doctor.specialization.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doctor.qualification.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  // Calculate total paid this month from all doctor payments
  const calculatePaidThisMonth = () => {
    if (!allDoctorPayments || allDoctorPayments.length === 0) return 0;
    
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    return allDoctorPayments
      .filter((payment: any) => {
        const paymentDate = new Date(payment.paymentDate);
        return paymentDate.getMonth() === currentMonth && 
               paymentDate.getFullYear() === currentYear;
      })
      .reduce((sum: number, payment: any) => sum + payment.totalAmount, 0);
  };

  const paidThisMonth = calculatePaidThisMonth();

  // Fetch doctor earnings for all doctors
  const { data: allDoctorEarnings = [] } = useQuery({
    queryKey: ["/api/doctors/all-earnings"],
    queryFn: async () => {
      const promises = filteredDoctors.map(async (doctor: Doctor) => {
        const response = await fetch(`/api/doctors/${doctor.id}/earnings?status=pending`, {
          headers: {
            "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
          },
        });
        if (response.ok) {
          const earnings = await response.json();
          return {
            doctorId: doctor.id,
            doctorName: doctor.name,
            earnings: earnings,
            totalPending: earnings.reduce((sum: number, earning: any) => sum + earning.earnedAmount, 0),
            servicesCount: earnings.length,
          };
        }
        return {
          doctorId: doctor.id,
          doctorName: doctor.name,
          earnings: [],
          totalPending: 0,
          servicesCount: 0,
        };
      });
      return Promise.all(promises);
    },
    enabled: filteredDoctors.length > 0,
  });


  // Save doctor salary rates mutation
  const saveDoctorRatesMutation = useMutation({
    mutationFn: async (rates: any[]) => {
      const response = await fetch(`/api/doctors/${selectedDoctorId}/salary-rates`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
        },
        body: JSON.stringify({ rates }),
      });

      if (!response.ok) {
        throw new Error("Failed to save doctor salary rates");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Doctor salary rates saved successfully",
      });
      refetchDoctorRates();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save doctor salary rates",
        variant: "destructive",
      });
    },
  });

  // Mark doctor earnings as paid mutation
  const markAsPaidMutation = useMutation({
    mutationFn: async (doctorId: string) => {
      const response = await fetch(`/api/doctors/${doctorId}/mark-paid`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to mark earnings as paid");
      }

      return response.json();
    },
    onSuccess: (data, doctorId) => {
      // Invalidate all earnings-related queries to update the pending amounts
      queryClient.invalidateQueries({ queryKey: ["/api/doctors/all-earnings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/doctors", doctorId, "earnings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/doctors/payments"] });
      
      // Force refetch to update the pending amounts immediately
      queryClient.refetchQueries({ queryKey: ["/api/doctors/all-earnings"] });
      
      toast({
        title: "Payment Confirmed",
        description: `Successfully marked ${data.count} earnings as paid`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to mark earnings as paid",
        variant: "destructive",
      });
    },
  });

  const createDoctorMutation = useMutation({
    mutationFn: async (doctorData: any) => {
      const response = await fetch("/api/doctors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
        },
        body: JSON.stringify(doctorData),
      });

      if (!response.ok) {
        throw new Error("Failed to create doctor");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/doctors"] });
      setIsNewDoctorOpen(false);
      form.reset();
      toast({
        title: "Doctor added successfully",
        description: "The doctor profile has been created.",
      });
    },
    onError: () => {
      toast({
        title: "Error adding doctor",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateDoctorMutation = useMutation({
    mutationFn: async ({ id, doctorData }: { id: string; doctorData: any }) => {
      const response = await fetch(`/api/doctors/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
        },
        body: JSON.stringify(doctorData),
      });

      if (!response.ok) {
        throw new Error("Failed to update doctor");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/doctors"] });
      setIsEditDoctorOpen(false);
      setSelectedDoctor(null);
      editForm.reset();
      toast({
        title: "Doctor updated successfully",
        description: "The doctor profile has been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error updating doctor",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteDoctorMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/doctors/${id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete doctor");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/doctors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/doctors/deleted"] });
      toast({
        title: "Doctor deleted successfully",
        description: "The doctor profile has been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Error deleting doctor",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const restoreDoctorMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/doctors/${id}/restore`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to restore doctor");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/doctors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/doctors/deleted"] });
      toast({
        title: "Doctor restored successfully",
        description: "The doctor profile has been restored to active status.",
      });
    },
    onError: () => {
      toast({
        title: "Error restoring doctor",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const permanentDeleteDoctorMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/doctors/${id}/permanent`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to permanently delete doctor");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/doctors/deleted"] });
      toast({
        title: "Doctor permanently deleted",
        description: "The doctor profile has been permanently removed from the system.",
      });
    },
    onError: () => {
      toast({
        title: "Error permanently deleting doctor",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const form = useForm({
    resolver: zodResolver(insertDoctorSchema),
    defaultValues: {
      name: "",
      specialization: "",
      qualification: "",
      consultationFee: 0,
      userId: undefined,
    },
  });

  const editForm = useForm({
    resolver: zodResolver(insertDoctorSchema),
    defaultValues: {
      name: "",
      specialization: "",
      qualification: "",
      consultationFee: 0,
      userId: undefined,
    },
  });

  const onSubmit = (data: any) => {
    createDoctorMutation.mutate(data);
  };

  const onEditSubmit = (data: any) => {
    if (selectedDoctor) {
      updateDoctorMutation.mutate({ id: selectedDoctor.id, doctorData: data });
    }
  };

  const handleEditDoctor = (doctor: Doctor) => {
    setSelectedDoctor(doctor);
    editForm.reset({
      name: doctor.name,
      specialization: doctor.specialization,
      qualification: doctor.qualification,
      consultationFee: doctor.consultationFee,
      userId: undefined,
    } as any);
    setIsEditDoctorOpen(true);
  };

  const handleDeleteDoctor = (doctor: Doctor) => {
    setDoctorToDelete(doctor);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteDoctor = () => {
    if (doctorToDelete) {
      deleteDoctorMutation.mutate(doctorToDelete.id);
      setIsDeleteDialogOpen(false);
      setDoctorToDelete(null);
    }
  };

  const handleRestoreDoctor = (doctorId: string) => {
    restoreDoctorMutation.mutate(doctorId);
  };

  const handlePermanentDeleteDoctor = (doctor: Doctor) => {
    setDoctorToPermanentlyDelete(doctor);
    setDeleteConfirmationText("");
    setIsPermanentDeleteDialogOpen(true);
  };

  const confirmPermanentDeleteDoctor = () => {
    if (doctorToPermanentlyDelete && deleteConfirmationText === "delete") {
      permanentDeleteDoctorMutation.mutate(doctorToPermanentlyDelete.id);
      setIsPermanentDeleteDialogOpen(false);
      setDoctorToPermanentlyDelete(null);
      setDeleteConfirmationText("");
    }
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

  const specializations = [
    "General Medicine",
    "Cardiology",
    "Neurology",
    "Orthopedics",
    "Dermatology",
    "Pediatrics",
    "Gynecology",
    "Urology",
    "Psychiatry",
    "Radiology",
    "Pathology",
    "Anesthesiology",
    "Emergency Medicine",
    "Surgery",
    "ENT",
    "Ophthalmology"
  ];

  // Utility function to categorize services
  const categorizeServices = () => {
    type CategorizedService = {
      id: string;
      name: string;
      category: string;
      price: number;
    };

    const categories: {
      opd: CategorizedService[];
      labTests: CategorizedService[];
      diagnostic: CategorizedService[];
      operations: CategorizedService[];
      admissions: CategorizedService[];
      services: CategorizedService[];
    } = {
      opd: [],
      labTests: [],
      diagnostic: [],
      operations: [],
      admissions: [],
      services: []
    };

    // Add OPD consultation services from actual services
    if (services && services.length > 0) {
      const opdServices = services.filter(service => 
        service.category?.toLowerCase() === 'consultation' || 
        service.name?.toLowerCase().includes('opd') || 
        service.name?.toLowerCase().includes('consultation')
      );

      // Only add real OPD services if they exist
      if (opdServices.length > 0) {
        categories.opd.push(...opdServices.map(service => ({
          id: service.id,
          name: service.name,
          category: 'opd',
          price: service.price || 0
        })));
      } else {
        // Add placeholder only if no real OPD services exist
        categories.opd.push({
          id: 'opd_consultation_placeholder',
          name: 'OPD Consultation',
          category: 'opd',
          price: 0
        });
      }
    } else {
      // Add placeholder if services array is empty
      categories.opd.push({
        id: 'opd_consultation_placeholder',
        name: 'OPD Consultation',
        category: 'opd',
        price: 0
      });
    }

    // Add pathology services as individual entries using real service IDs
    if (services && services.length > 0) {
      const pathologyServices = services.filter(service => 
        service.category?.toLowerCase() === 'pathology' ||
        service.name?.toLowerCase().includes('pathology') ||
        service.name?.toLowerCase().includes('lab') ||
        service.name?.toLowerCase().includes('test')
      );

      categories.labTests.push(...pathologyServices.map(service => ({
        id: service.id,
        name: service.name,
        category: 'pathology',
        price: service.price || 0
      })));
    }

    // Categorize remaining services based on their category field
    // Exclude services that are already categorized as OPD or pathology
    if (services && services.length > 0) {
      const alreadyCategorizedIds = new Set([
        ...categories.opd.map(s => s.id),
        ...categories.labTests.map(s => s.id)
      ]);

      services.forEach((service: any) => {
        // Skip if already categorized as OPD or pathology
        if (alreadyCategorizedIds.has(service.id)) {
          return;
        }

        const serviceItem = {
          id: service.id,
          name: service.name,
          category: service.category,
          price: service.price || 0
        };

        switch (service.category?.toLowerCase()) {
          case 'diagnostic':
          case 'diagnostics':
          case 'radiology':
            categories.diagnostic.push(serviceItem);
            break;
          case 'operation':
          case 'operations':
          case 'surgery':
          case 'surgical':
            categories.operations.push(serviceItem);
            break;
          case 'admission':
          case 'admissions':
          case 'inpatient':
          case 'ward':
          case 'icu':
            categories.admissions.push(serviceItem);
            break;
          default:
            categories.services.push(serviceItem);
            break;
        }
      });
    }


    return categories;
  };

  // Handle service selection
  const handleServiceSelection = (serviceId: string, isSelected: boolean) => {
    setServiceSelections(prev => ({
      ...prev,
      [serviceId]: {
        ...prev[serviceId],
        isSelected,
        salaryBasis: isSelected ? prev[serviceId]?.salaryBasis || '' : '',
        amount: prev[serviceId]?.amount || 0,
        percentage: prev[serviceId]?.percentage || 0
      }
    }));
  };

  // Handle salary basis change
  const handleSalaryBasisChange = (serviceId: string, salaryBasis: 'amount' | 'percentage') => {
    setServiceSelections(prev => ({
      ...prev,
      [serviceId]: {
        ...prev[serviceId],
        salaryBasis,
        amount: prev[serviceId]?.amount || 0,
        percentage: prev[serviceId]?.percentage || 0
      }
    }));
  };

  // Handle amount/percentage change
  const handleValueChange = (serviceId: string, field: 'amount' | 'percentage', value: number) => {
    setServiceSelections(prev => ({
      ...prev,
      [serviceId]: {
        ...prev[serviceId],
        [field]: value
      }
    }));
  };

  const categorizedServices = categorizeServices();

  // Effect to populate service selections from existing doctor rates
  useEffect(() => {
    if (selectedDoctorId && doctorRates.length > 0) {
      const newSelections: typeof serviceSelections = {};

      doctorRates.forEach((rate: any) => {
        const serviceId = rate.serviceId;
        newSelections[serviceId] = {
          isSelected: true,
          salaryBasis: rate.rateType === 'percentage' ? 'percentage' : 'amount',
          amount: rate.rateType === 'amount' ? rate.rateAmount : 0,
          percentage: rate.rateType === 'percentage' ? rate.rateAmount : 0,
        };
      });

      setServiceSelections(newSelections);
    } else if (selectedDoctorId && doctorRates.length === 0) {
      // Clear selections when doctor is selected but has no existing rates
      setServiceSelections({});
    }
  }, [selectedDoctorId, doctorRates]);

  // Function to convert service selections to API format
  const convertSelectionsToRates = () => {
    const rates: any[] = [];

    // Service category mapping to ensure schema compliance
    const categoryMapping: { [key: string]: string } = {
      'opd': 'opd',
      'pathology': 'pathology',
      'diagnostic': 'diagnostics',
      'diagnostics': 'diagnostics',
      'operations': 'opd',
      'admissions': 'admission',
      'admission': 'admission',
      'services': 'opd'
    };

    // Helper function to add service to rates
    const addServiceToRates = (services: any[], categoryKey: string) => {
      const normalizedCategory = categoryMapping[categoryKey] || 'opd';
      services.forEach((service: any) => {
        const selection = serviceSelections[service.id];
        if (selection?.isSelected && selection.salaryBasis && (selection.amount > 0 || selection.percentage > 0)) {
          rates.push({
            serviceId: service.id,
            serviceName: service.name,
            serviceCategory: normalizedCategory,
            isSelected: true,
            salaryBasis: selection.salaryBasis,
            amount: selection.amount,
            percentage: selection.percentage,
          });
        }
      });
    };

    // Add rates from all categories
    addServiceToRates(categorizedServices.opd.filter(s => s.id !== 'opd_consultation_placeholder'), 'opd'); // Exclude placeholder for actual services
    addServiceToRates(categorizedServices.labTests, 'pathology');
    addServiceToRates(categorizedServices.diagnostic, 'diagnostic');
    addServiceToRates(categorizedServices.operations, 'operations');
    addServiceToRates(categorizedServices.admissions, 'admissions');
    addServiceToRates(categorizedServices.services, 'services');

    // Handle OPD consultation placeholder separately
    const opdSelection = serviceSelections['opd_consultation_placeholder'];
    if (opdSelection?.isSelected && opdSelection.salaryBasis && (opdSelection.amount > 0 || opdSelection.percentage > 0)) {
      rates.push({
        serviceId: 'opd_consultation_placeholder',
        serviceName: 'OPD Consultation',
        serviceCategory: 'opd',
        salaryBasis: opdSelection.salaryBasis,
        amount: opdSelection.amount,
        percentage: opdSelection.percentage,
        isSelected: true,
      });
    }

    return rates;
  };

  // Handle save rates
  const handleSaveRates = () => {
    if (!selectedDoctorId) {
      toast({
        title: "Error",
        description: "Please select a doctor first",
        variant: "destructive",
      });
      return;
    }

    const rates = convertSelectionsToRates();
    saveDoctorRatesMutation.mutate(rates);
  };

  // Handle mark as paid
  const handleMarkAsPaid = (doctorId: string) => {
    markAsPaidMutation.mutate(doctorId);
  };

  const getSpecializationIcon = (specialization: string) => {
    // Return appropriate icon based on specialization
    return <Stethoscope className="w-4 h-4" />;
  };

  return (
    <div>
      <TopBar 
        title="Doctor Management"
        searchPlaceholder={hasAccess ? "Search doctors by name or specialization..." : undefined}
        onSearch={hasAccess ? setSearchQuery : undefined}
        onNewAction={(isAdmin || isSuperUser) ? () => setIsNewDoctorOpen(true) : undefined}
        newActionLabel={(isAdmin || isSuperUser) ? "Add Doctor" : undefined}
      />

      <div className="px-6 pb-6 pt-4">
        <Tabs defaultValue={isBillingStaff && !isAdmin && !isSuperUser ? "salary" : "all-doctors"} className="space-y-6">
          <TabsList>
            {(isAdmin || isSuperUser) && (
              <TabsTrigger value="all-doctors" data-testid="tab-all-doctors">Active Doctors</TabsTrigger>
            )}
            {(isAdmin || isSuperUser) && (
              <TabsTrigger value="manage-salary" data-testid="tab-manage-salary">
                <Calculator className="w-4 h-4 mr-1" />
                Manage Salary
              </TabsTrigger>
            )}
            {(isAdmin || isBillingStaff || isSuperUser) && (
              <TabsTrigger value="salary" data-testid="tab-salary">
                <Wallet className="w-4 h-4 mr-1" />
                Salary
              </TabsTrigger>
            )}
            {(isAdmin || isSuperUser) && (
              <TabsTrigger value="deleted-doctors" data-testid="tab-deleted-doctors">Inactive Doctors</TabsTrigger>
            )}
          </TabsList>

          {(isAdmin || isSuperUser) && (
            <TabsContent value="all-doctors">
              <Card>
                <CardHeader>
                  <CardTitle>Doctor Profiles</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Total: {filteredDoctors.length} doctors
                  </p>
                </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-medical-blue mx-auto"></div>
                    <p className="text-sm text-muted-foreground mt-2">Loading doctors...</p>
                  </div>
                ) : filteredDoctors.length === 0 ? (
                  <div className="text-center py-8">
                    <Stethoscope className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No doctors found</p>
                    {(isAdmin || isSuperUser) && (
                      <Button 
                        onClick={() => setIsNewDoctorOpen(true)}
                        className="mt-4"
                        data-testid="button-first-doctor"
                      >
                        Add your first doctor
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="doctors-grid">
                    {filteredDoctors.map((doctor: Doctor) => (
                      <Card key={doctor.id} className="hover:shadow-md transition-shadow" data-testid={`doctor-card-${doctor.id}`}>
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center space-x-3">
                              <div className="w-12 h-12 bg-healthcare-green rounded-full flex items-center justify-center overflow-hidden">
                                {doctor.profilePicture ? (
                                  <img 
                                    src={doctor.profilePicture} 
                                    alt={doctor.name} 
                                    className="w-full h-full object-cover" 
                                  />
                                ) : (
                                  <span className="text-white font-medium text-sm">
                                    {doctor.name.split(' ').map(n => n[0]).join('')}
                                  </span>
                                )}
                              </div>
                              <div>
                                <h3 className="font-semibold text-lg" data-testid={`doctor-name-${doctor.id}`}>
                                  {doctor.name}
                                </h3>
                                <p className="text-sm text-muted-foreground" data-testid={`doctor-specialization-${doctor.id}`}>
                                  {doctor.specialization}
                                </p>
                              </div>
                            </div>
                            <Badge 
                              variant={doctor.isActive ? "default" : "secondary"} 
                              data-testid={`doctor-status-${doctor.id}`}
                            >
                              {doctor.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>

                          <div className="space-y-3">
                            <div className="flex items-center space-x-2">
                              {getSpecializationIcon(doctor.specialization)}
                              <span className="text-sm" data-testid={`doctor-qualification-${doctor.id}`}>
                                {doctor.qualification}
                              </span>
                            </div>

                            <div className="flex items-center space-x-2">
                              <IndianRupee className="w-4 h-4 text-healthcare-green" />
                              <span className="text-sm font-medium" data-testid={`doctor-fee-${doctor.id}`}>
                                Consultation: {formatCurrency(doctor.consultationFee)}
                              </span>
                            </div>

                            <div className="text-xs text-muted-foreground">
                              Joined: {formatDate(doctor.createdAt)}
                            </div>
                          </div>

                          <div className="flex space-x-2 mt-4 pt-4 border-t">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="flex-1"
                              onClick={() => setLocation(`/doctors/${doctor.id}`)}
                              data-testid={`button-view-doctor-${doctor.id}`}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              View Doctor
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="flex-1"
                              onClick={() => handleEditDoctor(doctor)}
                              data-testid={`button-edit-${doctor.id}`}
                            >
                              <Edit className="w-4 h-4 mr-1" />
                              Edit
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleDeleteDoctor(doctor)}
                              data-testid={`button-delete-${doctor.id}`}
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              Delete
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          )}

          {(isAdmin || isSuperUser) && (
          <TabsContent value="deleted-doctors">
            <Card>
              <CardHeader>
                <CardTitle>Inactive Doctors</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Doctors that have been deactivated can be restored here. Total: {deletedDoctors?.length || 0} inactive doctors
                </p>
              </CardHeader>
              <CardContent>
                {isLoadingDeleted ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-medical-blue mx-auto"></div>
                    <p className="text-sm text-muted-foreground mt-2">Loading deleted doctors...</p>
                  </div>
                ) : (deletedDoctors?.length || 0) === 0 ? (
                  <div className="text-center py-8">
                    <Stethoscope className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No inactive doctors found</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="deleted-doctors-grid">
                    {deletedDoctors?.map((doctor: Doctor) => (
                      <Card key={doctor.id} className="opacity-75 hover:opacity-100 transition-opacity border-red-200" data-testid={`deleted-doctor-card-${doctor.id}`}>
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center space-x-3">
                              <div className="w-12 h-12 bg-gray-400 rounded-full flex items-center justify-center overflow-hidden">
                                {doctor.profilePicture ? (
                                  <img 
                                    src={doctor.profilePicture} 
                                    alt={doctor.name} 
                                    className="w-full h-full object-cover" 
                                  />
                                ) : (
                                  <span className="text-white font-medium text-sm">
                                    {doctor.name.split(' ').map(n => n[0]).join('')}
                                  </span>
                                )}
                              </div>
                              <div>
                                <h3 className="font-semibold text-lg text-gray-600" data-testid={`deleted-doctor-name-${doctor.id}`}>
                                  {doctor.name}
                                </h3>
                                <p className="text-sm text-muted-foreground" data-testid={`deleted-doctor-specialization-${doctor.id}`}>
                                  {doctor.specialization}
                                </p>
                              </div>
                            </div>
                            <Badge variant="secondary" className="bg-red-100 text-red-800">
                              Inactive
                            </Badge>
                          </div>

                          <div className="space-y-3">
                            <div className="flex items-center space-x-2">
                              {getSpecializationIcon(doctor.specialization)}
                              <span className="text-sm text-gray-600" data-testid={`deleted-doctor-qualification-${doctor.id}`}>
                                {doctor.qualification}
                              </span>
                            </div>

                            <div className="flex items-center space-x-2">
                              <IndianRupee className="w-4 h-4 text-gray-500" />
                              <span className="text-sm font-medium text-gray-600" data-testid={`deleted-doctor-fee-${doctor.id}`}>
                                Consultation: {formatCurrency(doctor.consultationFee)}
                              </span>
                            </div>

                            <div className="text-xs text-muted-foreground">
                              Deactivated: {formatDate(doctor.updatedAt)}
                            </div>
                          </div>

                          <div className="flex flex-col space-y-2 mt-4 pt-4 border-t">
                            <Button 
                              variant="default" 
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => handleRestoreDoctor(doctor.id)}
                              disabled={restoreDoctorMutation.isPending}
                              data-testid={`button-restore-${doctor.id}`}
                            >
                              {restoreDoctorMutation.isPending ? "Restoring..." : "Restore Doctor"}
                            </Button>
                            <Button 
                              variant="destructive" 
                              size="sm"
                              onClick={() => handlePermanentDeleteDoctor(doctor)}
                              disabled={permanentDeleteDoctorMutation.isPending}
                              data-testid={`button-permanent-delete-${doctor.id}`}
                            >
                              {permanentDeleteDoctorMutation.isPending ? "Deleting..." : "Delete Permanently"}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          )}

          {(isAdmin || isSuperUser) && (
          <TabsContent value="manage-salary">
            <Card>
              <CardHeader>
                <CardTitle>Manage Doctor Salary Rates</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Configure commission and salary rates for different services by doctor
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Doctor Selection */}
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                      <Label htmlFor="doctor-select">Select Doctor</Label>
                      <Select value={selectedDoctorId} onValueChange={setSelectedDoctorId}>
                        <SelectTrigger id="doctor-select" data-testid="select-doctor-salary">
                          <SelectValue placeholder="Choose a doctor to configure salary rates" />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredDoctors.map((doctor: Doctor) => (
                            <SelectItem key={doctor.id} value={doctor.id}>
                              {doctor.name} - {doctor.specialization}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end">
                      <Button 
                        data-testid="button-save-rates" 
                        disabled={!selectedDoctorId || saveDoctorRatesMutation.isPending}
                        onClick={handleSaveRates}
                      >
                        <Calculator className="w-4 h-4 mr-1" />
                        {saveDoctorRatesMutation.isPending ? "Saving..." : "Save Rates"}
                      </Button>
                    </div>
                  </div>

                  {selectedDoctorId ? (
                    <div className="space-y-8">
                      {/* OPD Services */}
                      {categorizedServices.opd.length > 0 && (
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">OPD Consultation</h3>
                          <div className="space-y-3">
                            {categorizedServices.opd.map((service: any) => (
                              <div key={service.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg" data-testid={`service-row-${service.id}`}>
                                <Checkbox
                                  checked={serviceSelections[service.id]?.isSelected === true}
                                  onCheckedChange={(checked) => handleServiceSelection(service.id, checked === true)}
                                  data-testid={`checkbox-${service.id}`}
                                />
                                <div className="flex-1">
                                  <span className="font-medium">{service.name}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <Select
                                    value={serviceSelections[service.id]?.salaryBasis || ''}
                                    onValueChange={(value) => handleSalaryBasisChange(service.id, value as 'amount' | 'percentage')}
                                    disabled={!serviceSelections[service.id]?.isSelected}
                                  >
                                    <SelectTrigger className="w-32" data-testid={`select-basis-${service.id}`}>
                                      <SelectValue placeholder="Basis" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="amount">Amount</SelectItem>
                                      <SelectItem value="percentage">Percentage</SelectItem>
                                    </SelectContent>
                                  </Select>

                                  <div className="flex items-center gap-2">
                                    <Label htmlFor={`amount-${service.id}`} className="text-sm">₹</Label>
                                    <Input
                                      id={`amount-${service.id}`}
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      placeholder="0"
                                      value={serviceSelections[service.id]?.amount || 0}
                                      onChange={(e) => handleValueChange(service.id, 'amount', parseFloat(e.target.value) || 0)}
                                      disabled={!serviceSelections[service.id]?.isSelected || serviceSelections[service.id]?.salaryBasis !== 'amount'}
                                      className={`w-20 text-center ${
                                        !serviceSelections[service.id]?.isSelected || serviceSelections[service.id]?.salaryBasis !== 'amount' 
                                          ? 'bg-gray-100 text-gray-400' : ''
                                      }`}
                                      data-testid={`input-amount-${service.id}`}
                                    />
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <Input
                                      type="number"
                                      min="0"
                                      max="100"
                                      step="0.01"
                                      placeholder="0"
                                      value={serviceSelections[service.id]?.percentage || 0}
                                      onChange={(e) => handleValueChange(service.id, 'percentage', parseFloat(e.target.value) || 0)}
                                      disabled={!serviceSelections[service.id]?.isSelected || serviceSelections[service.id]?.salaryBasis !== 'percentage'}
                                      className={`w-20 text-center ${
                                        !serviceSelections[service.id]?.isSelected || serviceSelections[service.id]?.salaryBasis !== 'percentage' 
                                          ? 'bg-gray-100 text-gray-400' : ''
                                      }`}
                                      data-testid={`input-percentage-${service.id}`}
                                    />
                                    <Label className="text-sm">%</Label>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Lab Tests */}
                      {categorizedServices.labTests.length > 0 && (
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Lab Tests</h3>
                          <div className="space-y-3">
                            {categorizedServices.labTests.map((service: any) => (
                              <div key={service.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg" data-testid={`service-row-${service.id}`}>
                                <Checkbox
                                  checked={serviceSelections[service.id]?.isSelected === true}
                                  onCheckedChange={(checked) => handleServiceSelection(service.id, checked === true)}
                                  data-testid={`checkbox-${service.id}`}
                                />
                                <div className="flex-1">
                                  <span className="font-medium">{service.name}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <Select
                                    value={serviceSelections[service.id]?.salaryBasis || ''}
                                    onValueChange={(value) => handleSalaryBasisChange(service.id, value as 'amount' | 'percentage')}
                                    disabled={!serviceSelections[service.id]?.isSelected}
                                  >
                                    <SelectTrigger className="w-32" data-testid={`select-basis-${service.id}`}>
                                      <SelectValue placeholder="Basis" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="amount">Amount</SelectItem>
                                      <SelectItem value="percentage">Percentage</SelectItem>
                                    </SelectContent>
                                  </Select>

                                  <div className="flex items-center gap-2">
                                    <Label htmlFor={`amount-${service.id}`} className="text-sm">₹</Label>
                                    <Input
                                      id={`amount-${service.id}`}
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      placeholder="0"
                                      value={serviceSelections[service.id]?.amount || 0}
                                      onChange={(e) => handleValueChange(service.id, 'amount', parseFloat(e.target.value) || 0)}
                                      disabled={!serviceSelections[service.id]?.isSelected || serviceSelections[service.id]?.salaryBasis !== 'amount'}
                                      className={`w-20 text-center ${
                                        !serviceSelections[service.id]?.isSelected || serviceSelections[service.id]?.salaryBasis !== 'amount' 
                                          ? 'bg-gray-100 text-gray-400' : ''
                                      }`}
                                      data-testid={`input-amount-${service.id}`}
                                    />
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <Input
                                      type="number"
                                      min="0"
                                      max="100"
                                      step="0.01"
                                      placeholder="0"
                                      value={serviceSelections[service.id]?.percentage || 0}
                                      onChange={(e) => handleValueChange(service.id, 'percentage', parseFloat(e.target.value) || 0)}
                                      disabled={!serviceSelections[service.id]?.isSelected || serviceSelections[service.id]?.salaryBasis !== 'percentage'}
                                      className={`w-20 text-center ${
                                        !serviceSelections[service.id]?.isSelected || serviceSelections[service.id]?.salaryBasis !== 'percentage' 
                                          ? 'bg-gray-100 text-gray-400' : ''
                                      }`}
                                      data-testid={`input-percentage-${service.id}`}
                                    />
                                    <Label className="text-sm">%</Label>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Diagnostic Services */}
                      {categorizedServices.diagnostic.length > 0 && (
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Diagnostic</h3>
                          <div className="space-y-3">
                            {categorizedServices.diagnostic.map((service: any) => (
                              <div key={service.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg" data-testid={`service-row-${service.id}`}>
                                <Checkbox
                                  checked={serviceSelections[service.id]?.isSelected === true}
                                  onCheckedChange={(checked) => handleServiceSelection(service.id, checked === true)}
                                  data-testid={`checkbox-${service.id}`}
                                />
                                <div className="flex-1">
                                  <span className="font-medium">{service.name}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <Select
                                    value={serviceSelections[service.id]?.salaryBasis || ''}
                                    onValueChange={(value) => handleSalaryBasisChange(service.id, value as 'amount' | 'percentage')}
                                    disabled={!serviceSelections[service.id]?.isSelected}
                                  >
                                    <SelectTrigger className="w-32" data-testid={`select-basis-${service.id}`}>
                                      <SelectValue placeholder="Basis" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="amount">Amount</SelectItem>
                                      <SelectItem value="percentage">Percentage</SelectItem>
                                    </SelectContent>
                                  </Select>

                                  <div className="flex items-center gap-2">
                                    <Label htmlFor={`amount-${service.id}`} className="text-sm">₹</Label>
                                    <Input
                                      id={`amount-${service.id}`}
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      placeholder="0"
                                      value={serviceSelections[service.id]?.amount || 0}
                                      onChange={(e) => handleValueChange(service.id, 'amount', parseFloat(e.target.value) || 0)}
                                      disabled={!serviceSelections[service.id]?.isSelected || serviceSelections[service.id]?.salaryBasis !== 'amount'}
                                      className={`w-20 text-center ${
                                        !serviceSelections[service.id]?.isSelected || serviceSelections[service.id]?.salaryBasis !== 'amount' 
                                          ? 'bg-gray-100 text-gray-400' : ''
                                      }`}
                                      data-testid={`input-amount-${service.id}`}
                                    />
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <Input
                                      type="number"
                                      min="0"
                                      max="100"
                                      step="0.01"
                                      placeholder="0"
                                      value={serviceSelections[service.id]?.percentage || 0}
                                      onChange={(e) => handleValueChange(service.id, 'percentage', parseFloat(e.target.value) || 0)}
                                      disabled={!serviceSelections[service.id]?.isSelected || serviceSelections[service.id]?.salaryBasis !== 'percentage'}
                                      className={`w-20 text-center ${
                                        !serviceSelections[service.id]?.isSelected || serviceSelections[service.id]?.salaryBasis !== 'percentage' 
                                          ? 'bg-gray-100 text-gray-400' : ''
                                      }`}
                                      data-testid={`input-percentage-${service.id}`}
                                    />
                                    <Label className="text-sm">%</Label>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Operations */}
                      {categorizedServices.operations.length > 0 && (
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Operations</h3>
                          <div className="space-y-3">
                            {categorizedServices.operations.map((service: any) => (
                              <div key={service.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg" data-testid={`service-row-${service.id}`}>
                                <Checkbox
                                  checked={serviceSelections[service.id]?.isSelected === true}
                                  onCheckedChange={(checked) => handleServiceSelection(service.id, checked === true)}
                                  data-testid={`checkbox-${service.id}`}
                                />
                                <div className="flex-1">
                                  <span className="font-medium">{service.name}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <Select
                                    value={serviceSelections[service.id]?.salaryBasis || ''}
                                    onValueChange={(value) => handleSalaryBasisChange(service.id, value as 'amount' | 'percentage')}
                                    disabled={!serviceSelections[service.id]?.isSelected}
                                  >
                                    <SelectTrigger className="w-32" data-testid={`select-basis-${service.id}`}>
                                      <SelectValue placeholder="Basis" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="amount">Amount</SelectItem>
                                      <SelectItem value="percentage">Percentage</SelectItem>
                                    </SelectContent>
                                  </Select>

                                  <div className="flex items-center gap-2">
                                    <Label htmlFor={`amount-${service.id}`} className="text-sm">₹</Label>
                                    <Input
                                      id={`amount-${service.id}`}
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      placeholder="0"
                                      value={serviceSelections[service.id]?.amount || 0}
                                      onChange={(e) => handleValueChange(service.id, 'amount', parseFloat(e.target.value) || 0)}
                                      disabled={!serviceSelections[service.id]?.isSelected || serviceSelections[service.id]?.salaryBasis !== 'amount'}
                                      className={`w-20 text-center ${
                                        !serviceSelections[service.id]?.isSelected || serviceSelections[service.id]?.salaryBasis !== 'amount' 
                                          ? 'bg-gray-100 text-gray-400' : ''
                                      }`}
                                      data-testid={`input-amount-${service.id}`}
                                    />
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <Input
                                      type="number"
                                      min="0"
                                      max="100"
                                      step="0.01"
                                      placeholder="0"
                                      value={serviceSelections[service.id]?.percentage || 0}
                                      onChange={(e) => handleValueChange(service.id, 'percentage', parseFloat(e.target.value) || 0)}
                                      disabled={!serviceSelections[service.id]?.isSelected || serviceSelections[service.id]?.salaryBasis !== 'percentage'}
                                      className={`w-20 text-center ${
                                        !serviceSelections[service.id]?.isSelected || serviceSelections[service.id]?.salaryBasis !== 'percentage' 
                                          ? 'bg-gray-100 text-gray-400' : ''
                                      }`}
                                      data-testid={`input-percentage-${service.id}`}
                                    />
                                    <Label className="text-sm">%</Label>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Admission Services */}
                      {categorizedServices.admissions.length > 0 && (
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Admission Services</h3>
                          <div className="space-y-3">
                            {categorizedServices.admissions.map((service: any) => (
                              <div key={service.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg" data-testid={`service-row-${service.id}`}>
                                <Checkbox
                                  checked={serviceSelections[service.id]?.isSelected === true}
                                  onCheckedChange={(checked) => handleServiceSelection(service.id, checked === true)}
                                  data-testid={`checkbox-${service.id}`}
                                />
                                <div className="flex-1">
                                  <span className="font-medium">{service.name}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <Select
                                    value={serviceSelections[service.id]?.salaryBasis || ''}
                                    onValueChange={(value) => handleSalaryBasisChange(service.id, value as 'amount' | 'percentage')}
                                    disabled={!serviceSelections[service.id]?.isSelected}
                                  >
                                    <SelectTrigger className="w-32" data-testid={`select-basis-${service.id}`}>
                                      <SelectValue placeholder="Basis" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="amount">Amount</SelectItem>
                                      <SelectItem value="percentage">Percentage</SelectItem>
                                    </SelectContent>
                                  </Select>

                                  <div className="flex items-center gap-2">
                                    <Label htmlFor={`amount-${service.id}`} className="text-sm">₹</Label>
                                    <Input
                                      id={`amount-${service.id}`}
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      placeholder="0"
                                      value={serviceSelections[service.id]?.amount || 0}
                                      onChange={(e) => handleValueChange(service.id, 'amount', parseFloat(e.target.value) || 0)}
                                      disabled={!serviceSelections[service.id]?.isSelected || serviceSelections[service.id]?.salaryBasis !== 'amount'}
                                      className={`w-20 text-center ${
                                        !serviceSelections[service.id]?.isSelected || serviceSelections[service.id]?.salaryBasis !== 'amount' 
                                          ? 'bg-gray-100 text-gray-400' : ''
                                      }`}
                                      data-testid={`input-amount-${service.id}`}
                                    />
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <Input
                                      type="number"
                                      min="0"
                                      max="100"
                                      step="0.01"
                                      placeholder="0"
                                      value={serviceSelections[service.id]?.percentage || 0}
                                      onChange={(e) => handleValueChange(service.id, 'percentage', parseFloat(e.target.value) || 0)}
                                      disabled={!serviceSelections[service.id]?.isSelected || serviceSelections[service.id]?.salaryBasis !== 'percentage'}
                                      className={`w-20 text-center ${
                                        !serviceSelections[service.id]?.isSelected || serviceSelections[service.id]?.salaryBasis !== 'percentage' 
                                          ? 'bg-gray-100 text-gray-400' : ''
                                      }`}
                                      data-testid={`input-percentage-${service.id}`}
                                    />
                                    <Label className="text-sm">%</Label>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Other Services */}
                      {categorizedServices.services.length > 0 && (
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Services</h3>
                          <div className="space-y-3">
                            {categorizedServices.services.map((service: any) => (
                              <div key={service.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg" data-testid={`service-row-${service.id}`}>
                                <Checkbox
                                  checked={serviceSelections[service.id]?.isSelected === true}
                                  onCheckedChange={(checked) => handleServiceSelection(service.id, checked === true)}
                                  data-testid={`checkbox-${service.id}`}
                                />
                                <div className="flex-1">
                                  <span className="font-medium">{service.name}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <Select
                                    value={serviceSelections[service.id]?.salaryBasis || ''}
                                    onValueChange={(value) => handleSalaryBasisChange(service.id, value as 'amount' | 'percentage')}
                                    disabled={!serviceSelections[service.id]?.isSelected}
                                  >
                                    <SelectTrigger className="w-32" data-testid={`select-basis-${service.id}`}>
                                      <SelectValue placeholder="Basis" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="amount">Amount</SelectItem>
                                      <SelectItem value="percentage">Percentage</SelectItem>
                                    </SelectContent>
                                  </Select>

                                  <div className="flex items-center gap-2">
                                    <Label htmlFor={`amount-${service.id}`} className="text-sm">₹</Label>
                                    <Input
                                      id={`amount-${service.id}`}
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      placeholder="0"
                                      value={serviceSelections[service.id]?.amount || 0}
                                      onChange={(e) => handleValueChange(service.id, 'amount', parseFloat(e.target.value) || 0)}
                                      disabled={!serviceSelections[service.id]?.isSelected || serviceSelections[service.id]?.salaryBasis !== 'amount'}
                                      className={`w-20 text-center ${
                                        !serviceSelections[service.id]?.isSelected || serviceSelections[service.id]?.salaryBasis !== 'amount' 
                                          ? 'bg-gray-100 text-gray-400' : ''
                                      }`}
                                      data-testid={`input-amount-${service.id}`}
                                    />
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <Input
                                      type="number"
                                      min="0"
                                      max="100"
                                      step="0.01"
                                      placeholder="0"
                                      value={serviceSelections[service.id]?.percentage || 0}
                                      onChange={(e) => handleValueChange(service.id, 'percentage', parseFloat(e.target.value) || 0)}
                                      disabled={!serviceSelections[service.id]?.isSelected || serviceSelections[service.id]?.salaryBasis !== 'percentage'}
                                      className={`w-20 text-center ${
                                        !serviceSelections[service.id]?.isSelected || serviceSelections[service.id]?.salaryBasis !== 'percentage' 
                                          ? 'bg-gray-100 text-gray-400' : ''
                                      }`}
                                      data-testid={`input-percentage-${service.id}`}
                                    />
                                    <Label className="text-sm">%</Label>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      Select a doctor above to configure their salary rates for different services
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          )}

          {(isAdmin || isBillingStaff || isSuperUser) && (
          <TabsContent value="salary">
            <Card>
              <CardHeader>
                <CardTitle>Doctor Salary & Earnings</CardTitle>
                <p className="text-sm text-muted-foreground">
                  View earnings, process payments, and track payment history for doctors
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                          <Wallet className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Total Pending</p>
                          <p className="text-xl font-semibold text-green-600">
                            ₹{allDoctorEarnings.reduce((sum: number, doctor: any) => sum + doctor.totalPending, 0).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </Card>
                    <Card className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <IndianRupee className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Paid This Month</p>
                          <p className="text-xl font-semibold text-blue-600">
                            ₹{paidThisMonth.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </Card>
                    <Card className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                          <Calculator className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Total Doctors</p>
                          <p className="text-xl font-semibold text-purple-600">{filteredDoctors.length}</p>
                        </div>
                      </div>
                    </Card>
                  </div>

                  {/* Doctor Earnings Table */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-medium">Doctor Earnings</h3>
                    </div>

                    <div className="border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Doctor</TableHead>
                            <TableHead>Pending Amount</TableHead>
                            <TableHead>Last Payment</TableHead>
                            <TableHead>Last Payment Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {allDoctorEarnings.length > 0 ? allDoctorEarnings.map((doctorData: any) => {
                            const doctor = filteredDoctors.find((d: Doctor) => d.id === doctorData.doctorId);
                            return (
                            <TableRow key={doctorData.doctorId}>
                              <TableCell>
                                <div className="flex items-center space-x-3">
                                  <div className="w-8 h-8 bg-healthcare-green rounded-full flex items-center justify-center overflow-hidden">
                                    {doctor?.profilePicture ? (
                                      <img 
                                        src={doctor.profilePicture} 
                                        alt={doctorData.doctorName} 
                                        className="w-full h-full object-cover" 
                                      />
                                    ) : (
                                      <span className="text-white text-xs font-medium">
                                        {doctorData.doctorName.split(' ').map((n: string) => n[0]).join('')}
                                      </span>
                                    )}
                                  </div>
                                  <div>
                                    <p className="font-medium" data-testid={`salary-doctor-name-${doctorData.doctorId}`}>{doctorData.doctorName}</p>
                                    <p className="text-sm text-muted-foreground">
                                      {doctor?.specialization}
                                    </p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell data-testid={`salary-pending-${doctorData.doctorId}`}>
                                <span className="font-medium text-green-600">₹{doctorData.totalPending.toFixed(2)}</span>
                              </TableCell>
                              <TableCell data-testid={`salary-last-payment-${doctorData.doctorId}`}>
                                <span className="text-sm text-muted-foreground">No payments yet</span>
                              </TableCell>
                              <TableCell data-testid={`salary-last-payment-date-${doctorData.doctorId}`}>
                                <span className="text-sm text-muted-foreground">-</span>
                              </TableCell>
                              <TableCell>
                                <Badge 
                                  variant={doctorData.totalPending > 0 ? "default" : "secondary"} 
                                  data-testid={`salary-status-${doctorData.doctorId}`}
                                >
                                  {doctorData.totalPending > 0 ? "Pending Payment" : "No Activity"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button 
                                          variant="outline" 
                                          size="sm" 
                                          onClick={() => handleMarkAsPaid(doctorData.doctorId)}
                                          disabled={markAsPaidMutation.isPending || doctorData.totalPending === 0}
                                          className={doctorData.totalPending > 0 ? "hover:bg-green-50 hover:text-green-600" : "opacity-50 cursor-not-allowed"}
                                          data-testid={`button-pay-doctor-${doctorData.doctorId}`}
                                        >
                                          <Check className="w-4 h-4 mr-2" />
                                          Mark as Paid
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>{doctorData.totalPending > 0 ? "Mark as Paid" : "No pending earnings"}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button 
                                          variant="outline" 
                                          size="sm"
                                          onClick={() => setLocation(`/doctors/${doctorData.doctorId}`)}
                                          data-testid={`button-view-doctor-${doctorData.doctorId}`}
                                        >
                                          <Eye className="w-4 h-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>View Doctor Details</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                          }) : (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-8">
                                <div className="flex flex-col items-center space-y-2">
                                  <Wallet className="w-8 h-8 text-muted-foreground" />
                                  <p className="text-muted-foreground">No doctors found</p>
                                  <p className="text-sm text-muted-foreground">Add doctors to start tracking salary earnings</p>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          )}
        </Tabs>
      </div>

      {/* New Doctor Dialog */}
      <Dialog open={isNewDoctorOpen} onOpenChange={setIsNewDoctorOpen}>
        <DialogContent className="max-w-2xl" data-testid="new-doctor-dialog">
          <DialogHeader>
            <DialogTitle>Add New Doctor</DialogTitle>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  {...form.register("name")}
                  placeholder="Dr. John Doe"
                  data-testid="input-doctor-name"
                />
                {form.formState.errors.name && (
                  <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="specialization">Specialization *</Label>
                <Select onValueChange={(value) => form.setValue("specialization", value)}>
                  <SelectTrigger data-testid="select-specialization">
                    <SelectValue placeholder="Select specialization" />
                  </SelectTrigger>
                  <SelectContent>
                    {specializations.map((spec) => (
                      <SelectItem key={spec} value={spec}>
                        {spec}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.specialization && (
                  <p className="text-sm text-destructive">{form.formState.errors.specialization.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="qualification">Qualification *</Label>
                <Input
                  id="qualification"
                  {...form.register("qualification")}
                  placeholder="MBBS, MD, MS etc."
                  data-testid="input-qualification"
                />
                {form.formState.errors.qualification && (
                  <p className="text-sm text-destructive">{form.formState.errors.qualification.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="consultationFee">Consultation Fee (₹) *</Label>
                <Input
                  id="consultationFee"
                  type="number"
                  {...form.register("consultationFee", { valueAsNumber: true })}
                  placeholder="500"
                  data-testid="input-consultation-fee"
                />
                {form.formState.errors.consultationFee && (
                  <p className="text-sm text-destructive">{form.formState.errors.consultationFee.message}</p>
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsNewDoctorOpen(false)}
                data-testid="button-cancel-doctor"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createDoctorMutation.isPending}
                className="bg-medical-blue hover:bg-medical-blue/90"
                data-testid="button-save-doctor"
              >
                {createDoctorMutation.isPending ? "Adding..." : "Add Doctor"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Doctor Details Dialog */}
      {selectedDoctor && (
        <Dialog open={!!selectedDoctor} onOpenChange={() => setSelectedDoctor(null)}>
          <DialogContent className="max-w-2xl" data-testid="doctor-details-dialog">
            <DialogHeader>
              <DialogTitle>Doctor Profile - {selectedDoctor.name}</DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-healthcare-green rounded-full flex items-center justify-center">
                  <span className="text-white font-medium text-lg">
                    {selectedDoctor.name.split(' ').map(n => n[0]).join('')}
                  </span>
                </div>
                <div>
                  <h3 className="text-xl font-semibold" data-testid="detail-doctor-name">
                    {selectedDoctor.name}
                  </h3>
                  <p className="text-muted-foreground" data-testid="detail-doctor-specialization">
                    {selectedDoctor.specialization}
                  </p>
                  <Badge 
                    variant={selectedDoctor.isActive ? "default" : "secondary"}
                    data-testid="detail-doctor-status"
                  >
                    {selectedDoctor.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <Label className="text-sm text-muted-foreground">Qualification</Label>
                  <p className="font-medium" data-testid="detail-qualification">
                    {selectedDoctor.qualification}
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Consultation Fee</Label>
                  <p className="font-medium" data-testid="detail-consultation-fee">
                    {formatCurrency(selectedDoctor.consultationFee)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <Label className="text-sm text-muted-foreground">Joined Date</Label>
                  <p className="font-medium" data-testid="detail-joined-date">
                    {formatDate(selectedDoctor.createdAt)}
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Last Updated</Label>
                  <p className="font-medium" data-testid="detail-updated-date">
                    {formatDate(selectedDoctor.updatedAt)}
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t">
                <h4 className="font-medium mb-3">Quick Actions</h4>
                <div className="flex space-x-2">
                  <Button variant="outline" data-testid="button-edit-profile">
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Profile
                  </Button>
                  <Button variant="outline" data-testid="button-view-schedule">
                    View Schedule
                  </Button>
                  <Button variant="outline" data-testid="button-view-patients">
                    View Patients
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Doctor Dialog */}
      <Dialog open={isEditDoctorOpen} onOpenChange={setIsEditDoctorOpen}>
        <DialogContent className="max-w-2xl" data-testid="edit-doctor-dialog">
          <DialogHeader>
            <DialogTitle>Edit Doctor Profile</DialogTitle>
          </DialogHeader>

          <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Full Name *</Label>
                <Input
                  id="edit-name"
                  {...editForm.register("name")}
                  placeholder="Dr. John Doe"
                  data-testid="input-edit-doctor-name"
                />
                {editForm.formState.errors.name && (
                  <p className="text-sm text-destructive">{editForm.formState.errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-specialization">Specialization *</Label>
                <Select 
                  value={editForm.watch("specialization")}
                  onValueChange={(value) => editForm.setValue("specialization", value)}
                >
                  <SelectTrigger data-testid="select-edit-specialization">
                    <SelectValue placeholder="Select specialization" />
                  </SelectTrigger>
                  <SelectContent>
                    {specializations.map((spec) => (
                      <SelectItem key={spec} value={spec}>
                        {spec}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editForm.formState.errors.specialization && (
                  <p className="text-sm text-destructive">{editForm.formState.errors.specialization.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-qualification">Qualification *</Label>
                <Input
                  id="edit-qualification"
                  {...editForm.register("qualification")}
                  placeholder="MBBS, MD, MS etc."
                  data-testid="input-edit-qualification"
                />
                {editForm.formState.errors.qualification && (
                  <p className="text-sm text-destructive">{editForm.formState.errors.qualification.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-consultationFee">Consultation Fee (₹) *</Label>
                <Input
                  id="edit-consultationFee"
                  type="number"
                  {...editForm.register("consultationFee", { valueAsNumber: true })}
                  placeholder="500"
                  data-testid="input-edit-consultation-fee"
                />
                {editForm.formState.errors.consultationFee && (
                  <p className="text-sm text-destructive">{editForm.formState.errors.consultationFee.message}</p>
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditDoctorOpen(false)}
                data-testid="button-cancel-edit-doctor"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateDoctorMutation.isPending}
                className="bg-medical-blue hover:bg-medical-blue/90"
                data-testid="button-save-edit-doctor"
              >
                {updateDoctorMutation.isPending ? "Updating..." : "Update Doctor"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent data-testid="delete-doctor-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Doctor</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {doctorToDelete?.name}? This action cannot be undone.
              All associated appointments and records will remain but will no longer be linked to this doctor.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteDoctor}
              disabled={deleteDoctorMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-delete"
            >
              {deleteDoctorMutation.isPending ? "Deleting..." : "Delete Doctor"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Permanent Delete Confirmation Dialog */}
      <Dialog open={isPermanentDeleteDialogOpen} onOpenChange={setIsPermanentDeleteDialogOpen}>
        <DialogContent className="max-w-md" data-testid="permanent-delete-doctor-dialog">
          <DialogHeader>
            <DialogTitle className="text-red-600">Permanently Delete Doctor</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800 font-medium mb-2">⚠️ Warning: This action is irreversible</p>
              <p className="text-sm text-red-700">
                You are about to permanently delete <strong>{doctorToPermanentlyDelete?.name}</strong> from the system. 
                This will completely remove all doctor data and cannot be undone.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="delete-confirmation" className="text-sm font-medium">
                Type "delete" to confirm permanent deletion:
              </Label>
              <Input
                id="delete-confirmation"
                value={deleteConfirmationText}
                onChange={(e) => setDeleteConfirmationText(e.target.value)}
                placeholder="Type 'delete' here"
                className="text-center"
                data-testid="input-delete-confirmation"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setIsPermanentDeleteDialogOpen(false);
                setDoctorToPermanentlyDelete(null);
                setDeleteConfirmationText("");
              }}
              data-testid="button-cancel-permanent-delete"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmPermanentDeleteDoctor}
              disabled={deleteConfirmationText !== "delete" || permanentDeleteDoctorMutation.isPending}
              data-testid="button-confirm-permanent-delete"
            >
              {permanentDeleteDoctorMutation.isPending ? "Deleting..." : "Delete Permanently"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}