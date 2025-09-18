import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, Plus, Trash2, Printer, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import type { Patient } from '@shared/schema';

interface BillItem {
  id: string;
  date: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

interface FakeBillDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FakeBillDialog({ isOpen, onClose }: FakeBillDialogProps) {
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPatientSearch, setShowPatientSearch] = useState(false);
  const [billItems, setBillItems] = useState<BillItem[]>([]);
  const [paid, setPaid] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);

  // Fetch patients for search
  const { data: patients = [] } = useQuery<Patient[]>({
    queryKey: ["/api/patients"],
    enabled: isOpen,
  });

  // Fetch hospital settings for bill generation
  const { data: hospitalSettings, isLoading: isHospitalSettingsLoading } = useQuery({
    queryKey: ["/api/settings/hospital"],
    queryFn: async () => {
      const response = await fetch("/api/settings/hospital", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("hospital_token")}`,
        },
      });
      if (!response.ok) {
        throw new Error("Failed to fetch hospital settings");
      }
      return response.json();
    },
    enabled: isOpen,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Use hospital settings or fallback to defaults
  const hospitalInfo = hospitalSettings ? {
    name: hospitalSettings.name || "MedCare Pro Hospital",
    address: hospitalSettings.address || "123 Healthcare Street, Medical District, City - 123456",
    phone: hospitalSettings.phone || "+91 98765 43210",
    email: hospitalSettings.email || "info@medcarepro.com",
    registrationNumber: hospitalSettings.registrationNumber || "REG123456",
    logoPath: hospitalSettings.logoPath || null
  } : {
    name: "MedCare Pro Hospital",
    address: "123 Healthcare Street, Medical District, City - 123456",
    phone: "+91 98765 43210",
    email: "info@medcarepro.com",
    registrationNumber: "REG123456",
    logoPath: null
  };

  // Filter patients based on search query
  const filteredPatients = patients.filter(patient =>
    patient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    patient.patientId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    patient.phone.includes(searchQuery)
  );

  // Calculate totals
  const totalCharges = billItems.reduce((sum, item) => sum + item.amount, 0);
  const balance = totalCharges - paid - discount;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const generateReceiptNumber = () => {
    const today = new Date();
    const yymmdd = today.toISOString().slice(2, 10).replace(/-/g, '').slice(0, 6);
    const timestamp = Date.now().toString().slice(-4);
    return `${yymmdd}-FAKE-${timestamp}`;
  };

  const addBillItem = () => {
    const newItem: BillItem = {
      id: Date.now().toString(),
      date: new Date().toISOString().split('T')[0],
      description: '',
      quantity: 1,
      rate: 0,
      amount: 0
    };
    setBillItems([...billItems, newItem]);
  };

  const updateBillItem = (id: string, field: keyof BillItem, value: string | number) => {
    // Add basic validation for numeric fields
    if (field === 'quantity' && typeof value === 'number') {
      value = Math.max(1, value);
    }
    if (field === 'rate' && typeof value === 'number') {
      value = Math.max(0, value);
    }
    if (field === 'amount' && typeof value === 'number') {
      value = Math.max(0, value);
    }

    setBillItems(items =>
      items.map(item => {
        if (item.id === id) {
          const updatedItem = { ...item, [field]: value };
          // Auto-calculate amount when rate or quantity changes
          if (field === 'rate' || field === 'quantity') {
            const rate = field === 'rate' ? value as number : item.rate;
            const quantity = field === 'quantity' ? value as number : item.quantity;
            updatedItem.amount = rate * quantity;
          }
          return updatedItem;
        }
        return item;
      })
    );
  };

  const removeBillItem = (id: string) => {
    setBillItems(items => items.filter(item => item.id !== id));
  };

  const selectPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    setShowPatientSearch(false);
    setSearchQuery('');
  };

  const handleClose = () => {
    // Reset all data when closing
    setSelectedPatient(null);
    setSearchQuery('');
    setShowPatientSearch(false);
    setBillItems([]);
    setPaid(0);
    setDiscount(0);
    onClose();
  };

  const handlePrint = () => {
    if (!selectedPatient) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const receiptNumber = generateReceiptNumber();

    const escapeHtml = (text: string) => {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    };

    const billHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Comprehensive Financial Statement</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }

            body {
              font-family: Arial, sans-serif;
              line-height: 1.4;
              color: #333;
              background: white;
              font-size: 14px;
            }

            @media print {
              @page {
                margin: 0;
                size: A4;
                @top-center {
                  content: element(page-header);
                }
                @bottom-center {
                  content: element(page-footer);
                }
              }

              body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
            }

            .bill {
              max-width: 800px;
              margin: 0 auto;
              padding: 20px;
              display: flex;
              flex-direction: column;
            }

            @media print {
              .bill {
                margin: 80px 20px 60px 20px !important;
                padding: 0 !important;
                max-width: none !important;
              }

              .header {
                display: none !important;
              }

              .footer {
                display: none !important;
              }

              .page-header {
                display: flex !important;
              }

              .page-footer {
                display: block !important;
              }

              .bill-table {
                page-break-inside: auto;
              }

              .bill-table tr {
                page-break-inside: avoid;
                page-break-after: auto;
              }
            }

            /* Page Header for printing */
            .page-header {
              display: none;
            }

            /* Page Footer for printing */
            .page-footer {
              display: none;
            }

            .header {
              display: flex;
              align-items: center;
              justify-content: center;
              margin-bottom: 20px;
              padding-bottom: 15px;
              border-bottom: 2px solid #333;
            }

            .hospital-info {
              display: flex;
              align-items: center;
              gap: 15px;
            }

            .hospital-logo {
              width: 60px;
              height: 60px;
              object-fit: contain;
            }

            .hospital-name {
              font-size: 24px;
              font-weight: bold;
              color: #333;
            }

            .bill-title {
              text-align: center;
              font-size: 20px;
              font-weight: bold;
              margin: 10px 0;
              text-transform: uppercase;
              letter-spacing: 1px;
              color: #2563eb;
            }

            .patient-info-box {
              border: 2px solid #333;
              padding: 15px;
              margin: 8px 0;
              background: #f9f9f9;
            }

            .patient-details {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
              gap: 10px;
              margin-bottom: 10px;
            }

            .patient-detail {
              font-weight: bold;
            }

            .bill-meta {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-top: 10px;
              font-size: 12px;
            }

            .bill-table {
              width: 100%;
              border-collapse: collapse;
              margin: 15px 0;
            }

            .bill-table th,
            .bill-table td {
              border: 1px solid #333;
              padding: 8px;
              text-align: left;
            }

            .bill-table th {
              background: #f0f0f0;
              font-weight: bold;
            }

            .amount-cell {
              text-align: right !important;
            }

            .positive-amount {
              color: #dc2626;
            }

            .negative-amount {
              color: #059669;
              font-weight: bold;
            }

            .section-title {
              font-size: 16px;
              font-weight: bold;
              margin: 15px 0 10px 0;
              padding: 5px 10px;
              background: #f3f4f6;
              border-left: 4px solid #2563eb;
            }

            .signature-section {
              margin: 35px 0;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }

            .signature-box {
              text-align: center;
              min-width: 200px;
            }

            .signature-line {
              border-bottom: 1px solid #333;
              margin-bottom: 5px;
              height: 40px;
            }

            .footer {
              margin-top: 8px;
              padding-top: 8px;
              border-top: 2px solid #333;
              text-align: center;
              font-size: 12px;
              line-height: 1.5;
            }

            .bill-id {
              margin-top: 15px;
              font-family: monospace;
              font-size: 10px;
              color: #666;
            }

          </style>
        </head>
        <body>
          <!-- Page Header for printing -->
          <div class="page-header">
            <div class="hospital-info">
              ${hospitalInfo.logoPath ? `
                <img src="${hospitalInfo.logoPath}" alt="Hospital Logo" class="hospital-logo">
              ` : ''}
              <div class="hospital-name">${escapeHtml(hospitalInfo.name)}</div>
            </div>
          </div>

          <!-- Page Footer for printing -->
          <div class="page-footer">
            <div class="footer-line">Address: ${escapeHtml(hospitalInfo.address)}</div>
            <div class="footer-line">Phone: ${escapeHtml(hospitalInfo.phone)} | Email: ${escapeHtml(hospitalInfo.email)}${hospitalInfo.registrationNumber ? ` | Reg. No.: ${escapeHtml(hospitalInfo.registrationNumber)}` : ''}</div>
          </div>

          <div class="bill">
            <!-- Header -->
            <div class="header">
              <div class="hospital-info">
                ${hospitalInfo.logoPath ? `
                  <img src="${hospitalInfo.logoPath}" alt="Hospital Logo" class="hospital-logo">
                ` : ''}
                <div class="hospital-name">${escapeHtml(hospitalInfo.name)}</div>
              </div>
            </div>

            <div class="bill-title">Comprehensive Financial Statement</div>

            <div class="patient-info-box">
              <div class="patient-details">
                <div class="patient-detail">Name: ${escapeHtml(selectedPatient.name)}</div>
                <div class="patient-detail">Patient ID: ${escapeHtml(selectedPatient.patientId)}</div>
                <div class="patient-detail">Age: ${selectedPatient.age}</div>
                <div class="patient-detail">Gender: ${escapeHtml(selectedPatient.gender)}</div>
                <div class="patient-detail">Phone: ${escapeHtml(selectedPatient.phone)}</div>
                ${selectedPatient.address ? `<div class="patient-detail">Address: ${escapeHtml(selectedPatient.address)}</div>` : ''}
              </div>
              <div class="bill-meta">
                <span>Receipt Number: <strong>${receiptNumber}</strong></span>
                <span>Generated: <strong>${new Date().toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric'
                })}</strong></span>
              </div>
            </div>

            <div class="section-title">Service & Treatment Details</div>

            <table class="bill-table">
              <thead>
                <tr>
                  <th style="width: 5%;">#</th>
                  <th style="width: 12%;">Date</th>
                  <th style="width: 43%;">Description</th>
                  <th style="width: 8%;">Qty</th>
                  <th style="width: 12%; text-align: right;">Rate (₹)</th>
                  <th style="width: 15%; text-align: right;">Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                ${billItems.map((item, index) => `
                  <tr>
                    <td>${index + 1}</td>
                    <td>${formatDate(item.date)}</td>
                    <td>${escapeHtml(item.description)}</td>
                    <td style="text-align: center;">${item.quantity}</td>
                    <td class="amount-cell" style="text-align: right;">
                      ₹${item.rate.toLocaleString()}
                    </td>
                    <td class="amount-cell positive-amount">
                      ₹${item.amount.toLocaleString()}
                    </td>
                  </tr>
                `).join('')}

                <tr style="border-top: 2px solid #333;">
                  <td colspan="5" style="text-align: right; font-weight: bold; padding-top: 15px;">TOTAL CHARGES:</td>
                  <td class="amount-cell" style="font-weight: bold; font-size: 16px; padding-top: 15px;">₹${totalCharges.toLocaleString()}</td>
                </tr>
                <tr>
                  <td colspan="5" style="text-align: right; font-weight: bold;">PAID:</td>
                  <td class="amount-cell negative-amount" style="font-weight: bold;">-₹${paid.toLocaleString()}</td>
                </tr>
                <tr>
                  <td colspan="5" style="text-align: right; font-weight: bold;">DISCOUNT:</td>
                  <td class="amount-cell negative-amount" style="font-weight: bold;">-₹${discount.toLocaleString()}</td>
                </tr>
                <tr style="border-top: 2px solid #2563eb; background: #f0f9ff;">
                  <td colspan="5" style="text-align: right; font-weight: bold; font-size: 18px; color: #2563eb; padding: 10px;">BALANCE:</td>
                  <td class="amount-cell ${balance >= 0 ? 'positive-amount' : 'negative-amount'}" style="font-weight: bold; font-size: 18px; padding: 10px;">
                    ₹${balance.toLocaleString()}
                  </td>
                </tr>
              </tbody>
            </table>

            <div class="signature-section">
              <div class="signature-box">
                <div class="signature-line"></div>
                <div style="font-weight: bold; font-size: 12px;">Patient/Guardian Signature</div>
              </div>
              <div class="signature-box">
                <div class="signature-line"></div>
                <div style="font-weight: bold; font-size: 12px;">Authorized Signatory</div>
              </div>
            </div>

            <!-- Footer -->
            <div class="footer">
              <div class="footer-line">Address: ${escapeHtml(hospitalInfo.address)}</div>
              <div class="footer-line">Phone: ${escapeHtml(hospitalInfo.phone)} | Email: ${escapeHtml(hospitalInfo.email)}${hospitalInfo.registrationNumber ? ` | Reg. No.: ${escapeHtml(hospitalInfo.registrationNumber)}` : ''}</div>
              <div class="bill-id">
                Bill ID: ${receiptNumber} | Generated on ${new Date().toLocaleString()}
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(billHtml);
    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  // Reset data when dialog opens
  useEffect(() => {
    if (isOpen) {
      setSelectedPatient(null);
      setSearchQuery('');
      setShowPatientSearch(false);
      setBillItems([]);
      setPaid(0);
      setDiscount(0);
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Fake Bill</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Patient Search Section */}
          <div className="border-2 border-border p-4 rounded-lg">
            <div className="flex items-center gap-4 mb-4">
              <Label className="text-sm font-medium">Patient:</Label>
              {selectedPatient ? (
                <div className="flex items-center gap-2">
                  <span className="font-medium">{selectedPatient.name}</span>
                  <span className="text-sm text-muted-foreground">({selectedPatient.patientId})</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPatientSearch(true)}
                    data-testid="button-change-patient"
                  >
                    Change Patient
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => setShowPatientSearch(true)}
                  className="flex items-center gap-2"
                  data-testid="button-select-patient"
                >
                  <Search className="h-4 w-4" />
                  Select Patient
                </Button>
              )}
            </div>

            {/* Patient Search */}
            {showPatientSearch && (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search by name, patient ID, or phone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    data-testid="input-patient-search"
                  />
                </div>
                <div className="max-h-40 overflow-y-auto border rounded-md">
                  {filteredPatients.map((patient) => (
                    <div
                      key={patient.id}
                      className="p-3 hover:bg-muted cursor-pointer border-b last:border-b-0"
                      onClick={() => selectPatient(patient)}
                      data-testid={`patient-option-${patient.id}`}
                    >
                      <div className="font-medium">{patient.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {patient.patientId} • {patient.phone} • Age: {patient.age}
                      </div>
                    </div>
                  ))}
                  {searchQuery && filteredPatients.length === 0 && (
                    <div className="p-3 text-center text-muted-foreground">
                      No patients found matching your search.
                    </div>
                  )}
                  {patients.length === 0 && !searchQuery && (
                    <div className="p-3 text-center text-muted-foreground">
                      No patients available. Please register patients first.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Bill Items Section */}
          {selectedPatient && (
            <>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-lg font-semibold">Service & Treatment Details</Label>
                  <Button
                    onClick={addBillItem}
                    className="flex items-center gap-2"
                    data-testid="button-add-bill-item"
                  >
                    <Plus className="h-4 w-4" />
                    Add Item
                  </Button>
                </div>

                {/* Bill Items Table */}
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="p-3 text-left w-20">Date</th>
                        <th className="p-3 text-left">Description</th>
                        <th className="p-3 text-left w-24">Qty</th>
                        <th className="p-3 text-left w-24">Rate (₹)</th>
                        <th className="p-3 text-left w-28">Amount (₹)</th>
                        <th className="p-3 text-center w-16">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {billItems.map((item, index) => (
                        <tr key={item.id} className="border-t">
                          <td className="p-3">
                            <Input
                              type="date"
                              value={item.date}
                              onChange={(e) => updateBillItem(item.id, 'date', e.target.value)}
                              className="w-full"
                              data-testid={`input-date-${index}`}
                            />
                          </td>
                          <td className="p-3">
                            <Input
                              placeholder="Enter description"
                              value={item.description}
                              onChange={(e) => updateBillItem(item.id, 'description', e.target.value)}
                              className="w-full"
                              data-testid={`input-description-${index}`}
                            />
                          </td>
                          <td className="p-3">
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateBillItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                              className="w-full"
                              data-testid={`input-quantity-${index}`}
                            />
                          </td>
                          <td className="p-3">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.rate}
                              onChange={(e) => updateBillItem(item.id, 'rate', parseFloat(e.target.value) || 0)}
                              className="w-full"
                              data-testid={`input-rate-${index}`}
                            />
                          </td>
                          <td className="p-3">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.amount}
                              readOnly
                              className="w-full bg-gray-50"
                              data-testid={`input-amount-${index}`}
                            />
                          </td>
                          <td className="p-3 text-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeBillItem(item.id)}
                              className="text-destructive hover:text-destructive"
                              data-testid={`button-remove-${index}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {billItems.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-muted-foreground">
                            No items added. Click "Add Item" to start building the bill.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Summary Section */}
              <div className="border-2 border-border p-4 rounded-lg bg-muted/30">
                <Label className="text-lg font-semibold mb-4 block">Bill Summary</Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="total-charges" className="text-sm font-medium">Total Charges:</Label>
                    <div className="text-2xl font-bold text-primary" data-testid="total-charges">
                      {formatCurrency(totalCharges)}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="paid" className="text-sm font-medium">Paid:</Label>
                    <Input
                      id="paid"
                      type="number"
                      min="0"
                      step="0.01"
                      value={paid}
                      onChange={(e) => setPaid(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="mt-1"
                      data-testid="input-paid"
                    />
                  </div>
                  <div>
                    <Label htmlFor="discount" className="text-sm font-medium">Discount:</Label>
                    <Input
                      id="discount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={discount}
                      onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="mt-1"
                      data-testid="input-discount"
                    />
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t">
                  <div className="flex justify-between items-center">
                    <Label className="text-lg font-semibold">Balance:</Label>
                    <div className={`text-2xl font-bold ${balance >= 0 ? 'text-red-600' : 'text-green-600'}`} data-testid="balance">
                      {formatCurrency(balance)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={handleClose}
                  data-testid="button-close"
                >
                  Close
                </Button>
                <Button
                  onClick={handlePrint}
                  className="flex items-center gap-2"
                  disabled={!selectedPatient || billItems.length === 0 || isHospitalSettingsLoading}
                  data-testid="button-print-fake-bill"
                >
                  <Printer className="h-4 w-4" />
                  {isHospitalSettingsLoading ? "Loading..." : "Print/Download PDF"}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}