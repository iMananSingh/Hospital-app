
import { useAuth } from "@/hooks/use-auth";
import AccessRestricted from "@/components/access-restricted";
import TopBar from "@/components/layout/topbar";
import Billing from "./billing";

export default function RevenuePage() {
  const { user } = useAuth();

  // Check if user has access - restrict receptionist role
  const currentUserRoles = user?.roles || (user?.role ? [user.role] : []);
  const hasAccess = currentUserRoles.some(role => ["admin", "billing_staff", "super_user"].includes(role));

  if (!hasAccess) {
    return (
      <div className="flex flex-col h-screen">
        <TopBar
          title="Revenue and Payments"
          searchPlaceholder="Search revenue data..."
          showNotifications={true}
          notificationCount={3}
        />
        <div className="flex-1 px-6 pb-6 pt-4">
          <AccessRestricted
            title="Access Restricted"
            description="Only administrators, billing staff, and super users can access revenue & payments."
          />
        </div>
      </div>
    );
  }

  // If user has access, show the billing component which contains the full revenue functionality
  return <Billing />;
}
