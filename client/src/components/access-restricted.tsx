
import { Shield } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface AccessRestrictedProps {
  message?: string;
  allowedRoles?: string[];
}

export default function AccessRestricted({ 
  message = "Access Restricted", 
  allowedRoles = ["admin"] 
}: AccessRestrictedProps) {
  const formattedRoles = allowedRoles
    .map(role => role.replace('_', ' '))
    .map(role => role.charAt(0).toUpperCase() + role.slice(1))
    .join(', ');

  const defaultMessage = `Only ${formattedRoles.toLowerCase()} can access this section.`;

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center justify-center p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <Shield className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {message}
          </h2>
          <p className="text-gray-600">
            {defaultMessage}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
