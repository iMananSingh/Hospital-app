import React, { useState, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  UserPlus,
  RotateCcw,
  Check,
  ChevronsUpDown
} from "lucide-react";
import { insertServiceSchema, insertUserSchema, insertSystemSettingsSchema } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import type { Service, User } from "@shared/schema";
import AccessRestricted from "@/components/access-restricted";
import { clearTimezoneCache } from "@/lib/timezone";
import { cn } from "@/lib/utils";

export default function Settings() {
  const [isNewServiceOpen, setIsNewServiceOpen] = useState(false);
  const [isNewUserOpen, setIsNewUserOpen] = useState(false);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [isDeleteUserOpen, setIsDeleteUserOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [hospitalLogo, setHospitalLogo] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [selectedBackupFile, setSelectedBackupFile] = useState<string>("");
  const [showAutoBackupConfig, setShowAutoBackupConfig] = useState(false);
  const [autoBackupSettings, setAutoBackupSettings] = useState({
    frequency: 'daily',
    time: '02:00'
  });
  const [pendingSystemSettings, setPendingSystemSettings] = useState<any>(null);
  const [timezoneOpen, setTimezoneOpen] = useState(false);

  const { data: services, isLoading: servicesLoading } = useQuery({
    queryKey: ["/api/services"],
  });

  const { data: hospitalSettings, isLoading: settingsLoading } = useQuery({
    queryKey: ["/api/settings/hospital"],
  });

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["/api/users"],
  });

  const { data: systemSettings, isLoading: systemSettingsLoading } = useQuery({
    queryKey: ["/api/settings/system"],
  });

  const popularTimezones = useMemo(() => {
    const timezoneList = [
      { value: 'UTC', label: 'UTC - Coordinated Universal Time' },
      { value: 'Africa/Cairo', label: 'Egypt - Cairo' },
      { value: 'Africa/Johannesburg', label: 'South Africa - Johannesburg' },
      { value: 'Africa/Lagos', label: 'Nigeria - Lagos' },
      { value: 'Africa/Nairobi', label: 'Kenya - Nairobi' },
      { value: 'America/Anchorage', label: 'USA - Alaska' },
      { value: 'America/Argentina/Buenos_Aires', label: 'Argentina - Buenos Aires' },
      { value: 'America/Bogota', label: 'Colombia - Bogota' },
      { value: 'America/Caracas', label: 'Venezuela - Caracas' },
      { value: 'America/Chicago', label: 'USA - Central Time' },
      { value: 'America/Denver', label: 'USA - Mountain Time' },
      { value: 'America/Detroit', label: 'USA - Detroit' },
      { value: 'America/Halifax', label: 'Canada - Halifax' },
      { value: 'America/Los_Angeles', label: 'USA - Pacific Time' },
      { value: 'America/Mexico_City', label: 'Mexico - Mexico City' },
      { value: 'America/New_York', label: 'USA - Eastern Time' },
      { value: 'America/Phoenix', label: 'USA - Arizona' },
      { value: 'America/Santiago', label: 'Chile - Santiago' },
      { value: 'America/Sao_Paulo', label: 'Brazil - Sao Paulo' },
      { value: 'America/Toronto', label: 'Canada - Toronto' },
      { value: 'America/Vancouver', label: 'Canada - Vancouver' },
      { value: 'Asia/Baghdad', label: 'Iraq - Baghdad' },
      { value: 'Asia/Bangkok', label: 'Thailand - Bangkok' },
      { value: 'Asia/Beirut', label: 'Lebanon - Beirut' },
      { value: 'Asia/Colombo', label: 'Sri Lanka - Colombo' },
      { value: 'Asia/Dhaka', label: 'Bangladesh - Dhaka' },
      { value: 'Asia/Dubai', label: 'UAE - Dubai' },
      { value: 'Asia/Hong_Kong', label: 'Hong Kong' },
      { value: 'Asia/Jakarta', label: 'Indonesia - Jakarta' },
      { value: 'Asia/Jerusalem', label: 'Israel - Jerusalem' },
      { value: 'Asia/Kabul', label: 'Afghanistan - Kabul' },
      { value: 'Asia/Karachi', label: 'Pakistan - Karachi' },
      { value: 'Asia/Kathmandu', label: 'Nepal - Kathmandu' },
      { value: 'Asia/Kolkata', label: 'India - New Delhi' },
      { value: 'Asia/Kuala_Lumpur', label: 'Malaysia - Kuala Lumpur' },
      { value: 'Asia/Kuwait', label: 'Kuwait' },
      { value: 'Asia/Manila', label: 'Philippines - Manila' },
      { value: 'Asia/Muscat', label: 'Oman - Muscat' },
      { value: 'Asia/Riyadh', label: 'Saudi Arabia - Riyadh' },
      { value: 'Asia/Seoul', label: 'South Korea - Seoul' },
      { value: 'Asia/Shanghai', label: 'China - Shanghai' },
      { value: 'Asia/Singapore', label: 'Singapore' },
      { value: 'Asia/Taipei', label: 'Taiwan - Taipei' },
      { value: 'Asia/Tehran', label: 'Iran - Tehran' },
      { value: 'Asia/Tokyo', label: 'Japan - Tokyo' },
      { value: 'Atlantic/Azores', label: 'Portugal - Azores' },
      { value: 'Atlantic/Cape_Verde', label: 'Cape Verde' },
      { value: 'Atlantic/Reykjavik', label: 'Iceland - Reykjavik' },
      { value: 'Australia/Adelaide', label: 'Australia - Adelaide' },
      { value: 'Australia/Brisbane', label: 'Australia - Brisbane' },
      { value: 'Australia/Darwin', label: 'Australia - Darwin' },
      { value: 'Australia/Melbourne', label: 'Australia - Melbourne' },
      { value: 'Australia/Perth', label: 'Australia - Perth' },
      { value: 'Australia/Sydney', label: 'Australia - Sydney' },
      { value: 'Europe/Amsterdam', label: 'Netherlands - Amsterdam' },
      { value: 'Europe/Athens', label: 'Greece - Athens' },
      { value: 'Europe/Belgrade', label: 'Serbia - Belgrade' },
      { value: 'Europe/Berlin', label: 'Germany - Berlin' },
      { value: 'Europe/Brussels', label: 'Belgium - Brussels' },
      { value: 'Europe/Bucharest', label: 'Romania - Bucharest' },
      { value: 'Europe/Budapest', label: 'Hungary - Budapest' },
      { value: 'Europe/Copenhagen', label: 'Denmark - Copenhagen' },
      { value: 'Europe/Dublin', label: 'Ireland - Dublin' },
      { value: 'Europe/Helsinki', label: 'Finland - Helsinki' },
      { value: 'Europe/Istanbul', label: 'Turkey - Istanbul' },
      { value: 'Europe/Kiev', label: 'Ukraine - Kiev' },
      { value: 'Europe/Lisbon', label: 'Portugal - Lisbon' },
      { value: 'Europe/London', label: 'UK - London' },
      { value: 'Europe/Madrid', label: 'Spain - Madrid' },
      { value: 'Europe/Moscow', label: 'Russia - Moscow' },
      { value: 'Europe/Oslo', label: 'Norway - Oslo' },
      { value: 'Europe/Paris', label: 'France - Paris' },
      { value: 'Europe/Prague', label: 'Czech Republic - Prague' },
      { value: 'Europe/Rome', label: 'Italy - Rome' },
      { value: 'Europe/Stockholm', label: 'Sweden - Stockholm' },
      { value: 'Europe/Vienna', label: 'Austria - Vienna' },
      { value: 'Europe/Warsaw', label: 'Poland - Warsaw' },
      { value: 'Europe/Zurich', label: 'Switzerland - Zurich' },
      { value: 'Pacific/Auckland', label: 'New Zealand - Auckland' },
      { value: 'Pacific/Fiji', label: 'Fiji' },
      { value: 'Pacific/Guam', label: 'Guam' },
      { value: 'Pacific/Honolulu', label: 'USA - Hawaii' },
      { value: 'Pacific/Midway', label: 'Midway Island' },
      { value: 'Pacific/Port_Moresby', label: 'Papua New Guinea' },
      { value: 'Pacific/Tongatapu', label: 'Tonga' },
    ];
    return timezoneList;
  }, []);

  const getTimezoneOffset = (timezone: string): string => {
    try {
      const date = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        timeZoneName: 'longOffset'
      });
      const parts = formatter.formatToParts(date);
      const offsetPart = parts.find(part => part.type === 'timeZoneName');
      if (offsetPart && offsetPart.value.includes('GMT')) {
        const match = offsetPart.value.match(/GMT([+-]\d{1,2}):?(\d{2})?/);
        if (match) {
          const hours = match[1];
          const minutes = match[2] || '00';
          return `${hours.padStart(3, '0')}:${minutes}`;
        }
      }
      return '+00:00';
    } catch (error) {
      return '+00:00';
    }
  };

  React.useEffect(() => {
    if (systemSettings && !pendingSystemSettings) {
      setPendingSystemSettings(systemSettings);
    }
  }, [systemSettings]);

  const { data: backupHistory = [], isLoading: backupHistoryLoading, refetch: refetchBackupHistory } = useQuery({
    queryKey: ["/api/backup/history"],
    queryFn: async () => {
      const response = await fetch("/api/backup/history", {
        headers: { Authorization: `Bearer ${localStorage.getItem("hospital_token")}` }
      });

      if (!response.ok) {
        return []; // Return empty array on error
      }

      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
  });

  // Get all backup logs (including restores) for finding last restored
  const { data: allBackupLogs = [] } = useQuery({
    queryKey: ["/api/backup/logs"],
    queryFn: async () => {
      const response = await fetch("/api/backup/logs", {
        headers: { Authorization: `Bearer ${localStorage.getItem("hospital_token")}` }
      });

      if (!response.ok) {
        return []; // Return empty array on error
      }

      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: availableBackups = [], refetch: refetchAvailableBackups } = useQuery({
    queryKey: ["/api/backup/available"],
    queryFn: async () => {
      const response = await fetch("/api/backup/available", {
        headers: { Authorization: `Bearer ${localStorage.getItem("hospital_token")}` }
      });

      if (!response.ok) {
        return []; // Return empty array on error
      }

      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: showRestoreDialog,
  });

  const saveHospitalSettingsMutation = useMutation({
    mutationFn: async (settingsData: any) => {
      const response = await fetch("/api/settings/hospital", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
        },
        body: JSON.stringify(settingsData),
      });

      if (!response.ok) {
        throw new Error("Failed to save hospital settings");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/hospital"] });
      toast({
        title: "Settings saved successfully",
        description: "Hospital information has been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error saving settings",
        description: "Please try again.",
        variant: "destructive",
      });
    },
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
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
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

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, userData }: { id: string; userData: any }) => {
      // Filter out empty password field to avoid updating it
      const filteredData = { ...userData };
      if (!filteredData.password || filteredData.password.trim() === '') {
        delete filteredData.password;
      }

      const response = await fetch(`/api/users/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
        },
        body: JSON.stringify(filteredData),
      });

      if (!response.ok) {
        throw new Error("Failed to update user");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsEditUserOpen(false);
      editUserForm.reset();
      toast({
        title: "User updated successfully",
        description: "The user account has been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error updating user",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(`/api/users/${userId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete user");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsDeleteUserOpen(false);
      setUserToDelete(null);
      toast({
        title: "User deleted successfully",
        description: "The user account has been deleted.",
      });
    },
    onError: () => {
      toast({
        title: "Error deleting user",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const saveSystemSettingsMutation = useMutation({
    mutationFn: async (settingsData: any) => {
      const response = await fetch("/api/settings/system", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
        },
        body: JSON.stringify(settingsData),
      });

      if (!response.ok) {
        throw new Error("Failed to save system settings");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/system"] });
      toast({
        title: "Settings saved successfully",
        description: "System configuration has been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error saving settings",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const createBackupMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/backup/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
        },
        body: JSON.stringify({ backupType: 'manual' }),
      });

      if (!response.ok) {
        throw new Error("Failed to create backup");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/backup/history"] });
      refetchAvailableBackups();
      toast({
        title: "Manual backup created successfully",
        description: "Your data has been backed up securely.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error creating backup",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });



  const restoreBackupMutation = useMutation({
    mutationFn: async (backupFilePath: string) => {
      const response = await fetch("/api/backup/restore", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("hospital_token")}`,
        },
        body: JSON.stringify({ backupFilePath }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to restore backup");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Backup restored successfully. Please refresh the page to see changes.",
      });
      setShowRestoreDialog(false);
      setSelectedBackupFile("");
      refetchBackupHistory();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
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
      roles: [],
    },
  });

  const editUserForm = useForm({
    defaultValues: {
      username: "",
      fullName: "",
      roles: [],
    },
  });

  const hospitalForm = useForm({
    defaultValues: {
      name: hospitalSettings?.name || "MedCare Pro Hospital",
      address: hospitalSettings?.address || "123 Healthcare Street, Medical District, City - 123456",
      phone: hospitalSettings?.phone || "+91 98765 43210",
      email: hospitalSettings?.email || "info@medcarepro.com",
      registrationNumber: hospitalSettings?.registrationNumber || "",
    },
  });

  // Update form when hospital settings are loaded
  React.useEffect(() => {
    if (hospitalSettings) {
      hospitalForm.reset({
        name: hospitalSettings.name,
        address: hospitalSettings.address,
        phone: hospitalSettings.phone,
        email: hospitalSettings.email,
        registrationNumber: hospitalSettings.registrationNumber,
      });
      setHospitalLogo(hospitalSettings.logoPath);
    }
  }, [hospitalSettings, hospitalForm]);

  const onServiceSubmit = (data: any) => {
    createServiceMutation.mutate(data);
  };

  const onUserSubmit = (data: any) => {
    createUserMutation.mutate(data);
  };

  const onEditUserSubmit = (data: any) => {
    if (!selectedUser) return;
    updateUserMutation.mutate({ id: selectedUser.id, userData: data });
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    editUserForm.reset({
      username: user.username,
      fullName: user.fullName,
      roles: user.roles || [user.role], // Backward compatibility
    });
    setIsEditUserOpen(true);
  };

  const handleDeleteUser = (user: User) => {
    setUserToDelete(user);
    setIsDeleteUserOpen(true);
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image under 2MB.",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setHospitalLogo(result);
    };
    reader.readAsDataURL(file);
  };

  const onHospitalSettingsSubmit = (data: any) => {
    saveHospitalSettingsMutation.mutate({
      ...data,
      logoPath: hospitalLogo,
    });
  };

  const handleSystemSettingChange = (field: string, value: boolean | string) => {
    if (field === 'autoBackup' && value) {
      // Show configuration dialog when enabling auto backup
      setAutoBackupSettings({
        frequency: pendingSystemSettings?.backupFrequency || 'daily',
        time: pendingSystemSettings?.backupTime || '02:00'
      });
      setShowAutoBackupConfig(true);
      return;
    }

    const updatedSettings = {
      ...pendingSystemSettings,
      [field]: value,
    };

    setPendingSystemSettings(updatedSettings);
  };

  const handleSaveSystemSettings = () => {
    saveSystemSettingsMutation.mutate(pendingSystemSettings);
    
    // Clear timezone cache and invalidate queries when timezone settings are updated
    if ((pendingSystemSettings as any)?.timezone !== (systemSettings as any)?.timezone || 
        (pendingSystemSettings as any)?.timezoneOffset !== (systemSettings as any)?.timezoneOffset) {
      clearTimezoneCache();
      // Force all components to re-fetch system settings to get the new timezone
      queryClient.invalidateQueries({ queryKey: ["/api/settings/system"] });
    }
  };

  const handleTimezoneChange = (timezoneValue: string) => {
    const selectedTimezone = popularTimezones.find(tz => tz.value === timezoneValue);
    if (selectedTimezone) {
      const dynamicOffset = getTimezoneOffset(selectedTimezone.value);
      const updatedSettings = {
        ...pendingSystemSettings,
        timezone: selectedTimezone.value,
        timezoneOffset: dynamicOffset,
      };
      setPendingSystemSettings(updatedSettings);
      setTimezoneOpen(false);
    }
  };

  const handleAutoBackupConfigSave = () => {
    const updatedSettings = {
      ...pendingSystemSettings,
      autoBackup: true,
      backupFrequency: autoBackupSettings.frequency,
      backupTime: autoBackupSettings.time
    };

    setPendingSystemSettings(updatedSettings);
    setShowAutoBackupConfig(false);
  };

  const handleCreateBackup = () => {
    createBackupMutation.mutate();
  };



  const handleRestoreBackup = () => {
    if (selectedBackupFile) {
      restoreBackupMutation.mutate(selectedBackupFile);
    }
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
    "super_user",
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
      case 'super_user':
        return 'bg-gray-100 text-gray-600 border border-gray-300'; // Silver styling
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

  // Only show settings if user has admin or super_user role
  const currentUserRoles = user?.roles || [user?.role]; // Backward compatibility
  const hasAccess = currentUserRoles.includes('admin') || currentUserRoles.includes('super_user');

  if (!hasAccess) {
    return (
      <div className="space-y-6">
        <TopBar title="System Settings" />
        <div className="p-6">
          <AccessRestricted 
            title="Access Restricted"
            description="Only administrators and super users can access system settings."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <TopBar title="System Settings" />

      <div className="p-6">
        <Tabs defaultValue="users" className="space-y-6">
          <TabsList>
            <TabsTrigger value="users" data-testid="tab-users">User Management</TabsTrigger>
            <TabsTrigger value="system" data-testid="tab-system">System</TabsTrigger>
            <TabsTrigger value="backup" data-testid="tab-backup">Backup</TabsTrigger>
          </TabsList>



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
                {usersLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-medical-blue mx-auto"></div>
                    <p className="text-sm text-muted-foreground mt-2">Loading users...</p>
                  </div>
                ) : users?.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No users found</p>
                    <Button 
                      onClick={() => setIsNewUserOpen(true)}
                      className="mt-4"
                      data-testid="button-first-user"
                    >
                      Add your first user
                    </Button>
                  </div>
                ) : (
                  <Table data-testid="users-table">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Full Name</TableHead>
                        <TableHead>Username</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users?.map((tableUser: User) => (
                        <TableRow key={tableUser.id} data-testid={`user-row-${tableUser.id}`}>
                          <TableCell className="font-medium" data-testid={`user-name-${tableUser.id}`}>
                            {tableUser.fullName}
                          </TableCell>
                          <TableCell data-testid={`user-username-${tableUser.id}`}>
                            {tableUser.username}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {(tableUser.roles || [tableUser.role]).map((role: string) => (
                                <Badge 
                                  key={role}
                                  variant="default"
                                  className={getRoleColor(role)}
                                  data-testid={`user-role-${tableUser.id}-${role}`}
                                >
                                  {role === 'super_user' ? 'Super User' : role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant="default"
                              className="bg-green-100 text-green-800"
                              data-testid={`user-status-${tableUser.id}`}
                            >
                              Active
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              {(() => {
                                const targetUserRoles = tableUser.roles || [tableUser.role];
                                const isEditingSelf = tableUser.id === user?.id;
                                const currentUserIsAdmin = currentUserRoles.includes('admin');
                                const currentUserIsSuperUser = currentUserRoles.includes('super_user');
                                const targetIsAdmin = targetUserRoles.includes('admin');
                                const targetIsSuperUser = targetUserRoles.includes('super_user');
                                
                                // Don't show edit button for root user unless current user is super user
                                if (tableUser.username === 'root' && !currentUserIsSuperUser) {
                                  return null;
                                }
                                
                                let disabled = false;
                                
                                if (currentUserIsSuperUser) {
                                  // Super users can edit anyone
                                  disabled = false;
                                } else if (currentUserIsAdmin) {
                                  // Admins can edit themselves and non-admin users
                                  disabled = !isEditingSelf && (targetIsAdmin || targetIsSuperUser);
                                } else {
                                  // Non-admin users can edit themselves and other non-admin, non-super users
                                  disabled = !isEditingSelf && (targetIsAdmin || targetIsSuperUser);
                                }
                                
                                return (
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => handleEditUser(tableUser)}
                                    disabled={disabled}
                                    data-testid={`button-edit-user-${tableUser.id}`}
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                );
                              })()}
                              {tableUser.username !== 'root' && (
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => handleDeleteUser(tableUser)}
                                  disabled={
                                    tableUser.id === user?.id || // Prevent deleting self
                                    ((tableUser.roles || [tableUser.role]).includes('admin') && !currentUserRoles.includes('super_user')) || // Only super users can delete admin accounts
                                    ((tableUser.roles || [tableUser.role]).includes('super_user') && !currentUserRoles.includes('super_user')) // Only super users can delete super_user accounts
                                  }
                                  data-testid={`button-delete-user-${tableUser.id}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
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

          <TabsContent value="system">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>System Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {systemSettingsLoading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-medical-blue mx-auto"></div>
                      <p className="text-sm text-muted-foreground mt-2">Loading system settings...</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-base">Email Notifications</Label>
                          <p className="text-sm text-muted-foreground">Send email alerts for important events</p>
                        </div>
                        <Switch 
                          checked={pendingSystemSettings?.emailNotifications || false}
                          onCheckedChange={(checked) => handleSystemSettingChange('emailNotifications', checked)}
                          data-testid="switch-email-notifications" 
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-base">SMS Notifications</Label>
                          <p className="text-sm text-muted-foreground">Send SMS alerts to patients</p>
                        </div>
                        <Switch 
                          checked={pendingSystemSettings?.smsNotifications || false}
                          onCheckedChange={(checked) => handleSystemSettingChange('smsNotifications', checked)}
                          data-testid="switch-sms-notifications" 
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-base">Auto Backup</Label>
                          <p className="text-sm text-muted-foreground">
                            {pendingSystemSettings?.autoBackup 
                              ? `Automatically backup data ${pendingSystemSettings.backupFrequency || 'daily'} at ${pendingSystemSettings.backupTime || '02:00'}`
                              : 'Automatically backup data at scheduled intervals'
                            }
                          </p>
                        </div>
                        <Switch 
                          checked={pendingSystemSettings?.autoBackup || false}
                          onCheckedChange={(checked) => handleSystemSettingChange('autoBackup', checked)}
                          data-testid="switch-auto-backup" 
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-base">Audit Logging</Label>
                          <p className="text-sm text-muted-foreground">Track all user actions</p>
                        </div>
                        <Switch 
                          checked={pendingSystemSettings?.auditLogging || false}
                          onCheckedChange={(checked) => handleSystemSettingChange('auditLogging', checked)}
                          data-testid="switch-audit-logging" 
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-base">System Timezone</Label>
                        <p className="text-sm text-muted-foreground">All timestamps will be displayed in this timezone</p>
                        <Popover open={timezoneOpen} onOpenChange={setTimezoneOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={timezoneOpen}
                              className="w-full justify-between"
                              data-testid="button-timezone-selector"
                            >
                              <span className="flex-1 text-left truncate">
                                {pendingSystemSettings?.timezone 
                                  ? (() => {
                                      const tz = popularTimezones.find(tz => tz.value === pendingSystemSettings.timezone);
                                      const offset = pendingSystemSettings.timezoneOffset || getTimezoneOffset(pendingSystemSettings.timezone);
                                      return tz ? `${tz.label}   UTC${offset}` : pendingSystemSettings.timezone;
                                    })()
                                  : 'Select timezone...'}
                              </span>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-full p-0">
                            <Command>
                              <CommandInput placeholder="Search timezone..." data-testid="input-timezone-search" />
                              <CommandList>
                                <CommandEmpty>No timezone found.</CommandEmpty>
                                <CommandGroup>
                                  {popularTimezones.map((timezone) => {
                                    const offset = getTimezoneOffset(timezone.value);
                                    return (
                                      <CommandItem
                                        key={timezone.value}
                                        value={timezone.label}
                                        onSelect={() => handleTimezoneChange(timezone.value)}
                                        data-testid={`timezone-option-${timezone.value}`}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            pendingSystemSettings?.timezone === timezone.value ? "opacity-100" : "opacity-0"
                                          )}
                                        />
                                        <span className="flex-1">{timezone.label}</span>
                                        <span className="text-xs text-muted-foreground ml-2">UTC{offset}</span>
                                      </CommandItem>
                                    );
                                  })}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>

                      <Button 
                        onClick={handleSaveSystemSettings}
                        className="w-full bg-medical-blue hover:bg-medical-blue/90"
                        disabled={saveSystemSettingsMutation.isPending}
                        data-testid="button-save-system-settings"
                      >
                        {saveSystemSettingsMutation.isPending ? "Saving..." : "Save System Configuration"}
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Hospital Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={hospitalForm.handleSubmit(onHospitalSettingsSubmit)} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Hospital Logo</Label>
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                        <div className="space-y-2">
                          {hospitalLogo ? (
                            <div className="w-16 h-16 mx-auto rounded-lg overflow-hidden">
                              <img 
                                src={hospitalLogo} 
                                alt="Hospital Logo" 
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="w-16 h-16 mx-auto bg-gray-100 rounded-lg flex items-center justify-center">
                              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                          <div>
                            <Input 
                              ref={fileInputRef}
                              type="file" 
                              accept="image/*" 
                              className="hidden" 
                              id="logo-upload"
                              onChange={handleLogoUpload}
                              data-testid="input-hospital-logo"
                            />
                            <Label 
                              htmlFor="logo-upload" 
                              className="cursor-pointer text-sm text-blue-600 hover:text-blue-500"
                            >
                              {hospitalLogo ? 'Change Hospital Logo' : 'Upload Hospital Logo'}
                            </Label>
                            <p className="text-xs text-gray-500 mt-1">PNG, JPG, GIF up to 2MB</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Hospital Name</Label>
                      <Input 
                        {...hospitalForm.register("name")}
                        data-testid="input-hospital-name" 
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Address</Label>
                      <Textarea 
                        {...hospitalForm.register("address")}
                        rows={3}
                        data-testid="input-hospital-address"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Phone</Label>
                        <Input 
                          {...hospitalForm.register("phone")}
                          data-testid="input-hospital-phone" 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input 
                          {...hospitalForm.register("email")}
                          data-testid="input-hospital-email" 
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Registration Number</Label>
                      <Input 
                        {...hospitalForm.register("registrationNumber")}
                        placeholder="Hospital registration number"
                        data-testid="input-hospital-registration" 
                      />
                    </div>

                    <Button 
                      type="submit"
                      className="w-full" 
                      disabled={saveHospitalSettingsMutation.isPending}
                      data-testid="button-save-hospital-info"
                    >
                      {saveHospitalSettingsMutation.isPending ? "Saving..." : "Save Hospital Information"}
                    </Button>
                  </form>
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
                      <Button 
                        onClick={handleCreateBackup}
                        disabled={createBackupMutation.isPending}
                        className="w-full" 
                        data-testid="button-create-backup"
                      >
                        <Database className="w-4 h-4 mr-2" />
                        {createBackupMutation.isPending ? "Creating..." : "Create Manual Backup"}
                      </Button>



                      <Button 
                        variant="outline" 
                        className="w-full" 
                        data-testid="button-restore-backup"
                        onClick={() => setShowRestoreDialog(true)}
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Restore from Backup
                      </Button>
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    <p>Last backup: {backupHistory && backupHistory.length > 0 
                      ? new Date(backupHistory[0].createdAt).toLocaleString()
                      : 'Never'
                    }</p>
                    <p>Auto backup: {systemSettings?.autoBackup 
                      ? `${systemSettings.backupFrequency} at ${systemSettings.backupTime}`
                      : 'Disabled'
                    }</p>
                    <p>Last restored: {(() => {
                      // Find the most recent restore operation from all backup logs
                      if (!allBackupLogs || !Array.isArray(allBackupLogs)) {
                        return 'N/A';
                      }
                      const restoreOperations = allBackupLogs
                        .filter((log: any) => log.backupType === 'restore' && log.status === 'completed')
                        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                      return restoreOperations.length > 0 
                        ? new Date(restoreOperations[0].createdAt).toLocaleString()
                        : 'N/A';
                    })()}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Backup History</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {backupHistoryLoading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-medical-blue mx-auto"></div>
                      <p className="text-sm text-muted-foreground mt-2">Loading backup history...</p>
                    </div>
                  ) : !backupHistory || backupHistory.length === 0 ? (
                    <div className="text-center py-8">
                      <Database className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No backups created yet</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {backupHistory.slice(0, 10).map((backup: any) => (
                        <div key={backup.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{backup.backupId}</p>
                            <p className="text-xs text-muted-foreground">
                              {backup.backupType === 'auto' ? 'Automatic' : 'Manual'} • 
                              {new Date(backup.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <Badge variant={backup.status === 'completed' ? 'default' : 'secondary'}>
                              {backup.status}
                            </Badge>
                            {backup.size && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {(backup.size / (1024 * 1024)).toFixed(2)} MB
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="pt-4 border-t">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Total Backups</p>
                        <p className="font-medium">{backupHistory?.length || 0}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Backup Storage</p>
                        <p className="font-medium">
                          {backupHistory && backupHistory.length > 0 
                            ? `${(backupHistory.reduce((sum: number, b: any) => sum + (b.size || 0), 0) / (1024 * 1024)).toFixed(2)} MB`
                            : '0 MB'
                          }
                        </p>
                      </div>
                    </div>
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

            <div className="space-y-4">
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
                <Label>Roles *</Label>
                <div className="grid grid-cols-2 gap-2">
                  {userRoles.map((role) => {
                    // Disable admin and super_user roles for admin users (not super users)
                    const isRoleDisabled = currentUserRoles.includes('admin') && 
                                         !currentUserRoles.includes('super_user') && 
                                         (role === 'admin' || role === 'super_user');

                    return (
                      <div key={role} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`role-${role}`}
                          checked={userForm.watch("roles").includes(role)}
                          disabled={isRoleDisabled}
                          onChange={(e) => {
                            const currentRoles = userForm.watch("roles");
                            if (e.target.checked) {
                              userForm.setValue("roles", [...currentRoles, role]);
                            } else {
                              userForm.setValue("roles", currentRoles.filter(r => r !== role));
                            }
                          }}
                          data-testid={`checkbox-role-${role}`}
                        />
                        <Label htmlFor={`role-${role}`} className={`text-sm ${isRoleDisabled ? 'text-gray-400' : ''}`}>
                          {role === 'super_user' ? 'Super User' : role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </Label>
                      </div>
                    );
                  })}
                </div>
                {userForm.formState.errors.roles && (
                  <p className="text-sm text-destructive">{userForm.formState.errors.roles.message}</p>
                )}
                {currentUserRoles.includes('admin') && !currentUserRoles.includes('super_user') && (
                  <p className="text-xs text-muted-foreground">
                    Note: Admin users cannot grant admin or super user roles.
                  </p>
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

      {/* Edit User Dialog */}
      <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
        <DialogContent className="max-w-2xl" data-testid="edit-user-dialog">
          <DialogHeader>
            <DialogTitle>Edit User: {selectedUser?.fullName}</DialogTitle>
          </DialogHeader>

          <form onSubmit={editUserForm.handleSubmit(onEditUserSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editFullName">Full Name *</Label>
                <Input
                  id="editFullName"
                  {...editUserForm.register("fullName")}
                  placeholder="John Doe"
                  data-testid="input-edit-user-fullname"
                />
                {editUserForm.formState.errors.fullName && (
                  <p className="text-sm text-destructive">{editUserForm.formState.errors.fullName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="editUsername">Username *</Label>
                <Input
                  id="editUsername"
                  {...editUserForm.register("username")}
                  placeholder="johndoe"
                  data-testid="input-edit-user-username"
                />
                {editUserForm.formState.errors.username && (
                  <p className="text-sm text-destructive">{editUserForm.formState.errors.username.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="editPassword">New Password</Label>
                <Input
                  id="editPassword"
                  type="password"
                  {...editUserForm.register("password")}
                  placeholder="Leave empty to keep current"
                  data-testid="input-edit-user-password"
                />
                {editUserForm.formState.errors.password && (
                  <p className="text-sm text-destructive">{editUserForm.formState.errors.password.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Roles *</Label>
                <div className="grid grid-cols-2 gap-2">
                  {userRoles.map((role) => {
                    const isEditingSelf = selectedUser?.id === user?.id;
                    const currentUserIsAdmin = currentUserRoles.includes('admin');
                    const currentUserIsSuperUser = currentUserRoles.includes('super_user');
                    
                    let isRoleDisabled = false;
                    
                    if (currentUserIsSuperUser) {
                      // Super users can grant any role (no restrictions)
                      isRoleDisabled = false;
                    } else if (currentUserIsAdmin) {
                      // Admins cannot modify their own roles or grant admin/super_user roles
                      if (isEditingSelf) {
                        isRoleDisabled = true; // Cannot modify own roles
                      } else {
                        isRoleDisabled = role === 'admin' || role === 'super_user'; // Cannot grant admin/super roles
                      }
                    } else {
                      // Non-admin users cannot modify their own roles or grant admin/super_user roles
                      if (isEditingSelf) {
                        isRoleDisabled = true; // Cannot modify own roles
                      } else {
                        isRoleDisabled = role === 'admin' || role === 'super_user'; // Cannot grant admin/super roles
                      }
                    }

                    return (
                      <div key={role} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`edit-role-${role}`}
                          checked={editUserForm.watch("roles").includes(role)}
                          disabled={isRoleDisabled}
                          onChange={(e) => {
                            const currentRoles = editUserForm.watch("roles");
                            if (e.target.checked) {
                              editUserForm.setValue("roles", [...currentRoles, role]);
                            } else {
                              editUserForm.setValue("roles", currentRoles.filter(r => r !== role));
                            }
                          }}
                          data-testid={`edit-checkbox-role-${role}`}
                        />
                        <Label htmlFor={`edit-role-${role}`} className={`text-sm ${isRoleDisabled ? 'text-gray-400' : ''}`}>
                          {role === 'super_user' ? 'Super User' : role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </Label>
                      </div>
                    );
                  })}
                </div>
                {editUserForm.formState.errors.roles && (
                  <p className="text-sm text-destructive">{editUserForm.formState.errors.roles.message}</p>
                )}
                {!currentUserRoles.includes('super_user') && (
                  <p className="text-xs text-muted-foreground">
                    Note: {currentUserRoles.includes('admin') ? 'Admin users' : 'Users'} cannot grant admin or super user roles, and cannot modify their own roles.
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditUserOpen(false)}
                data-testid="button-cancel-edit-user"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateUserMutation.isPending}
                className="bg-medical-blue hover:bg-medical-blue/90"
                data-testid="button-save-edit-user"
              >
                {updateUserMutation.isPending ? "Updating..." : "Update User"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation Dialog */}
      <Dialog open={isDeleteUserOpen} onOpenChange={setIsDeleteUserOpen}>
        <DialogContent data-testid="delete-user-dialog">
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p>Are you sure you want to delete user <strong>{userToDelete?.fullName}</strong>?</p>
            <p className="text-sm text-muted-foreground">
              This action cannot be undone. The user will no longer be able to access the system.
            </p>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteUserOpen(false)}
              data-testid="button-cancel-delete-user"
            >
              Cancel
            </Button>
            <Button
              onClick={() => userToDelete && deleteUserMutation.mutate(userToDelete.id)}
              disabled={deleteUserMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-delete-user"
            >
              {deleteUserMutation.isPending ? "Deleting..." : "Delete User"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Auto Backup Configuration Dialog */}
      <Dialog open={showAutoBackupConfig} onOpenChange={setShowAutoBackupConfig}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configure Auto Backup</DialogTitle>
            <DialogDescription>
              Set up your automatic backup schedule. Backups will run at the specified time.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="backup-frequency">Backup Frequency</Label>
              <Select 
                value={autoBackupSettings.frequency} 
                onValueChange={(value) => setAutoBackupSettings(prev => ({ ...prev, frequency: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly (Sundays)</SelectItem>
                  <SelectItem value="monthly">Monthly (1st of month)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="backup-time">Backup Time</Label>
              <Input
                id="backup-time"
                type="time"
                value={autoBackupSettings.time}
                onChange={(e) => setAutoBackupSettings(prev => ({ ...prev, time: e.target.value }))}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Time is in Indian Standard Time (IST)
              </p>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start space-x-2">
                <div className="w-4 h-4 rounded-full bg-blue-500 mt-0.5 flex-shrink-0"></div>
                <div className="text-sm">
                  <p className="font-medium text-blue-800">Schedule Preview</p>
                  <p className="text-blue-700">
                    Backups will run {autoBackupSettings.frequency} at {autoBackupSettings.time} IST
                    {autoBackupSettings.frequency === 'weekly' && ' (every Sunday)'}
                    {autoBackupSettings.frequency === 'monthly' && ' (on the 1st of each month)'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAutoBackupConfig(false)}>
              Cancel
            </Button>
            <Button onClick={handleAutoBackupConfigSave}>
              Enable Auto Backup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore Backup Dialog */}
      <Dialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Restore from Backup</DialogTitle>
            <DialogDescription>
              Select a backup file to restore your hospital data. This will overwrite all current data.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="max-h-64 overflow-y-auto border rounded-lg">
              {availableBackups.length === 0 ? (
                <div className="text-center py-8">
                  <Database className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No backup files found</p>
                </div>
              ) : (
                <div className="space-y-2 p-4">
                  {availableBackups.map((backup: any) => (
                    <div 
                      key={backup.fileName}
                      className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-gray-50 ${
                        selectedBackupFile === backup.filePath ? 'bg-blue-50 border-blue-200' : ''
                      }`}
                      onClick={() => setSelectedBackupFile(backup.filePath)}
                    >
                      <div className="flex-1">
                        <p className="font-medium text-sm">{backup.fileName}</p>
                        <p className="text-xs text-muted-foreground">
                          Created: {new Date(backup.createdAt).toLocaleString()}
                        </p>
                        {backup.backupLog && (
                          <p className="text-xs text-muted-foreground">
                            Backup ID: {backup.backupLog.backupId}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">
                          {(backup.fileSize / (1024 * 1024)).toFixed(2)} MB
                        </p>
                        {selectedBackupFile === backup.filePath && (
                          <Badge variant="default" className="mt-1">Selected</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedBackupFile && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start space-x-2">
                  <Shield className="w-5 h-5 text-yellow-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-800">Warning</p>
                    <p className="text-sm text-yellow-700">
                      This action will completely replace all current data with the backup data. 
                      This cannot be undone. Make sure to create a current backup before proceeding.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRestoreDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleRestoreBackup}
              disabled={!selectedBackupFile || restoreBackupMutation.isPending}
              variant="destructive"
            >
              {restoreBackupMutation.isPending ? "Restoring..." : "Restore Backup"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}