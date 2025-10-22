import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import React from "react";
import { useLocation } from "wouter";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserPlus, Edit, Eye } from "lucide-react";
import { insertPatientSchema } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { ComprehensiveBillTemplate } from "@/components/comprehensive-bill-template";
import AccessRestricted from "@/components/access-restricted";
import type { Patient } from "@shared/schema";
import { useTimezone } from "@/hooks/use-timezone";

export default function Patients() {
  const [, navigate] = useLocation();
  const [isNewPatientOpen, setIsNewPatientOpen] = useState(false);
  const [isEditPatientOpen, setIsEditPatientOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [comprehensiveBillData, setComprehensiveBillData] = useState<any>(null);
  const [isComprehensiveBillOpen, setIsComprehensiveBillOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { formatDateTime } = useTimezone();

  // Fetch hospital settings for bills
  const { data: hospitalSettings, isLoading: isHospitalSettingsLoading, error: hospitalSettingsError } = useQuery({
    queryKey: ["/api/settings/hospital"],
    queryFn: async () => {
      console.log("Fetching hospital settings for patients page...");
      const response = await fetch("/api/settings/hospital", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("hospital_token")}`,
        },
      });
      if (!response.ok) {
        console.error("Failed to fetch hospital settings:", response.status, response.statusText);
        throw new Error("Failed to fetch hospital settings");
      }
      const data = await response.json();
      console.log("Fetched hospital settings for patients page:", data);
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 3,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  // Create hospital info object from settings - same as patient detail page
  const hospitalInfo = React.useMemo(() => {
    console.log("=== Hospital Info Creation (Patients Page) ===");
    console.log("Hospital settings in patients page:", hospitalSettings);
    console.log("Hospital settings loading:", isHospitalSettingsLoading);
    console.log("Hospital settings error:", hospitalSettingsError);
    
    // Always create hospital info object, preferring saved settings over defaults
    const info = {
      name: hospitalSettings?.name || "Health Care Hospital and Diagnostic Center",
      address: hospitalSettings?.address || "In front of Maheshwari Garden, Binjhiya, Jabalpur Road, Mandla, Madhya Pradesh - 482001",
      phone: hospitalSettings?.phone || "8889762101, 9826325958",
      email: hospitalSettings?.email || "hospital@healthcare.in",
      registrationNumber: hospitalSettings?.registrationNumber || "NH/3613/JUL-2021",
      logo: hospitalSettings?.logoPath || undefined,
    };

    console.log("Final hospital info constructed for patients page comprehensive bill:", info);
    console.log("=== End Hospital Info Creation (Patients Page) ===");
    return info;
  }, [hospitalSettings, isHospitalSettingsLoading, hospitalSettingsError]);

  const { data: patients = [], isLoading } = useQuery<Patient[]>({
    queryKey: ["/api/patients"],
  });

  const createPatientMutation = useMutation({
    mutationFn: async (patientData: any) => {
      const response = await fetch("/api/patients", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
        },
        body: JSON.stringify(patientData),
      });
      
      if (!response.ok) {
        throw new Error("Failed to create patient");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients"] });
      setIsNewPatientOpen(false);
      form.reset({
        name: "",
        age: 0,
        gender: "",
        phone: "",
        address: "",
        email: "",
        emergencyContact: "",
      });
      toast({
        title: "Patient created successfully",
        description: "The patient has been registered in the system.",
      });
    },
    onError: () => {
      toast({
        title: "Error creating patient",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const updatePatientMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      // Remove empty string fields
      const filteredUpdates = Object.fromEntries(
        Object.entries(updates).filter(
          ([_, value]) => value !== "" && value !== undefined && value !== null
        )
      );

      const response = await fetch(`/api/patients/${id}`, {
        method: "PATCH", // PATCH for partial updates
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
        },
        body: JSON.stringify(filteredUpdates),
      });

      if (!response.ok) {
        throw new Error("Failed to update patient");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients"] });
      setIsEditPatientOpen(false);
      toast({
        title: "Patient updated successfully",
        description: "The patient record has been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error updating patient",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const generateComprehensiveBillMutation = useMutation({
    mutationFn: async (patientId: string) => {
      // Wait for hospital settings to load before generating bill
      if (isHospitalSettingsLoading) {
        throw new Error("Hospital settings are still loading. Please wait.");
      }

      if (hospitalSettingsError) {
        console.warn("Hospital settings error, proceeding with defaults:", hospitalSettingsError);
      }

      console.log("=== Comprehensive Bill Generation (Patients Page) ===");
      console.log("Patient ID:", patientId);
      console.log("Hospital info being used:", hospitalInfo);
      
      const response = await fetch(`/api/patients/${patientId}/comprehensive-bill`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Comprehensive bill API error:", response.status, errorText);
        throw new Error(`Failed to generate comprehensive bill: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("Comprehensive bill data received:", data);
      console.log("=== End Comprehensive Bill Generation (Patients Page) ===");
      return data;
    },
    onSuccess: (data) => {
      setComprehensiveBillData(data);
      setIsComprehensiveBillOpen(true);
      toast({
        title: "Bill generated successfully",
        description: "Comprehensive financial statement is ready for viewing.",
      });
    },
    onError: (error: any) => {
      console.error("Error generating comprehensive bill:", error);
      toast({
        title: "Error generating bill",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleGenerateComprehensiveBill = (patient: Patient) => {
    // Check if hospital settings are still loading
    if (isHospitalSettingsLoading) {
      toast({
        title: "Loading...",
        description: "Please wait for hospital settings to load.",
      });
      return;
    }

    generateComprehensiveBillMutation.mutate(patient.id);
  };

  const form = useForm({
    resolver: zodResolver(insertPatientSchema),
    defaultValues: {
      name: "",
      age: undefined,
      gender: "",
      phone: "",
      address: "",
      email: "",
      emergencyContact: "",
    },
    mode: "onChange",
  });

  const editForm = useForm({
    resolver: zodResolver(insertPatientSchema),
    defaultValues: {
      name: "",
      age: undefined,
      gender: "",
      phone: "",
      address: "",
      email: "",
      emergencyContact: "",
    },
    mode: "onChange",
  });


  const onSubmit = (data: any) => {
    console.log("Form submitted with data:", data);
    console.log("Form errors:", form.formState.errors);
    
    // Validate required fields explicitly
    if (!data.name?.trim()) {
      form.setError("name", { message: "Name is required" });
      return;
    }
    if (!data.age || data.age <= 0) {
      form.setError("age", { message: "Valid age is required" });
      return;
    }
    if (!data.gender?.trim()) {
      form.setError("gender", { message: "Gender is required" });
      return;
    }
    if (!data.phone?.trim()) {
      form.setError("phone", { message: "Phone number is required" });
      return;
    }
    
    createPatientMutation.mutate(data);
  };

  // Check user roles for billing staff restrictions
  const currentUserRoles = user?.roles || [user?.role]; // Backward compatibility
  const isBillingStaff = currentUserRoles.includes('billing_staff') && !currentUserRoles.includes('admin') && !currentUserRoles.includes('super_user');

  const filteredPatients = patients.filter((patient: Patient) =>
    patient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    patient.patientId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    patient.phone.includes(searchQuery)
  );


  return (
    <div className="space-y-6">
      <TopBar 
        title="Patient Registration"
        searchPlaceholder="Search patients by name, ID, or phone..."
        onSearch={setSearchQuery}
        onNewAction={isBillingStaff ? undefined : () => setIsNewPatientOpen(true)}
        newActionLabel={isBillingStaff ? undefined : "New Patient"}
      />
      
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>All Patients</CardTitle>
            <p className="text-sm text-muted-foreground">
              Total: {filteredPatients.length} patients
            </p>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-medical-blue mx-auto"></div>
                <p className="text-sm text-muted-foreground mt-2">Loading patients...</p>
              </div>
            ) : filteredPatients.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No patients found</p>
                {!isBillingStaff && (
                  <Button 
                    onClick={() => setIsNewPatientOpen(true)}
                    className="mt-4"
                    data-testid="button-first-patient"
                  >
                    Register your first patient
                  </Button>
                )}
              </div>
            ) : (
              <Table data-testid="patients-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Age/Gender</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Registered</TableHead>
                    {/* <TableHead>Status</TableHead> */}
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPatients.map((patient: Patient) => (
                    <TableRow key={patient.id} data-testid={`patient-row-${patient.id}`}>
                      <TableCell className="font-medium" data-testid={`patient-id-${patient.id}`}>
                        {patient.patientId}
                      </TableCell>
                      <TableCell data-testid={`patient-name-${patient.id}`}>
                        {patient.name}
                      </TableCell>
                      <TableCell data-testid={`patient-age-gender-${patient.id}`}>
                        {patient.age}y, {patient.gender}
                      </TableCell>
                      <TableCell data-testid={`patient-phone-${patient.id}`}>
                        {patient.phone}
                      </TableCell>
                      <TableCell data-testid={`patient-registered-${patient.id}`}>
                        {patient.createdAt ? formatDateTime(patient.createdAt) : 'N/A'}
                      </TableCell>
                      {/* <TableCell>
                        <Badge 
                          variant={patient.isActive ? "default" : "secondary"}
                          data-testid={`patient-status-${patient.id}`}
                        >
                          {patient.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell> */}
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => navigate(`/patients/${patient.id}`)}
                            data-testid={`button-view-${patient.id}`}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {!isBillingStaff && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                setSelectedPatient(patient);
                                editForm.reset(patient);   // prefill fields
                                setIsEditPatientOpen(true);
                              }}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleGenerateComprehensiveBill(patient)}
                            disabled={generateComprehensiveBillMutation.isPending || isHospitalSettingsLoading}
                            data-testid={`button-bill-${patient.id}`}
                            title="Generate Comprehensive Bill"
                          >
                            {(generateComprehensiveBillMutation.isPending || isHospitalSettingsLoading) ? (
                              <div className="w-4 h-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            )}
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
      </div>

      {/* New Patient Dialog */}
      <Dialog open={isNewPatientOpen} onOpenChange={setIsNewPatientOpen}>

        <DialogContent className="max-w-2xl" data-testid="new-patient-dialog">
          <DialogHeader>
            <DialogTitle>Register New Patient</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  {...form.register("name")}
                  placeholder="Enter patient's full name"
                  data-testid="input-patient-name"
                />
                {form.formState.errors.name && (
                  <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="age">Age *</Label>
                <Input
                  id="age"
                  type="number"
                  {...form.register("age", { valueAsNumber: true })}
                  placeholder="Enter age"
                  data-testid="input-patient-age"
                />
                {form.formState.errors.age && (
                  <p className="text-sm text-destructive">{form.formState.errors.age.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="gender">Gender *</Label>
                <Select 
                  value={form.watch("gender")}
                  onValueChange={(value) => form.setValue("gender", value, { shouldValidate: true })}
                >
                  <SelectTrigger data-testid="select-patient-gender">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                {form.formState.errors.gender && (
                  <p className="text-sm text-destructive">{form.formState.errors.gender.message}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  {...form.register("phone")}
                  placeholder="+91 XXXXX XXXXX"
                  data-testid="input-patient-phone"
                />
                {form.formState.errors.phone && (
                  <p className="text-sm text-destructive">{form.formState.errors.phone.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                {...form.register("email")}
                placeholder="patient@example.com"
                data-testid="input-patient-email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                {...form.register("address")}
                placeholder="Enter complete address"
                rows={3}
                data-testid="input-patient-address"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="emergencyContact">Emergency Contact</Label>
              <Input
                id="emergencyContact"
                {...form.register("emergencyContact")}
                placeholder="+91 XXXXX XXXXX"
                data-testid="input-patient-emergency"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsNewPatientOpen(false)}
                data-testid="button-cancel-patient"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createPatientMutation.isPending || !form.formState.isValid}
                className="bg-medical-blue hover:bg-medical-blue/90"
                data-testid="button-save-patient"
              >
                {createPatientMutation.isPending ? "Saving..." : "Register Patient"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>


      {/* Edit Patient Dialog */}
      <Dialog open={isEditPatientOpen} onOpenChange={setIsEditPatientOpen}>
        <DialogContent className="max-w-2xl" data-testid="edit-patient-dialog">
          <DialogHeader>
            <DialogTitle>Edit Patient: {selectedPatient?.name}</DialogTitle>
          </DialogHeader>
          
          <form
            onSubmit={editForm.handleSubmit((data) => {
              if (!selectedPatient) return;
              updatePatientMutation.mutate(
                { id: selectedPatient.id, updates: data },
                {
                  onSuccess: () => {
                    setIsEditPatientOpen(false);
                    editForm.reset();
                  },
                }
              );
            })}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  {...editForm.register("name")}
                  placeholder="Enter patient's full name"
                />
                {editForm.formState.errors.name && (
                  <p className="text-sm text-destructive">
                    {editForm.formState.errors.name.message}
                  </p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="age">Age *</Label>
                <Input
                  id="age"
                  type="number"
                  {...editForm.register("age", { valueAsNumber: true })}
                  placeholder="Enter age"
                />
                {editForm.formState.errors.age && (
                  <p className="text-sm text-destructive">
                    {editForm.formState.errors.age.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="gender">Gender *</Label>
                <Select
                  value={editForm.watch("gender")}
                  onValueChange={(value) =>
                    editForm.setValue("gender", value, { shouldValidate: true })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                {editForm.formState.errors.gender && (
                  <p className="text-sm text-destructive">
                    {editForm.formState.errors.gender.message}
                  </p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  {...editForm.register("phone")}
                  placeholder="+91 XXXXX XXXXX"
                />
                {editForm.formState.errors.phone && (
                  <p className="text-sm text-destructive">
                    {editForm.formState.errors.phone.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                {...editForm.register("email")}
                placeholder="patient@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                {...editForm.register("address")}
                placeholder="Enter complete address"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="emergencyContact">Emergency Contact</Label>
              <Input
                id="emergencyContact"
                {...editForm.register("emergencyContact")}
                placeholder="+91 XXXXX XXXXX"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditPatientOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  updatePatientMutation.isPending ||
                  !editForm.formState.isValid
                }
                className="bg-medical-blue hover:bg-medical-blue/90"
              >
                {updatePatientMutation.isPending ? "Saving..." : "Update Patient"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Comprehensive Bill Template */}
      {comprehensiveBillData && (
        <ComprehensiveBillTemplate
          billData={comprehensiveBillData}
          hospitalInfo={hospitalInfo}
          isOpen={isComprehensiveBillOpen}
          onClose={() => {
            setIsComprehensiveBillOpen(false);
            setComprehensiveBillData(null);
          }}
        />
      )}
    </div>
  );
}
