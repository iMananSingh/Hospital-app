import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import type { Service } from "@shared/schema";

interface ServiceSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectService: (service: Service) => void;
}

export default function ServiceSelector({
  isOpen,
  onClose,
  onSelectService,
}: ServiceSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: services, isLoading } = useQuery({
    queryKey: ["/api/services"],
    enabled: isOpen,
  });

  const { data: searchResults } = useQuery({
    queryKey: ["/api/services/search", { q: searchQuery }],
    enabled: searchQuery.length > 0 && isOpen,
  });

  const displayServices = searchQuery ? searchResults : services;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

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
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl" data-testid="service-selector-modal">
        <DialogHeader>
          <DialogTitle>Add Service</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Input
              type="text"
              placeholder="Search services..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-service-search"
            />
            <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
          </div>
          
          {/* Service List */}
          <div className="space-y-2 max-h-96 overflow-y-auto" data-testid="service-list">
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-medical-blue mx-auto"></div>
                <p className="text-sm text-muted-foreground mt-2">Loading services...</p>
              </div>
            ) : displayServices && displayServices.length > 0 ? (
              displayServices.map((service: Service) => (
                <div
                  key={service.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted cursor-pointer transition-colors"
                  onClick={() => {
                    onSelectService(service);
                    setSearchQuery("");
                  }}
                  data-testid={`service-option-${service.id}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <p className="font-medium">{service.name}</p>
                      <Badge variant="secondary" className={getCategoryColor(service.category)}>
                        {service.category}
                      </Badge>
                    </div>
                    {service.description && (
                      <p className="text-sm text-muted-foreground">{service.description}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="font-medium text-lg" data-testid={`service-price-${service.id}`}>
                      {formatCurrency(service.price)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>No services found</p>
                {searchQuery && (
                  <Button 
                    variant="outline" 
                    onClick={() => setSearchQuery("")}
                    className="mt-2"
                  >
                    Clear search
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
