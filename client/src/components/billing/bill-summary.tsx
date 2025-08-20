import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FileText, Save, Loader2 } from "lucide-react";
import type { Service } from "@shared/schema";

interface BillItem {
  serviceId: string;
  service: Service;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface BillTotals {
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
}

interface BillSummaryProps {
  billItems: BillItem[];
  paymentMethod: "cash" | "card" | "upi" | "insurance";
  onPaymentMethodChange: (method: "cash" | "card" | "upi" | "insurance") => void;
  onGenerateBill: () => void;
  isGenerating: boolean;
  recentBills: any[];
  totals: BillTotals;
}

export default function BillSummary({
  billItems,
  paymentMethod,
  onPaymentMethodChange,
  onGenerateBill,
  isGenerating,
  recentBills,
  totals,
}: BillSummaryProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-orange-100 text-orange-800';
      case 'partial':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Bill Summary */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Bill Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3" data-testid="bill-totals">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal:</span>
              <span className="font-medium" data-testid="subtotal">
                {formatCurrency(totals.subtotal)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax (18%):</span>
              <span className="font-medium" data-testid="tax-amount">
                {formatCurrency(totals.taxAmount)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Discount:</span>
              <span className="font-medium text-green-600" data-testid="discount-amount">
                -{formatCurrency(totals.discountAmount)}
              </span>
            </div>
            <hr className="border-border" />
            <div className="flex justify-between">
              <span className="font-semibold">Total Amount:</span>
              <span className="font-bold text-xl text-medical-blue" data-testid="total-amount">
                {formatCurrency(totals.totalAmount)}
              </span>
            </div>
          </div>
          
          {/* Payment Method */}
          <div className="space-y-2">
            <label className="block text-sm font-medium">Payment Method</label>
            <Select value={paymentMethod} onValueChange={onPaymentMethodChange}>
              <SelectTrigger data-testid="payment-method-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="upi">UPI</SelectItem>
                <SelectItem value="insurance">Insurance</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Action Buttons */}
          <div className="space-y-3">
            <Button
              onClick={onGenerateBill}
              className="w-full bg-medical-blue hover:bg-medical-blue/90"
              disabled={isGenerating || billItems.length === 0}
              data-testid="button-generate-bill"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" />
                  Generate Bill
                </>
              )}
            </Button>
            <Button
              variant="outline"
              className="w-full"
              disabled={billItems.length === 0}
              data-testid="button-save-draft"
            >
              <Save className="w-4 h-4 mr-2" />
              Save as Draft
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Bills */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Recent Bills</CardTitle>
        </CardHeader>
        <CardContent>
          {recentBills.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              <p>No recent bills</p>
            </div>
          ) : (
            <div className="space-y-3" data-testid="recent-bills">
              {recentBills.map((billData: any) => {
                const bill = billData.bill || billData;
                const patient = billData.patient;
                
                return (
                  <div
                    key={bill.id}
                    className="flex items-center justify-between p-3 bg-muted rounded-lg"
                    data-testid={`recent-bill-${bill.id}`}
                  >
                    <div>
                      <p className="font-medium text-sm" data-testid={`bill-number-${bill.id}`}>
                        {bill.billNumber}
                      </p>
                      <p className="text-xs text-muted-foreground" data-testid={`bill-patient-${bill.id}`}>
                        {patient?.name || "Unknown Patient"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-sm" data-testid={`bill-amount-${bill.id}`}>
                        {formatCurrency(bill.totalAmount)}
                      </p>
                      <Badge 
                        variant="secondary" 
                        className={getStatusColor(bill.paymentStatus)}
                        data-testid={`bill-status-${bill.id}`}
                      >
                        {bill.paymentStatus}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          <Button
            variant="ghost"
            className="w-full mt-4 text-medical-blue hover:text-medical-blue/90"
            data-testid="button-view-all-bills"
          >
            View All Bills
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
