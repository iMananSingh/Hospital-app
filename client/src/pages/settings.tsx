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
import { Switch } from "@/components/ui/switch";
import { 
  Settings as SettingsIcon, 
  Users, 
  Shield, 
  Database, 
  Bell, 
  Palette,
  Plus,
  Edit,
  Trash2,
  UserPlus
} from "lucide-react";
import { insertServiceSchema, insertUserSchema } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import type { Service, User } from "@shared/schema";

export default function Settings() {
  const [isNewServiceOpen, setIsNewServiceOpen] = useState(false);
  const [isNewUserOpen, setIsNewUserOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: services, isLoading: servicesLoading } = useQuery({
    queryKey: ["/api/services"],
  });

  const createServiceMutation = useMutation({
    mutationFn: async (serviceData: any) => {
      const response = await fetch("/api/services", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
        },
        body: JSON.stringify(serviceData),
      });
      
      if (!response.ok) {
        throw new Error("Failed to create service");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      setIsNewServiceOpen(false);
      serviceForm.reset();
      toast({
        title: "Service created successfully",
        description: "The service has been added to the system.",
      });
    },
    onError: () => {
      toast({
        title: "Error creating service",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (userData: any) => {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
        },
        body: JSON.stringify(userData),
      });
      
      if (!response.ok) {
        throw new Error("Failed to create user");
      }
      
      return response.json();
    },
    onSuccess: () => {
      setIsNewUserOpen(false);
      userForm.reset();
      toast({
        title: "User created successfully",
        description: "The user account has been created.",
      });
    },
    onError: () => {
      toast({
        title: "Error creating user",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const serviceForm = useForm({
    resolver: zodResolver(insertServiceSchema),
    defaultValues: {
      name: "",
      category: "",
      price: 0,
      description: "",
    },
  });

  const userForm = useForm({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      username: "",
      password: "",
      fullName: "",
      role: "",
    },
  });

  const onServiceSubmit = (data: any) => {
    createServiceMutation.mutate(data);
  };

  const onUserSubmit = (data: any) => {
    createUserMutation.mutate(data);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const serviceCategories = [
    "consultation",
    "pathology", 
    "radiology",
    "procedure",
    "surgery",
    "pharmacy",
    "emergency"
  ];

  const userRoles = [
    "admin",
    "doctor",
    "receptionist", 
    "billing_staff"
  ];

  const getCategoryColor = (category: string) => {
    switch (category.toLowerCase()) {
      case 'consultation':
        return 'bg-blue-100 text-blue-800';
      case 'pathology':
        return 'bg-purple-100 text-purple-800';
      case 'radiology':
        return 'bg-green-100 text-green-800';
      case 'procedure':
        return 'bg-orange-100 text-orange-800';
      case 'surgery':
        return 'bg-red-100 text-red-800';
      case 'pharmacy':
        return 'bg-teal-100 text-teal-800';
      case 'emergency':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'doctor':
        return 'bg-blue-100 text-blue-800';
      case 'receptionist':
        return 'bg-green-100 text-green-800';
      case 'billing_staff':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Only show settings if user is admin
  if (user?.role !== 'admin') {
    return (
      <div className="space-y-6">
        <TopBar title="System Settings" />
        <div className="p-6">
          <Card>
            <CardContent className="p-8 text-center">
              <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Access Restricted</h3>
              <p className="text-muted-foreground">
                Only administrators can access system settings.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <TopBar title="System Settings" />
      
      <div className="p-6">
        <Tabs defaultValue="services" className="space-y-6">
          <TabsList>
            <TabsTrigger value="services" data-testid="tab-services">Services</TabsTrigger>
            <TabsTrigger value="users" data-testid="tab-users">User Management</TabsTrigger>
            <TabsTrigger value="system" data-testid="tab-system">System</TabsTrigger>
            <TabsTrigger value="backup" data-testid="tab-backup">Backup</TabsTrigger>
          </TabsList>

          <TabsContent value="services">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Service Management</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Manage billable services and their pricing
                    </p>
                  </div>
                  <Button 
                    onClick={() => setIsNewServiceOpen(true)}
                    className="bg-medical-blue hover:bg-medical-blue/90"
                    data-testid="button-add-service"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Service
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {servicesLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-medical-blue mx-auto"></div>
                    <p className="text-sm text-muted-foreground mt-2">Loading services...</p>
                  </div>
                ) : services?.length === 0 ? (
                  <div className="text-center py-8">
                    <SettingsIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No services configured</p>
                    <Button 
                      onClick={() => setIsNewServiceOpen(true)}
                      className="mt-4"
                      data-testid="button-first-service"
                    >
                      Add your first service
                    </Button>
                  </div>
                ) : (
                  <Table data-testid="services-table">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Service Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {services?.map((service: Service) => (
                        <TableRow key={service.id} data-testid={`service-row-${service.id}`}>
                          <TableCell className="font-medium" data-testid={`service-name-${service.id}`}>
                            {service.name}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant="secondary" 
                              className={getCategoryColor(service.category)}
                              data-testid={`service-category-${service.id}`}
                            >
                              {service.category}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium" data-testid={`service-price-${service.id}`}>
                            {formatCurrency(service.price)}
                          </TableCell>
                          <TableCell className="max-w-xs truncate" data-testid={`service-description-${service.id}`}>
                            {service.description || "No description"}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={service.isActive ? "default" : "secondary"}
                              data-testid={`service-status-${service.id}`}
                            >
                              {service.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => setSelectedService(service)}
                                data-testid={`button-edit-service-${service.id}`}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                data-testid={`button-delete-service-${service.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
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

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>User Management</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Manage system users and their roles
                    </p>
                  </div>
                  <Button 
                    onClick={() => setIsNewUserOpen(true)}
                    className="bg-medical-blue hover:bg-medical-blue/90"
                    data-testid="button-add-user"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add User
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">User listing functionality coming soon</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="system">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>System Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base">Email Notifications</Label>
                      <p className="text-sm text-muted-foreground">Send email alerts for important events</p>
                    </div>
                    <Switch data-testid="switch-email-notifications" />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base">SMS Notifications</Label>
                      <p className="text-sm text-muted-foreground">Send SMS alerts to patients</p>
                    </div>
                    <Switch data-testid="switch-sms-notifications" />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base">Auto Backup</Label>
                      <p className="text-sm text-muted-foreground">Automatically backup data daily</p>
                    </div>
                    <Switch defaultChecked data-testid="switch-auto-backup" />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base">Audit Logging</Label>
                      <p className="text-sm text-muted-foreground">Track all user actions</p>
                    </div>
                    <Switch defaultChecked data-testid="switch-audit-logging" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Hospital Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Hospital Logo</Label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                      <div className="space-y-2">
                        <div className="w-16 h-16 mx-auto bg-gray-100 rounded-lg flex items-center justify-center">
                          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div>
                          <Input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            id="logo-upload"
                            data-testid="input-hospital-logo"
                          />
                          <Label 
                            htmlFor="logo-upload" 
                            className="cursor-pointer text-sm text-blue-600 hover:text-blue-500"
                          >
                            Upload Hospital Logo
                          </Label>
                          <p className="text-xs text-gray-500 mt-1">PNG, JPG, GIF up to 2MB</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Hospital Name</Label>
                    <Input defaultValue="MedCare Pro Hospital" data-testid="input-hospital-name" />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Address</Label>
                    <Textarea 
                      defaultValue="123 Healthcare Street, Medical District, City - 123456"
                      rows={3}
                      data-testid="input-hospital-address"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input defaultValue="+91 98765 43210" data-testid="input-hospital-phone" />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input defaultValue="info@medcarepro.com" data-testid="input-hospital-email" />
                    </div>
                  </div>
                  
                  <Button className="w-full" data-testid="button-save-hospital-info">
                    Save Hospital Information
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="backup">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Data Backup</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center py-4">
                    <Database className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">Protect your hospital data with regular backups</p>
                    
                    <div className="space-y-2">
                      <Button className="w-full" data-testid="button-create-backup">
                        <Database className="w-4 h-4 mr-2" />
                        Create Backup Now
                      </Button>
                      <Button variant="outline" className="w-full" data-testid="button-restore-backup">
                        Restore from Backup
                      </Button>
                    </div>
                  </div>
                  
                  <div className="text-xs text-muted-foreground">
                    <p>Last backup: Never</p>
                    <p>Next scheduled backup: Tonight at 2:00 AM</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Export Data</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Export hospital data for reporting or compliance purposes
                  </p>
                  
                  <div className="space-y-2">
                    <Button variant="outline" className="w-full" data-testid="button-export-patients">
                      Export Patient Data
                    </Button>
                    <Button variant="outline" className="w-full" data-testid="button-export-bills">
                      Export Billing Data
                    </Button>
                    <Button variant="outline" className="w-full" data-testid="button-export-reports">
                      Export Lab Reports
                    </Button>
                    <Button variant="outline" className="w-full" data-testid="button-export-audit">
                      Export Audit Logs
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* New Service Dialog */}
      <Dialog open={isNewServiceOpen} onOpenChange={setIsNewServiceOpen}>
        <DialogContent className="max-w-2xl" data-testid="new-service-dialog">
          <DialogHeader>
            <DialogTitle>Add New Service</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={serviceForm.handleSubmit(onServiceSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="serviceName">Service Name *</Label>
                <Input
                  id="serviceName"
                  {...serviceForm.register("name")}
                  placeholder="e.g., Blood Test"
                  data-testid="input-service-name"
                />
                {serviceForm.formState.errors.name && (
                  <p className="text-sm text-destructive">{serviceForm.formState.errors.name.message}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select onValueChange={(value) => serviceForm.setValue("category", value)}>
                  <SelectTrigger data-testid="select-service-category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {serviceCategories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {serviceForm.formState.errors.category && (
                  <p className="text-sm text-destructive">{serviceForm.formState.errors.category.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="price">Price (₹) *</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                {...serviceForm.register("price", { valueAsNumber: true })}
                placeholder="0.00"
                data-testid="input-service-price"
              />
              {serviceForm.formState.errors.price && (
                <p className="text-sm text-destructive">{serviceForm.formState.errors.price.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                {...serviceForm.register("description")}
                placeholder="Optional description of the service"
                rows={3}
                data-testid="input-service-description"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsNewServiceOpen(false)}
                data-testid="button-cancel-service"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createServiceMutation.isPending}
                className="bg-medical-blue hover:bg-medical-blue/90"
                data-testid="button-save-service"
              >
                {createServiceMutation.isPending ? "Adding..." : "Add Service"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* New User Dialog */}
      <Dialog open={isNewUserOpen} onOpenChange={setIsNewUserOpen}>
        <DialogContent className="max-w-2xl" data-testid="new-user-dialog">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={userForm.handleSubmit(onUserSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name *</Label>
                <Input
                  id="fullName"
                  {...userForm.register("fullName")}
                  placeholder="John Doe"
                  data-testid="input-user-fullname"
                />
                {userForm.formState.errors.fullName && (
                  <p className="text-sm text-destructive">{userForm.formState.errors.fullName.message}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="username">Username *</Label>
                <Input
                  id="username"
                  {...userForm.register("username")}
                  placeholder="johndoe"
                  data-testid="input-user-username"
                />
                {userForm.formState.errors.username && (
                  <p className="text-sm text-destructive">{userForm.formState.errors.username.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  {...userForm.register("password")}
                  placeholder="••••••••"
                  data-testid="input-user-password"
                />
                {userForm.formState.errors.password && (
                  <p className="text-sm text-destructive">{userForm.formState.errors.password.message}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="role">Role *</Label>
                <Select onValueChange={(value) => userForm.setValue("role", value)}>
                  <SelectTrigger data-testid="select-user-role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {userRoles.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {userForm.formState.errors.role && (
                  <p className="text-sm text-destructive">{userForm.formState.errors.role.message}</p>
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsNewUserOpen(false)}
                data-testid="button-cancel-user"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createUserMutation.isPending}
                className="bg-medical-blue hover:bg-medical-blue/90"
                data-testid="button-save-user"
              >
                {createUserMutation.isPending ? "Creating..." : "Create User"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
