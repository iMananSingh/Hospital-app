import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Trash2 } from "lucide-react";
import type { Patient, Service } from "@shared/schema";

interface BillItem {
  serviceId: string;
  service: Service;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface PatientSearchProps {
  selectedPatient: Patient | null;
  onPatientSelect: (patient: Patient) => void;
  billItems: BillItem[];
  onAddService: () => void;
  onRemoveService: (serviceId: string) => void;
  onUpdateQuantity: (serviceId: string, quantity: number) => void;
}

export default function PatientSearch({
  selectedPatient,
  onPatientSelect,
  billItems,
  onAddService,
  onRemoveService,
  onUpdateQuantity,
}: PatientSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: searchResults } = useQuery({
    queryKey: ["/api/patients/search", { q: searchQuery }],
    enabled: searchQuery.length > 0,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Create New Bill</CardTitle>
        <p className="text-sm text-muted-foreground">Select patient and add services to generate bill</p>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Patient Search */}
        <div>
          <label className="block text-sm font-medium mb-2">Search Patient</label>
          <div className="relative">
            <Input
              type="text"
              placeholder="Search by name, ID, or phone..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-patient-search"
            />
            <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
          </div>
          
          {/* Search Results */}
          {searchResults && searchResults.length > 0 && (
            <div className="mt-3 space-y-2 max-h-40 overflow-y-auto" data-testid="patient-search-results">
              {searchResults.map((patient: Patient) => (
                <div
                  key={patient.id}
                  className="p-3 border rounded-lg hover:bg-muted cursor-pointer transition-colors"
                  onClick={() => {
                    onPatientSelect(patient);
                    setSearchQuery("");
                  }}
                  data-testid={`patient-result-${patient.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{patient.name}</p>
                      <p className="text-sm text-muted-foreground">
                        ID: {patient.patientId} | Phone: {patient.phone}
                      </p>
                    </div>
                    <Badge variant="secondary">
                      {patient.gender} | {patient.age}y
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected Patient Info */}
        {selectedPatient && (
          <div className="bg-muted p-4 rounded-lg" data-testid="selected-patient-info">
            <h4 className="font-medium mb-2">Selected Patient</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Name:</span>
                <span className="ml-2 font-medium" data-testid="patient-name">{selectedPatient.name}</span>
              </div>
              <div>
                <span className="text-muted-foreground">ID:</span>
                <span className="ml-2 font-medium" data-testid="patient-id">{selectedPatient.patientId}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Age:</span>
                <span className="ml-2 font-medium" data-testid="patient-age">{selectedPatient.age} years</span>
              </div>
              <div>
                <span className="text-muted-foreground">Phone:</span>
                <span className="ml-2 font-medium" data-testid="patient-phone">{selectedPatient.phone}</span>
              </div>
            </div>
          </div>
        )}

        {/* Services & Charges */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium">Services & Charges</h4>
            <Button
              variant="outline"
              size="sm"
              onClick={onAddService}
              data-testid="button-add-service"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Service
            </Button>
          </div>
          
          {billItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No services added yet</p>
              <Button variant="outline" onClick={onAddService} className="mt-2">
                Add your first service
              </Button>
            </div>
          ) : (
            <div className="space-y-3" data-testid="bill-items">
              {billItems.map((item) => (
                <div
                  key={item.serviceId}
                  className="flex items-center justify-between p-3 border rounded-lg"
                  data-testid={`bill-item-${item.serviceId}`}
                >
                  <div className="flex-1">
                    <p className="font-medium">{item.service.name}</p>
                    <p className="text-sm text-muted-foreground">{item.service.category}</p>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onUpdateQuantity(item.serviceId, item.quantity - 1)}
                        data-testid={`quantity-decrease-${item.serviceId}`}
                      >
                        -
                      </Button>
                      <span className="w-8 text-center" data-testid={`quantity-${item.serviceId}`}>
                        {item.quantity}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onUpdateQuantity(item.serviceId, item.quantity + 1)}
                        data-testid={`quantity-increase-${item.serviceId}`}
                      >
                        +
                      </Button>
                    </div>
                    <span className="font-medium min-w-20 text-right" data-testid={`total-price-${item.serviceId}`}>
                      {formatCurrency(item.totalPrice)}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemoveService(item.serviceId)}
                      className="text-destructive hover:text-destructive"
                      data-testid={`remove-service-${item.serviceId}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
