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
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserPlus, Eye, Edit, Trash2, Stethoscope, IndianRupee } from "lucide-react";
import { insertDoctorSchema } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Doctor } from "@shared/schema";

export default function Doctors() {
  const [isNewDoctorOpen, setIsNewDoctorOpen] = useState(false);
  const [isEditDoctorOpen, setIsEditDoctorOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [doctorToDelete, setDoctorToDelete] = useState<Doctor | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  const { data: doctors, isLoading } = useQuery({
    queryKey: ["/api/doctors"],
  });

  const { data: deletedDoctors, isLoading: isLoadingDeleted } = useQuery({
    queryKey: ["/api/doctors/deleted"],
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
      userId: doctor.userId,
    });
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

  const filteredDoctors = doctors?.filter((doctor: Doctor) =>
    doctor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doctor.specialization.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doctor.qualification.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

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

  const getSpecializationIcon = (specialization: string) => {
    // Return appropriate icon based on specialization
    return <Stethoscope className="w-4 h-4" />;
  };

  return (
    <div className="space-y-6">
      <TopBar 
        title="Doctor Management"
        searchPlaceholder="Search doctors by name or specialization..."
        onSearch={setSearchQuery}
        onNewAction={() => setIsNewDoctorOpen(true)}
        newActionLabel="Add Doctor"
      />

      <div className="p-6">
        <Tabs defaultValue="all-doctors" className="space-y-6">
          <TabsList>
            <TabsTrigger value="all-doctors" data-testid="tab-all-doctors">Active Doctors</TabsTrigger>
            <TabsTrigger value="schedules" data-testid="tab-schedules">Schedules</TabsTrigger>
            <TabsTrigger value="deleted-doctors" data-testid="tab-deleted-doctors">Inactive Doctors</TabsTrigger>
          </TabsList>

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
                    <Button 
                      onClick={() => setIsNewDoctorOpen(true)}
                      className="mt-4"
                      data-testid="button-first-doctor"
                    >
                      Add your first doctor
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="doctors-grid">
                    {filteredDoctors.map((doctor: Doctor) => (
                      <Card key={doctor.id} className="hover:shadow-md transition-shadow" data-testid={`doctor-card-${doctor.id}`}>
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center space-x-3">
                              <div className="w-12 h-12 bg-healthcare-green rounded-full flex items-center justify-center">
                                <span className="text-white font-medium text-sm">
                                  {doctor.name.split(' ').map(n => n[0]).join('')}
                                </span>
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
                              onClick={() => setSelectedDoctor(doctor)}
                              data-testid={`button-view-${doctor.id}`}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              View
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
                              <div className="w-12 h-12 bg-gray-400 rounded-full flex items-center justify-center">
                                <span className="text-white font-medium text-sm">
                                  {doctor.name.split(' ').map(n => n[0]).join('')}
                                </span>
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

                          <div className="flex space-x-2 mt-4 pt-4 border-t">
                            <Button 
                              variant="default" 
                              size="sm"
                              className="flex-1 bg-green-600 hover:bg-green-700"
                              onClick={() => handleRestoreDoctor(doctor.id)}
                              disabled={restoreDoctorMutation.isPending}
                              data-testid={`button-restore-${doctor.id}`}
                            >
                              {restoreDoctorMutation.isPending ? "Restoring..." : "Restore Doctor"}
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

          

          <TabsContent value="schedules">
            <Card>
              <CardHeader>
                <CardTitle>Doctor Schedules</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Manage doctor availability and appointment slots
                </p>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Schedule management feature coming soon</p>
                  <Button className="mt-4" disabled>
                    Configure Schedules
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
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
    </div>
  );
}