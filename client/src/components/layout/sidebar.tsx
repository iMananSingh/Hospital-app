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
  Activity,
  Heart
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/", icon: BarChart3 },
  { name: "Patient Registration", href: "/patients", icon: Users },
  { name: "Lab Tests", href: "/lab-tests", icon: Activity },
  { name: "Diagnostics", href: "/diagnostics", icon: Heart },
  { name: "Doctor Management", href: "/doctors", icon: UserPlus },
  { name: "Service Management", href: "/services", icon: Building2 },
  { name: "Billing & Invoicing", href: "/billing", icon: FileText },
  { name: "System Settings", href: "/settings", icon: Settings },
];

export default function Sidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

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
        <div className="flex items-center space-x-3 mb-3">
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
        </div>
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