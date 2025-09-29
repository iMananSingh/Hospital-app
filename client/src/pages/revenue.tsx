import { useAuth } from "@/hooks/use-auth";
import AccessRestricted from "@/components/access-restricted";
import Billing from "./billing";

export default function RevenuePage() {
  const { user } = useAuth();

  // Check if user has access - restrict receptionist role
  const currentUserRoles = user?.roles || [user?.role];
  const hasAccess = currentUserRoles.some(role => ["admin", "billing_staff", "super_user"].includes(role));

  if (!hasAccess) {
    return <AccessRestricted
      title="Access Restricted"
      description="Only administrators, billing staff, and super users can access revenue & payments."
    />;
  }

  // If user has access, show the billing component which contains the full revenue functionality
  return <Billing />;
}