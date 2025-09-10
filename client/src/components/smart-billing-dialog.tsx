
import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Service {
  id: string;
  name: string;
  price: number;
  category: string;
  billingType?: string;
  billingParameters?: string;
}

interface SmartBillingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  services: Service[];
  isPending?: boolean;
  patientId: string;
  currentDate: string;
  currentTime: string;
}

export default function SmartBillingDialog({
  isOpen,
  onClose,
  onSubmit,
  services,
  isPending = false,
  patientId,
  currentDate,
  currentTime
}: SmartBillingDialogProps) {
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [billingPreview, setBillingPreview] = useState<any>(null);

  const form = useForm({
    defaultValues: {
      serviceId: "",
      quantity: 1,
      hours: 1,
      distance: 0,
      scheduledDate: currentDate,
      scheduledTime: currentTime,
      notes: "",
    },
  });

  const watchedValues = form.watch();

  useEffect(() => {
    if (selectedService && selectedService.billingType) {
      calculateBillingPreview();
    }
  }, [selectedService, watchedValues.quantity, watchedValues.hours, watchedValues.distance]);

  const calculateBillingPreview = () => {
    if (!selectedService) return;

    let totalAmount = 0;
    let breakdown = "";
    let quantity = 1;

    switch (selectedService.billingType) {
      case "per_instance":
        quantity = watchedValues.quantity || 1;
        totalAmount = selectedService.price * quantity;
        breakdown = `₹${selectedService.price} × ${quantity} instance${quantity > 1 ? 's' : ''} = ₹${totalAmount}`;
        break;

      case "per_24_hours":
        quantity = watchedValues.quantity || 1;
        totalAmount = selectedService.price * quantity;
        breakdown = `₹${selectedService.price} × ${quantity} day${quantity > 1 ? 's' : ''} = ₹${totalAmount}`;
        break;

      case "per_hour":
        quantity = watchedValues.hours || 1;
        totalAmount = selectedService.price * quantity;
        breakdown = `₹${selectedService.price} × ${quantity} hour${quantity > 1 ? 's' : ''} = ₹${totalAmount}`;
        break;

      case "composite":
        const params = selectedService.billingParameters ? JSON.parse(selectedService.billingParameters) : {};
        const fixedCharge = params.fixedCharge || selectedService.price;
        const perKmRate = params.perKmRate || 0;
        const distance = watchedValues.distance || 0;
        
        const distanceCharge = perKmRate * distance;
        totalAmount = fixedCharge + distanceCharge;
        breakdown = `Fixed: ₹${fixedCharge}${distance > 0 ? ` + Distance: ₹${perKmRate} × ${distance}km = ₹${distanceCharge}` : ''} = ₹${totalAmount}`;
        quantity = 1;
        break;

      default:
        quantity = watchedValues.quantity || 1;
        totalAmount = selectedService.price * quantity;
        breakdown = `₹${selectedService.price} × ${quantity} = ₹${totalAmount}`;
    }

    setBillingPreview({
      totalAmount,
      quantity,
      breakdown,
      billingType: selectedService.billingType
    });
  };

  const handleServiceChange = (serviceId: string) => {
    const service = services.find(s => s.id === serviceId);
    setSelectedService(service || null);
    form.setValue("serviceId", serviceId);
    
    // Reset quantity fields
    form.setValue("quantity", 1);
    form.setValue("hours", 1);
    form.setValue("distance", 0);
  };

  const handleSubmit = (data: any) => {
    if (!selectedService || !billingPreview) return;

    const serviceData = {
      patientId,
      serviceId: selectedService.id,
      serviceName: selectedService.name,
      serviceType: selectedService.category,
      price: selectedService.price,
      billingType: selectedService.billingType || "per_instance",
      billingQuantity: billingPreview.quantity,
      billingParameters: selectedService.billingType === "composite" ? 
        JSON.stringify({ distance: data.distance }) : null,
      calculatedAmount: billingPreview.totalAmount,
      scheduledDate: data.scheduledDate,
      scheduledTime: data.scheduledTime,
      notes: data.notes,
      status: "scheduled",
    };

    onSubmit(serviceData);
  };

  const getBillingTypeLabel = (type: string) => {
    switch (type) {
      case "per_instance": return "Per Instance";
      case "per_24_hours": return "Per 24 Hours";
      case "per_hour": return "Per Hour";
      case "composite": return "Composite";
      default: return "Per Instance";
    }
  };

  const getBillingTypeColor = (type: string) => {
    switch (type) {
      case "per_instance": return "bg-blue-100 text-blue-800";
      case "per_24_hours": return "bg-green-100 text-green-800";
      case "per_hour": return "bg-orange-100 text-orange-800";
      case "composite": return "bg-purple-100 text-purple-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Service with Smart Billing</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Select Service *</Label>
            <Select onValueChange={handleServiceChange} data-testid="select-service">
              <SelectTrigger>
                <SelectValue placeholder="Choose a service" />
              </SelectTrigger>
              <SelectContent>
                {services.map((service) => (
                  <SelectItem key={service.id} value={service.id}>
                    <div className="flex items-center justify-between w-full">
                      <span>{service.name}</span>
                      <div className="flex items-center gap-2 ml-2">
                        <Badge className={getBillingTypeColor(service.billingType || "per_instance")} variant="secondary">
                          {getBillingTypeLabel(service.billingType || "per_instance")}
                        </Badge>
                        <span className="text-sm">₹{service.price}</span>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedService && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Scheduled Date *</Label>
                  <Input
                    type="date"
                    {...form.register("scheduledDate")}
                    data-testid="input-scheduled-date"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Scheduled Time *</Label>
                  <Input
                    type="time"
                    {...form.register("scheduledTime")}
                    data-testid="input-scheduled-time"
                  />
                </div>
              </div>

              {/* Billing Quantity Fields */}
              {selectedService.billingType === "per_instance" && (
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    min="1"
                    {...form.register("quantity", { valueAsNumber: true })}
                    data-testid="input-quantity"
                  />
                </div>
              )}

              {selectedService.billingType === "per_24_hours" && (
                <div className="space-y-2">
                  <Label>Number of Days</Label>
                  <Input
                    type="number"
                    min="1"
                    {...form.register("quantity", { valueAsNumber: true })}
                    data-testid="input-days"
                  />
                  <p className="text-sm text-gray-500">Room charges are calculated per 24-hour period</p>
                </div>
              )}

              {selectedService.billingType === "per_hour" && (
                <div className="space-y-2">
                  <Label>Number of Hours</Label>
                  <Input
                    type="number"
                    min="1"
                    step="0.5"
                    {...form.register("hours", { valueAsNumber: true })}
                    data-testid="input-hours"
                  />
                </div>
              )}

              {selectedService.billingType === "composite" && (
                <div className="space-y-2">
                  <Label>Distance (km)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.1"
                    {...form.register("distance", { valueAsNumber: true })}
                    data-testid="input-distance"
                  />
                  <p className="text-sm text-gray-500">
                    {(() => {
                      const params = selectedService.billingParameters ? JSON.parse(selectedService.billingParameters) : {};
                      return `Fixed charge: ₹${params.fixedCharge || selectedService.price}, Per km: ₹${params.perKmRate || 0}`;
                    })()}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  {...form.register("notes")}
                  placeholder="Optional notes about the service"
                  data-testid="textarea-notes"
                />
              </div>

              {billingPreview && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Billing Preview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Service:</span>
                        <span>{selectedService.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Billing Type:</span>
                        <Badge className={getBillingTypeColor(billingPreview.billingType)} variant="secondary">
                          {getBillingTypeLabel(billingPreview.billingType)}
                        </Badge>
                      </div>
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>Calculation:</span>
                        <span>{billingPreview.breakdown}</span>
                      </div>
                      <div className="flex justify-between font-semibold text-lg pt-2 border-t">
                        <span>Total Amount:</span>
                        <span>₹{billingPreview.totalAmount}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending || !selectedService || !billingPreview}
            >
              {isPending ? "Adding..." : "Add Service"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
