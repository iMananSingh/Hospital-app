import { Shield } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface AccessRestrictedProps {
  title?: string;
  description?: string;
}

export default function AccessRestricted({ 
  title = "Access Restricted", 
  description = "You don't have permission to access this feature." 
}: AccessRestrictedProps) {
  return (
    <Card>
      <CardContent className="p-8 text-center">
        <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}