
import { useAuth } from "@/hooks/use-auth";
import AccessRestricted from "@/components/access-restricted";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";

export default function RevenuePage() {
  const { user } = useAuth();

  // Check if user has access
  const currentUserRoles = user?.roles || [user?.role];
  const hasAccess = currentUserRoles.some(role => ["admin", "billing_staff"].includes(role));

  if (!hasAccess) {
    return <AccessRestricted 
      message="Access Restricted - Only administrators and billing staff can access revenue & payments." 
      allowedRoles={["admin", "billing_staff"]}
    />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2">
        <FileText className="w-6 h-6 text-medical-blue" />
        <h1 className="text-2xl font-bold text-text-dark">Revenue & Payments</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Revenue Management</CardTitle>
          <CardDescription>
            Track and manage hospital revenue and payment records
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-text-muted">
            Revenue and payment management features will be implemented here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
