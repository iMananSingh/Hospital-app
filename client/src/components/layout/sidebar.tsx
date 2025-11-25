import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Users,
  TestTube,
  UserPlus,
  BarChart3,
  Settings,
  LogOut,
  Building2,
  UserCog,
} from "lucide-react";
import hmSyncLogo from "@assets/upload_1764060155393.png";
import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Profile edit form schema
const profileEditSchema = z
  .object({
    username: z.string().min(1, "Username is required").trim(),
    fullName: z.string().min(1, "Full name is required").trim(),
    profilePicture: z.string().optional(),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .optional()
      .or(z.literal("")),
    confirmPassword: z.string().optional(),
  })
  .refine(
    (data) => {
      if (
        data.password &&
        data.password !== "" &&
        data.password !== data.confirmPassword
      ) {
        return false;
      }
      return true;
    },
    {
      message: "Passwords don't match",
      path: ["confirmPassword"],
    },
  );

interface ProfileEditFormProps {
  user: any;
  onSuccess: () => void;
  isOpen: boolean;
}

function ProfileEditForm({ user, onSuccess, isOpen }: ProfileEditFormProps) {
  const { toast } = useToast();
  const { updateUser } = useAuth();
  const queryClient = useQueryClient();
  const [previewImage, setPreviewImage] = useState<string | null>(
    user?.profilePicture || null,
  );
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm({
    resolver: zodResolver(profileEditSchema),
    defaultValues: {
      username: user?.username || "",
      fullName: user?.fullName || "",
      profilePicture: user?.profilePicture || "",
      password: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    form.reset({
      username: user?.username || "",
      fullName: user?.fullName || "",
      profilePicture: user?.profilePicture || "",
      password: "",
      confirmPassword: "",
    });
    setPreviewImage(user?.profilePicture || null);
  }, [user]);

  useEffect(() => {
    if (isOpen) {
      form.reset({
        username: user?.username || "",
        fullName: user?.fullName || "",
        profilePicture: user?.profilePicture || "",
        password: "",
        confirmPassword: "",
      });
      setPreviewImage(user?.profilePicture || null);
    }
  }, [isOpen, user]);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Image too large (2MB max).",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setPreviewImage(base64String);
      form.setValue("profilePicture", base64String);
      setIsImageDialogOpen(false);
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteImage = () => {
    setPreviewImage(null);
    form.setValue("profilePicture", "");
    setIsImageDialogOpen(false);
  };

  const updateProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      const updateData: any = {
        username: data.username,
        fullName: data.fullName,
      };

      if (data.profilePicture !== undefined) {
        updateData.profilePicture = data.profilePicture;
      }

      // Only include password if it's provided
      if (data.password && data.password.trim() !== "") {
        updateData.password = data.password;
      }

      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("hospital_token")}`,
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update profile");
      }

      return response.json();
    },
    onSuccess: (updatedUser) => {
      toast({
        title: "Profile updated",
        description: "Profile updated successfully.",
      });
      // Update the user data in cache and invalidate to trigger refetch
      queryClient.setQueryData(["/api/users/me"], updatedUser);
      queryClient.invalidateQueries({ queryKey: ["/api/users/me"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/dashboard/recent-activities"],
      });
      // Update auth context user state immediately
      updateUser(updatedUser);
      onSuccess();
      form.reset({
        username: updatedUser.username,
        fullName: updatedUser.fullName,
        profilePicture: updatedUser.profilePicture || "",
        password: "",
        confirmPassword: "",
      });
      setPreviewImage(updatedUser.profilePicture || null);
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

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="flex flex-col items-center space-y-3">
          <div
            className="relative group cursor-pointer"
            onClick={() => setIsImageDialogOpen(true)}
          >
            <div className="w-24 h-24 rounded-full overflow-hidden bg-healthcare-green flex items-center justify-center">
              {previewImage ? (
                <img
                  src={previewImage}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-white font-medium text-2xl">
                  {user ? getInitials(user.fullName) : "U"}
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
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
          </div>
          <Input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="hidden"
            data-testid="input-profile-picture"
          />
        </div>

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
                  autoComplete="new-password"
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
                  autoComplete="new-password"
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

        {/* Image Management Dialog */}
        <Dialog open={isImageDialogOpen} onOpenChange={setIsImageDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Profile Picture</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center space-y-4 py-4">
              <div className="w-32 h-32 rounded-full overflow-hidden bg-healthcare-green flex items-center justify-center">
                {previewImage ? (
                  <img
                    src={previewImage}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-white font-medium text-3xl">
                    {user ? getInitials(user.fullName) : "U"}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                {previewImage ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      data-testid="button-update-picture"
                    >
                      Update
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={handleDeleteImage}
                      data-testid="button-delete-picture"
                    >
                      Delete
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="button-upload-picture"
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
      </form>
    </Form>
  );
}

const baseNavigation = [
  {
    name: "Dashboard",
    href: "/",
    icon: BarChart3,
    roles: ["admin", "doctor", "receptionist", "billing_staff", "super_user"],
  },
  {
    name: "Patient Registration",
    href: "/patients",
    icon: Users,
    roles: ["admin", "doctor", "receptionist", "billing_staff", "super_user"],
  },
  {
    name: "Pathology Tests",
    href: "/pathology",
    icon: TestTube,
    roles: ["admin", "doctor", "receptionist", "billing_staff", "super_user"],
  },
  {
    name: "Doctor Management",
    href: "/doctors",
    icon: UserPlus,
    roles: ["admin", "super_user"],
  },
  {
    name: "Service Management",
    href: "/services",
    icon: Building2,
    roles: ["admin", "super_user"],
  },
  {
    name: "Revenue & Payments",
    href: "/revenue",
    icon: FileText,
    roles: ["admin", "billing_staff", "super_user"],
  },
  {
    name: "System Settings",
    href: "/settings",
    icon: Settings,
    roles: ["admin", "super_user"],
  },
];

export default function Sidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  const isActive = (href: string) => {
    return location === href || (href !== "/" && location.startsWith(href));
  };

  // Show all navigation items regardless of role
  const navigation = baseNavigation;
  const userRoles = user?.roles || [];

  const NavItem = ({
    to,
    icon: Icon,
    label,
  }: {
    to: string;
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    label: string;
  }) => {
    return (
      <Link
        key={label}
        href={to}
        className={cn(
          "flex items-center space-x-3 px-3 py-3 rounded-lg font-medium transition-colors",
          isActive(to)
            ? "bg-medical-blue text-white"
            : "text-text-muted hover:bg-muted hover:text-text-dark",
        )}
        data-testid={`nav-${to === "/" ? "dashboard" : to.substring(1)}`}
      >
        <Icon className="w-5 h-5" />
        <span>{label}</span>
      </Link>
    );
  };

  return (
    <aside className="w-64 bg-surface border-r border-border flex flex-col shadow-sm">
      {/* Logo and Hospital Name */}
      <div className="px-6 border-b border-border h-[84px] flex items-center">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 flex items-center justify-center">
            <img src={hmSyncLogo} alt="HMSync Logo" className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-text-dark">HMSync</h1>
            <p className="text-sm text-text-muted">Hospital Management</p>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 p-4 space-y-2">
        {navigation.map((item) => (
          <NavItem
            key={item.name}
            to={item.href}
            icon={item.icon}
            label={item.name}
          />
        ))}
      </nav>

      {/* User Profile Section */}
      <div className="p-4 border-t border-border">
        <Dialog
          open={isProfileDialogOpen}
          onOpenChange={setIsProfileDialogOpen}
        >
          <DialogTrigger asChild>
            <div
              className="flex items-center space-x-3 mb-3 cursor-pointer hover:bg-muted rounded-lg p-2 transition-colors"
              data-testid="profile-trigger"
            >
              <div className="w-10 h-10 bg-healthcare-green rounded-full flex items-center justify-center overflow-hidden">
                {user?.profilePicture ? (
                  <img
                    src={user.profilePicture}
                    alt={user.fullName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span
                    className="text-white font-medium text-sm"
                    data-testid="user-initials"
                  >
                    {user ? getInitials(user.fullName) : "U"}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-medium text-text-dark truncate"
                  data-testid="user-name"
                >
                  {user?.fullName || "User"}
                </p>
                <p
                  className="text-xs text-text-muted capitalize"
                  data-testid="user-role"
                >
                  {user?.role?.replace("_", " ") || "Role"}
                </p>
              </div>
              <UserCog className="w-4 h-4 text-text-muted" />
            </div>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Profile</DialogTitle>
            </DialogHeader>
            <ProfileEditForm
              user={user}
              onSuccess={() => setIsProfileDialogOpen(false)}
              isOpen={isProfileDialogOpen}
            />
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
