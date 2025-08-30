
import React from 'react';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';

interface ReceiptTemplateProps {
  receiptData: {
    type: 'service' | 'pathology' | 'admission' | 'payment' | 'discount';
    id: string;
    title: string;
    date: string;
    amount?: number;
    description: string;
    patientName: string;
    patientId: string;
    details?: Record<string, any>;
  };
  hospitalInfo: {
    name: string;
    address: string;
    phone: string;
    email: string;
    registrationNumber?: string;
    logo?: string;
  };
  onPrint: () => void;
}

export function ReceiptTemplate({ receiptData, hospitalInfo, onPrint }: ReceiptTemplateProps) {
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const receiptHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt - ${receiptData.title}</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              line-height: 1.6;
              color: #333;
              background: white;
            }
            
            .receipt {
              max-width: 800px;
              margin: 0 auto;
              padding: 40px;
              min-height: 50vh;
              border: 2px solid #e5e7eb;
              border-radius: 12px;
              background: white;
            }
            
            .header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              margin-bottom: 40px;
              padding-bottom: 20px;
              border-bottom: 3px solid #3b82f6;
            }
            
            .hospital-info {
              flex: 1;
              display: flex !important;
              align-items: center;
            }
            
            .hospital-logo {
              width: 80px;
              height: 80px;
              object-fit: contain;
              border-radius: 8px;
            }
            
            .hospital-name {
              font-size: 28px;
              font-weight: bold;
              color: #1e40af;
              margin-bottom: 8px;
            }
            
            .hospital-details {
              color: #6b7280;
              font-size: 14px;
              line-height: 1.4;
            }
            
            .receipt-type {
              background: #3b82f6;
              color: white;
              padding: 12px 24px;
              border-radius: 8px;
              font-weight: bold;
              font-size: 16px;
              text-align: center;
              min-width: 150px;
            }
            
            .receipt-info {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 30px;
              margin-bottom: 40px;
            }
            
            .info-section {
              background: #f8fafc;
              padding: 20px;
              border-radius: 8px;
              border-left: 4px solid #3b82f6;
            }
            
            .info-title {
              font-weight: bold;
              color: #1e40af;
              margin-bottom: 12px;
              font-size: 16px;
            }
            
            .info-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 8px;
              font-size: 14px;
            }
            
            .info-label {
              color: #6b7280;
              font-weight: 500;
            }
            
            .info-value {
              font-weight: 600;
              color: #374151;
            }
            
            .amount-section {
              background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%);
              color: white;
              padding: 24px;
              border-radius: 12px;
              text-align: center;
              margin: 30px 0;
            }
            
            .amount-label {
              font-size: 16px;
              margin-bottom: 8px;
              opacity: 0.9;
            }
            
            .amount-value {
              font-size: 36px;
              font-weight: bold;
            }
            
            .description-section {
              margin: 30px 0;
              padding: 20px;
              background: #f1f5f9;
              border-radius: 8px;
              border: 1px solid #e2e8f0;
            }
            
            .description-title {
              font-weight: bold;
              color: #1e40af;
              margin-bottom: 12px;
              font-size: 16px;
            }
            
            .description-text {
              color: #374151;
              line-height: 1.6;
            }
            
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 2px solid #e5e7eb;
              text-align: center;
            }
            
            .footer-note {
              color: #6b7280;
              font-size: 12px;
              font-style: italic;
            }
            
            .receipt-id {
              background: #f3f4f6;
              padding: 8px 16px;
              border-radius: 6px;
              font-family: monospace;
              font-size: 12px;
              color: #374151;
              margin-top: 10px;
              display: inline-block;
            }
            
            @media print {
              body {
                margin: 0;
                padding: 20px;
              }
              .receipt {
                border: none;
                box-shadow: none;
                padding: 20px;
              }
            }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="header">
              <div class="hospital-info" style="display: flex; align-items: center;">
                ${hospitalInfo.logo ? `
                  <div style="margin-right: 20px;">
                    <img src="${hospitalInfo.logo}" alt="Hospital Logo" class="hospital-logo">
                  </div>
                ` : ''}
                <div>
                  <div class="hospital-name">${hospitalInfo.name}</div>
                  <div class="hospital-details">
                    ${hospitalInfo.address}<br>
                    Phone: ${hospitalInfo.phone}<br>
                    Email: ${hospitalInfo.email}
                    ${hospitalInfo.registrationNumber ? `<br>Reg. No.: ${hospitalInfo.registrationNumber}` : ''}
                  </div>
                </div>
              </div>
              <div class="receipt-type">
                ${receiptData.type.toUpperCase()} RECEIPT
              </div>
            </div>
            
            <div class="receipt-info">
              <div class="info-section">
                <div class="info-title">Patient Information</div>
                <div class="info-row">
                  <span class="info-label">Patient Name:</span>
                  <span class="info-value">${receiptData.patientName}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Patient ID:</span>
                  <span class="info-value">${receiptData.patientId}</span>
                </div>
              </div>
              
              <div class="info-section">
                <div class="info-title">Receipt Details</div>
                <div class="info-row">
                  <span class="info-label">Date:</span>
                  <span class="info-value">${receiptData.date}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Receipt ID:</span>
                  <span class="info-value">${receiptData.id}</span>
                </div>
              </div>
            </div>
            
            ${receiptData.amount ? `
              <div class="amount-section">
                <div class="amount-label">${receiptData.type === 'discount' ? 'Discount Amount' : 'Amount'}</div>
                <div class="amount-value">₹${receiptData.amount.toLocaleString()}</div>
              </div>
            ` : ''}
            
            <div class="description-section">
              <div class="description-title">${receiptData.title}</div>
              <div class="description-text">${receiptData.description}</div>
            </div>
            
            <div class="footer">
              <div class="footer-note">
                This is a computer generated receipt and does not require signature.<br>
                Generated on ${new Date().toLocaleString()}
              </div>
              <div class="receipt-id">Receipt ID: RCP-${Date.now()}</div>
            </div>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(receiptHtml);
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);

    onPrint();
  };

  return (
    <Button
      onClick={handlePrint}
      variant="outline"
      size="sm"
      className="flex items-center justify-center text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-full min-h-full w-12 px-3"
      title="Print Receipt"
    >
      <Printer className="h-4 w-4" />
    </Button>
  );
}
