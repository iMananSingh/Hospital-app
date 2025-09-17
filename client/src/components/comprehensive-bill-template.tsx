import React from 'react';
import { Button } from '@/components/ui/button';
import { Printer, FileText, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Patient } from '@shared/schema';

interface ComprehensiveBillItem {
  type: 'service' | 'pathology' | 'admission' | 'payment' | 'discount';
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  details: any;
}

interface ComprehensiveBillData {
  patient: Patient;
  billItems: ComprehensiveBillItem[];
  summary: {
    totalCharges: number;
    totalPayments: number;
    totalDiscounts: number;
    remainingBalance: number;
    lastPaymentDate?: string;
    lastDiscountDate?: string;
  };
}

interface ComprehensiveBillTemplateProps {
  billData: ComprehensiveBillData;
  hospitalInfo: {
    name: string;
    address: string;
    phone: string;
    email: string;
    registrationNumber?: string;
    logo?: string;
  };
  isOpen: boolean;
  onClose: () => void;
}

export function ComprehensiveBillTemplate({ 
  billData, 
  hospitalInfo, 
  isOpen,
  onClose 
}: ComprehensiveBillTemplateProps) {

  // Security: HTML escape functions to prevent XSS
  const escapeHtml = (text: string) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  // Security: Attribute-safe escaping for use in HTML attributes
  const escapeAttribute = (text: string) => {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  };

  // Security: URL validation and sanitization for images only
  const sanitizeImageUrl = (url: string) => {
    // Only allow http, https, and safe data image URLs
    if (url.match(/^https?:/i)) {
      return escapeAttribute(url);
    }
    if (url.match(/^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,/i)) {
      return escapeAttribute(url);
    }
    return ''; // Block potentially malicious URLs like javascript: or data:text/html
  };
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

  const getItemTypeColor = (type: string) => {
    switch (type) {
      case 'service':
        return 'text-blue-600';
      case 'pathology':
        return 'text-purple-600';
      case 'admission':
        return 'text-orange-600';
      case 'payment':
        return 'text-green-600';
      case 'discount':
        return 'text-indigo-600';
      default:
        return 'text-gray-600';
    }
  };

  const getItemTypeIcon = (type: string) => {
    switch (type) {
      case 'service':
        return '🏥';
      case 'pathology':
        return '🧪';
      case 'admission':
        return '🛏️';
      case 'payment':
        return '💳';
      case 'discount':
        return '🏷️';
      default:
        return '📄';
    }
  };

  const generateReceiptNumber = () => {
    const today = new Date();
    const yymmdd = today.toISOString().slice(2, 10).replace(/-/g, '').slice(0, 6);
    const timestamp = Date.now().toString().slice(-4);
    return `${yymmdd}-BILL-${timestamp}`;
  };

  // Filter out payments and discounts from bill items for transaction history
  const chargeItems = billData.billItems.filter(item => 
    item.type !== 'payment' && item.type !== 'discount'
  );

  // Helper function to extract quantity and clean description
  const getQuantityAndDescription = (item: any) => {
    let quantity = 1;
    let description = item.description;

    // First check if quantity is directly available in details
    if (item.details?.quantity) {
      quantity = item.details.quantity;
    } else if (item.type === 'admission') {
      // For admission, check stayDuration
      if (item.details?.stayDuration) {
        quantity = item.details.stayDuration;
      } else {
        // Extract days from bed charges description as fallback
        const dayMatch = description.match(/(\d+)\s+day\(s\)/);
        if (dayMatch) {
          quantity = parseInt(dayMatch[1]);
        }
      }
    } else if (item.type === 'service') {
      // For services, check billing quantity
      if (item.details?.billingQuantity && item.details.billingQuantity > 1) {
        quantity = item.details.billingQuantity;
      } else {
        // Check if description has quantity pattern like "Service Name (x3)"
        const quantityMatch = description.match(/\(x(\d+)\)$/);
        if (quantityMatch) {
          quantity = parseInt(quantityMatch[1]);
          description = description.replace(/\s*\(x\d+\)$/, '');
        }
      }
    } else if (item.type === 'pathology') {
      // For pathology orders, always show quantity as 1 (one order)
      // The total price already represents the sum of all tests in the order
      quantity = 1;
    }

    return { quantity, description };
  };

  const handlePrint = async () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const receiptNumber = generateReceiptNumber();
    
    // Debug log to ensure we have the correct hospital info
    console.log('Hospital info being used in comprehensive bill:', hospitalInfo);

    const billHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Comprehensive Bill - ${escapeHtml(billData.patient.name)}</title>
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

            .bill {
              max-width: 800px;
              margin: 0 auto;
              padding: 20px;
              display: flex;
              flex-direction: column;
            }

            /* Header */
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

            /* Bill Title */
            .bill-title {
              text-align: center;
              font-size: 20px;
              font-weight: bold;
              margin: 10px 0;
              text-transform: uppercase;
              letter-spacing: 1px;
              color: #2563eb;
            }

            /* Patient Information */
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
              font-weight: bold;
              margin-top: 10px;
              padding-top: 10px;
              border-top: 1px solid #ddd;
            }

            /* Summary Section */
            .summary-section {
              background: #f0f9ff;
              border: 2px solid #2563eb;
              padding: 15px;
              margin: 10px 0;
              border-radius: 5px;
            }

            .summary-title {
              font-size: 16px;
              font-weight: bold;
              color: #2563eb;
              margin-bottom: 10px;
              text-align: center;
            }

            .summary-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 10px;
            }

            .summary-item {
              display: flex;
              justify-content: space-between;
              padding: 5px 0;
              border-bottom: 1px solid #ddd;
            }

            .summary-item.total {
              font-weight: bold;
              font-size: 16px;
              border-bottom: 2px solid #2563eb;
              color: #2563eb;
            }

            /* Bill Items */
            .bill-section {
              margin: 10px 0;
            }

            .section-title {
              font-size: 16px;
              font-weight: bold;
              margin: 15px 0 10px 0;
              padding: 5px 10px;
              background: #f3f4f6;
              border-left: 4px solid #2563eb;
            }

            .bill-table {
              width: 100%;
              border-collapse: collapse;
              margin: 5px 0 15px 0;
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

            .type-icon {
              width: 20px;
              text-align: center;
            }

            .service-row { background: #eff6ff; }
            .pathology-row { background: #faf5ff; }
            .admission-row { background: #fff7ed; }
            .payment-row { background: #f0fdf4; }
            .discount-row { background: #eef2ff; }

            .negative-amount {
              color: #059669;
              font-weight: bold;
            }

            .positive-amount {
              color: #dc2626;
            }

            /* Signature Section */
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

            /* Footer */
            .footer {
              margin-top: 8px;
              padding-top: 8px;
              border-top: 2px solid #333;
              text-align: center;
              font-size: 12px;
              line-height: 1.5;
            }

            .footer-line {
              margin-bottom: 3px;
            }

            .bill-id {
              margin-top: 15px;
              font-family: monospace;
              font-size: 10px;
              color: #666;
            }

            @page {
              margin: 0;
              size: A4;
            }

            @media print {
              * {
                -webkit-print-color-adjust: exact !important;
                color-adjust: exact !important;
              }

              html, body {
                margin: 0 !important;
                padding: 0 !important;
                height: auto !important;
                background: white !important;
              }

              body {
                padding: 10px !important;
              }

              .bill {
                margin: 0 !important;
                padding: 10px !important;
                page-break-inside: avoid;
              }

              .header {
                margin-top: 0 !important;
                padding-top: 0 !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="bill">
            <!-- Header -->
            <div class="header">
              <div class="hospital-info">
                ${hospitalInfo.logo ? `
                  <img src="${sanitizeImageUrl(hospitalInfo.logo)}" alt="Hospital Logo" class="hospital-logo">
                ` : ''}
                <div>
                  <div class="hospital-name">${escapeHtml(hospitalInfo.name)}</div>
                  <div style="text-align: center; font-size: 12px; margin-top: 5px;">${escapeHtml(hospitalInfo.address)}</div>
                  <div style="text-align: center; font-size: 12px;">
                    Phone: ${escapeHtml(hospitalInfo.phone)} | Email: ${escapeHtml(hospitalInfo.email)}${hospitalInfo.registrationNumber ? ` | Reg. No.: ${escapeHtml(hospitalInfo.registrationNumber)}` : ''}
                  </div>
                </div>
              </div>
            </div>

            <!-- Bill Title -->
            <div class="bill-title">
              Comprehensive Financial Statement
            </div>

            <!-- Patient Information -->
            <div class="patient-info-box">
              <div class="patient-details">
                <div class="patient-detail">Name: ${escapeHtml(billData.patient.name)}</div>
                <div class="patient-detail">Patient ID: ${escapeHtml(billData.patient.patientId)}</div>
                <div class="patient-detail">Age: ${escapeHtml(billData.patient.age?.toString() || 'N/A')} yrs</div>
                <div class="patient-detail">Gender: ${escapeHtml(billData.patient.gender || 'N/A')}</div>
                <div class="patient-detail">Phone: ${escapeHtml(billData.patient.phone || 'N/A')}</div>
              </div>
              <div class="bill-meta">
                <span>Bill Date: ${formatDate(new Date().toISOString())}</span>
                <span>Bill Number: ${escapeHtml(receiptNumber)}</span>
              </div>
            </div>

            <!-- Detailed Bill Items -->
            <div class="bill-section">
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
                  ${chargeItems.map((item, index) => {
                    const { quantity, description } = getQuantityAndDescription(item);
                    return `
                    <tr class="${escapeHtml(item.type)}-row">
                      <td>${index + 1}</td>
                      <td>${formatDate(item.date)}</td>
                      <td>${escapeHtml(description)}</td>
                      <td style="text-align: center;">${quantity}</td>
                      <td class="amount-cell" style="text-align: right;">
                        ₹${quantity > 0 ? (item.amount / quantity).toLocaleString() : '0'}
                      </td>
                      <td class="amount-cell positive-amount">
                        ₹${item.amount.toLocaleString()}
                      </td>
                    </tr>
                    `;
                  }).join('')}

                  <!-- Summary Section as part of table -->
                  <tr style="border-top: 2px solid #333;">
                    <td colspan="5" style="text-align: right; font-weight: bold; padding-top: 15px;">TOTAL CHARGES:</td>
                    <td class="amount-cell" style="font-weight: bold; font-size: 16px; padding-top: 15px;">₹${billData.summary.totalCharges.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td colspan="5" style="text-align: right; font-weight: bold;">PAID:</td>
                    <td class="amount-cell negative-amount" style="font-weight: bold;">-₹${billData.summary.totalPayments.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td colspan="5" style="text-align: right; font-weight: bold;">DISCOUNT:</td>
                    <td class="amount-cell negative-amount" style="font-weight: bold;">-₹${billData.summary.totalDiscounts.toLocaleString()}</td>
                  </tr>
                  <tr style="border-top: 2px solid #2563eb; background: #f0f9ff;">
                    <td colspan="5" style="text-align: right; font-weight: bold; font-size: 18px; color: #2563eb; padding: 10px;">BALANCE:</td>
                    <td class="amount-cell ${billData.summary.remainingBalance >= 0 ? 'positive-amount' : 'negative-amount'}" style="font-weight: bold; font-size: 18px; padding: 10px;">
                      ₹${billData.summary.remainingBalance.toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Signature Section -->
            <div class="signature-section">
              <div class="signature-box" style="margin-left: auto;">
                <div class="signature-line"></div>
                <div>Authorized Signature & Stamp</div>
              </div>
            </div>

            <!-- Footer -->
            <div class="footer">
              <div class="footer-line">Address: ${escapeHtml(hospitalInfo.address)}</div>
              <div class="footer-line">Phone: ${escapeHtml(hospitalInfo.phone)} | Email: ${escapeHtml(hospitalInfo.email)}${hospitalInfo.registrationNumber ? ` | Reg. No.: ${escapeHtml(hospitalInfo.registrationNumber)}` : ''}</div>
              <div class="bill-id">
                Bill ID: ${escapeHtml(receiptNumber)} | Generated on ${new Date().toLocaleString()}
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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="comprehensive-bill-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            Comprehensive Financial Statement - {billData.patient.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Patient Info Summary */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="font-medium">Patient ID:</span>
                <div>{billData.patient.patientId}</div>
              </div>
              <div>
                <span className="font-medium">Age:</span>
                <div>{billData.patient.age} years</div>
              </div>
              <div>
                <span className="font-medium">Gender:</span>
                <div>{billData.patient.gender}</div>
              </div>
              <div>
                <span className="font-medium">Phone:</span>
                <div>{billData.patient.phone}</div>
              </div>
            </div>
          </div>

          {/* Service & Treatment Details */}
          <div>
            <h3 className="font-semibold mb-3">Service & Treatment Details ({chargeItems.length} items)</h3>
            <div className="border rounded-lg overflow-hidden">
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left p-3 border-b">Date</th>
                      <th className="text-left p-3 border-b">Description</th>
                      <th className="text-center p-3 border-b">Qty</th>
                      <th className="text-right p-3 border-b">Rate</th>
                      <th className="text-right p-3 border-b">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chargeItems.map((item, index) => {
                      const { quantity, description } = getQuantityAndDescription(item);
                      return (
                        <tr key={`${item.type}-${item.id}`} className="hover:bg-gray-50">
                          <td className="p-3 border-b">{formatDate(item.date)}</td>
                          <td className="p-3 border-b">{description}</td>
                          <td className="p-3 border-b text-center">{quantity}</td>
                          <td className="p-3 border-b text-right font-medium">
                            {formatCurrency(quantity > 0 ? item.amount / quantity : 0)}
                          </td>
                          <td className="p-3 border-b text-right font-medium text-red-600">
                            {formatCurrency(item.amount)}
                          </td>
                        </tr>
                      );
                    })}

                    {/* Summary as part of table */}
                    <tr className="border-t-2 border-gray-300 bg-gray-50">
                      <td colSpan={4} className="p-3 text-right font-bold text-lg">
                        TOTAL CHARGES:
                      </td>
                      <td className="p-3 text-right font-bold text-lg text-red-600">
                        {formatCurrency(billData.summary.totalCharges)}
                      </td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td colSpan={4} className="p-3 text-right font-bold">
                        PAID:
                      </td>
                      <td className="p-3 text-right font-bold text-green-600">
                        -{formatCurrency(billData.summary.totalPayments)}
                      </td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td colSpan={4} className="p-3 text-right font-bold">
                        DISCOUNT:
                      </td>
                      <td className="p-3 text-right font-bold text-green-600">
                        -{formatCurrency(billData.summary.totalDiscounts)}
                      </td>
                    </tr>
                    <tr className="border-t-2 border-blue-500 bg-blue-50">
                      <td colSpan={4} className="p-4 text-right font-bold text-xl text-blue-800">
                        BALANCE:
                      </td>
                      <td className={`p-4 text-right font-bold text-xl ${
                        billData.summary.remainingBalance >= 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {formatCurrency(billData.summary.remainingBalance)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex items-center gap-2"
              data-testid="button-close-comprehensive-bill"
            >
              <X className="h-4 w-4" />
              Close
            </Button>
            <Button
              onClick={handlePrint}
              className="flex items-center gap-2"
              data-testid="button-print-comprehensive-bill"
            >
              <Printer className="h-4 w-4" />
              Print/Download PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}