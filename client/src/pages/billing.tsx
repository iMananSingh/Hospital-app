import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import TopBar from "@/components/layout/topbar";
import StatsCards from "@/components/stats-cards";
import PatientSearch from "@/components/billing/patient-search";
import ServiceSelector from "@/components/billing/service-selector";
import BillSummary from "@/components/billing/bill-summary";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Patient, Service } from "@shared/schema";

interface BillItem {
  serviceId: string;
  service: Service;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export default function Billing() {
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [billItems, setBillItems] = useState<BillItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "upi" | "insurance">("cash");
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const { toast } = useToast();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: recentBills } = useQuery({
    queryKey: ["/api/bills"],
  });

  const createBillMutation = useMutation({
    mutationFn: async (billData: any) => {
      const response = await fetch("/api/bills", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("hospital_token")}`,
        },
        body: JSON.stringify(billData),
      });
      
      if (!response.ok) {
        throw new Error("Failed to create bill");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bills"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      
      // Reset form
      setSelectedPatient(null);
      setBillItems([]);
      setPaymentMethod("cash");
      
      toast({
        title: "Bill created successfully",
        description: "The bill has been generated and saved.",
      });
    },
    onError: () => {
      toast({
        title: "Error creating bill",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const addService = (service: Service) => {
    const existingItem = billItems.find(item => item.serviceId === service.id);
    
    if (existingItem) {
      setBillItems(items =>
        items.map(item =>
          item.serviceId === service.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                totalPrice: (item.quantity + 1) * item.unitPrice,
              }
            : item
        )
      );
    } else {
      const newItem: BillItem = {
        serviceId: service.id,
        service,
        quantity: 1,
        unitPrice: service.price,
        totalPrice: service.price,
      };
      setBillItems(items => [...items, newItem]);
    }
    
    setIsServiceModalOpen(false);
  };

  const removeService = (serviceId: string) => {
    setBillItems(items => items.filter(item => item.serviceId !== serviceId));
  };

  const updateQuantity = (serviceId: string, quantity: number) => {
    if (quantity <= 0) {
      removeService(serviceId);
      return;
    }
    
    setBillItems(items =>
      items.map(item =>
        item.serviceId === serviceId
          ? {
              ...item,
              quantity,
              totalPrice: quantity * item.unitPrice,
            }
          : item
      )
    );
  };

  const calculateBillTotals = () => {
    const subtotal = billItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const taxAmount = subtotal * 0.18; // 18% tax
    const discountAmount = 0; // Can be made dynamic
    const totalAmount = subtotal + taxAmount - discountAmount;
    
    return { subtotal, taxAmount, discountAmount, totalAmount };
  };

  const handleGenerateBill = () => {
    if (!selectedPatient || billItems.length === 0) {
      toast({
        title: "Incomplete bill",
        description: "Please select a patient and add services.",
        variant: "destructive",
      });
      return;
    }

    const { subtotal, taxAmount, discountAmount, totalAmount } = calculateBillTotals();
    
    const billData = {
      bill: {
        patientId: selectedPatient.id,
        subtotal,
        taxAmount,
        discountAmount,
        totalAmount,
        paymentMethod,
        paymentStatus: "paid",
        paidAmount: totalAmount,
      },
      items: billItems.map(item => ({
        serviceId: item.serviceId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
      })),
    };

    createBillMutation.mutate(billData);
  };

  return (
    <div className="space-y-6">
      <TopBar 
        title="Billing & Invoicing"
        searchPlaceholder="Search patients, bills..."
        onNewAction={() => setIsServiceModalOpen(true)}
        newActionLabel="New Bill"
        showNotifications={true}
        notificationCount={3}
      />
      
      <div className="p-6 space-y-6">
        {!statsLoading && stats && <StatsCards stats={stats} />}
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Patient Selection & Bill Creation */}
          <div className="lg:col-span-2">
            <PatientSearch
              selectedPatient={selectedPatient}
              onPatientSelect={setSelectedPatient}
              billItems={billItems}
              onAddService={() => setIsServiceModalOpen(true)}
              onRemoveService={removeService}
              onUpdateQuantity={updateQuantity}
            />
          </div>

          {/* Bill Summary and Actions */}
          <div>
            <BillSummary
              billItems={billItems}
              paymentMethod={paymentMethod}
              onPaymentMethodChange={setPaymentMethod}
              onGenerateBill={handleGenerateBill}
              isGenerating={createBillMutation.isPending}
              recentBills={recentBills?.slice(0, 5) || []}
              totals={calculateBillTotals()}
            />
          </div>
        </div>
      </div>

      {/* Service Selection Modal */}
      <ServiceSelector
        isOpen={isServiceModalOpen}
        onClose={() => setIsServiceModalOpen(false)}
        onSelectService={addService}
      />
    </div>
  );
}
