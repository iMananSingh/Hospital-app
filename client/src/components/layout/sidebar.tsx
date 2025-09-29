import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { 
  Hospital, 
  FileText, 
  Users, 
  TestTube, 
  UserPlus, 
  BarChart3, 
  Settings,
  LogOut,
  Building2,
  UserCog
} from "lucide-react";
import { useState } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger 
} from "@/components/ui/dialog";
import { 
  Form, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormControl, 
  FormMessage 
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Profile edit form schema
const profileEditSchema = z.object({
  username: z.string().min(1, "Username is required").trim(),
  fullName: z.string().min(1, "Full name is required").trim(),
  password: z.string().min(8, "Password must be at least 8 characters").optional().or(z.literal("")),
  confirmPassword: z.string().optional(),
}).refine((data) => {
  if (data.password && data.password !== "" && data.password !== data.confirmPassword) {
    return false;
  }
  return true;
}, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

interface ProfileEditFormProps {
  user: any;
  onSuccess: () => void;
}

function ProfileEditForm({ user, onSuccess }: ProfileEditFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const form = useForm({
    resolver: zodResolver(profileEditSchema),
    defaultValues: {
      username: user?.username || "",
      fullName: user?.fullName || "",
      password: "",
      confirmPassword: "",
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      const updateData: any = {
        username: data.username,
        fullName: data.fullName,
      };
      
      // Only include password if it's provided
      if (data.password && data.password.trim() !== "") {
        updateData.password = data.password;
      }
      
      return await apiRequest("/api/profile", {
        method: "PUT",
        body: JSON.stringify(updateData),
      });
    },
    onSuccess: (updatedUser) => {
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });
      // Update the user data in cache
      queryClient.setQueryData(["/api/users/me"], updatedUser);
      onSuccess();
      form.reset({
        username: updatedUser.username,
        fullName: updatedUser.fullName,
        password: "",
        confirmPassword: "",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: any) => {
    updateProfileMutation.mutate(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input {...field} data-testid="input-username" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="fullName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full Name</FormLabel>
              <FormControl>
                <Input {...field} data-testid="input-fullname" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>New Password (optional)</FormLabel>
              <FormControl>
                <Input 
                  {...field} 
                  type="password" 
                  placeholder="Leave blank to keep current password"
                  data-testid="input-password" 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirm New Password</FormLabel>
              <FormControl>
                <Input 
                  {...field} 
                  type="password" 
                  placeholder="Confirm new password"
                  data-testid="input-confirm-password" 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-2 pt-4">
          <Button 
            type="submit" 
            disabled={updateProfileMutation.isPending}
            data-testid="button-save-profile"
          >
            {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
          <Button 
            type="button" 
            variant="outline" 
            onClick={onSuccess}
            data-testid="button-cancel-profile"
          >
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}

const baseNavigation = [
  { name: "Dashboard", href: "/", icon: BarChart3, roles: ["admin", "doctor", "receptionist", "billing_staff", "super_user"] },
  { name: "Patient Registration", href: "/patients", icon: Users, roles: ["admin", "doctor", "receptionist", "billing_staff", "super_user"] },
  { name: "Pathology Tests", href: "/pathology", icon: TestTube, roles: ["admin", "doctor", "receptionist", "billing_staff", "super_user"] },
  { name: "Doctor Management", href: "/doctors", icon: UserPlus, roles: ["admin", "billing_staff", "super_user"] },
  { name: "Service Management", href: "/services", icon: Building2, roles: ["admin", "super_user"] },
  { name: "Revenue & Payments", href: "/revenue", icon: FileText, roles: ["admin", "billing_staff", "super_user"] },
  { name: "System Settings", href: "/settings", icon: Settings, roles: ["admin", "super_user"] },
];

export default function Sidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase();
  };

  const isActive = (href: string) => {
    return location === href || (href !== "/" && location.startsWith(href));
  };

  // Filter navigation items based on user roles
  const navigation = baseNavigation.filter(item => {
    // Get user roles with fallback to single role for backward compatibility
    const userRoles = user?.roles || (user?.role ? [user.role] : []);
    return userRoles.some((role: string) => item.roles.includes(role));
  });

  return (
    <aside className="w-64 bg-surface border-r border-border flex flex-col shadow-sm">
      {/* Logo and Hospital Name */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-medical-blue rounded-lg flex items-center justify-center">
            <Hospital className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-text-dark">MedCare Pro</h1>
            <p className="text-sm text-text-muted">Hospital Management</p>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 p-4 space-y-2">
        {navigation.map((item) => (
          <Link 
            key={item.name} 
            href={item.href}
            className={cn(
              "flex items-center space-x-3 px-3 py-3 rounded-lg font-medium transition-colors",
              isActive(item.href)
                ? "bg-medical-blue text-white"
                : "text-text-muted hover:bg-muted hover:text-text-dark"
            )}
            data-testid={`nav-${item.href === "/" ? "dashboard" : item.href.substring(1)}`}
          >
            <item.icon className="w-5 h-5" />
            <span>{item.name}</span>
          </Link>
        ))}
      </nav>

      {/* User Profile Section */}
      <div className="p-4 border-t border-border">
        <Dialog open={isProfileDialogOpen} onOpenChange={setIsProfileDialogOpen}>
          <DialogTrigger asChild>
            <div className="flex items-center space-x-3 mb-3 cursor-pointer hover:bg-muted rounded-lg p-2 transition-colors" data-testid="profile-trigger">
              <div className="w-10 h-10 bg-healthcare-green rounded-full flex items-center justify-center">
                <span className="text-white font-medium text-sm" data-testid="user-initials">
                  {user ? getInitials(user.fullName) : "U"}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-dark truncate" data-testid="user-name">
                  {user?.fullName || "User"}
                </p>
                <p className="text-xs text-text-muted capitalize" data-testid="user-role">
                  {user?.role?.replace('_', ' ') || "Role"}
                </p>
              </div>
              <UserCog className="w-4 h-4 text-text-muted" />
            </div>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Profile</DialogTitle>
            </DialogHeader>
            <ProfileEditForm user={user} onSuccess={() => setIsProfileDialogOpen(false)} />
          </DialogContent>
        </Dialog>
        <Button
          variant="ghost"
          size="sm"
          onClick={logout}
          className="w-full justify-start text-text-muted hover:text-text-dark"
          data-testid="button-logout"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </div>
    </aside>
  );
}