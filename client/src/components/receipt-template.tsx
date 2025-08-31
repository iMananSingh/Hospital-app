
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
  const getReceiptTitle = (type: string, details?: Record<string, any>) => {
    switch (type) {
      case 'pathology':
        return 'Pathology Receipt';
      case 'service':
        // Get the service category from details
        const category = details?.category;
        if (category) {
          switch (category) {
            case 'diagnostics':
              return 'Diagnostic Service Receipt';
            case 'procedures':
              return 'Medical Procedure Receipt';
            case 'operations':
              return 'Surgical Operation Receipt';
            case 'misc':
              return 'Miscellaneous Service Receipt';
            default:
              return 'Service Receipt';
          }
        }
        return 'Service Receipt';
      case 'admission':
        return 'Admission Receipt';
      case 'payment':
        return 'Payment Receipt';
      case 'discount':
        return 'Discount Receipt';
      default:
        return 'Receipt';
    }
  };

  const getPatientAge = () => {
    // Try to extract age from patient details if available
    return receiptData.details?.patientAge || 'N/A';
  };

  const getPatientGender = () => {
    // Try to extract gender from patient details if available
    return receiptData.details?.patientGender || 'N/A';
  };

  const getDoctorName = () => {
    // Try to extract doctor name from details if available
    if (receiptData.details?.doctorName) {
      const doctorName = receiptData.details.doctorName;
      return doctorName.startsWith('Dr.') ? doctorName : `Dr. ${doctorName}`;
    }
    
    // For pathology receipts, try to get doctor from the details
    if (receiptData.type === 'pathology' && receiptData.details?.doctor) {
      const doctorName = receiptData.details.doctor.name;
      return doctorName.startsWith('Dr.') ? doctorName : `Dr. ${doctorName}`;
    }
    
    // For service receipts, try to get doctor from the details
    if (receiptData.type === 'service' && receiptData.details?.doctor) {
      const doctorName = receiptData.details.doctor.name;
      return doctorName.startsWith('Dr.') ? doctorName : `Dr. ${doctorName}`;
    }
    
    // For admission receipts, try to get doctor from the details
    if (receiptData.type === 'admission' && receiptData.details?.doctor) {
      const doctorName = receiptData.details.doctor.name;
      return doctorName.startsWith('Dr.') ? doctorName : `Dr. ${doctorName}`;
    }
    
    // If no doctor information is available
    return 'No Doctor Assigned';
  };

  const getReceiptNumber = () => {
    // Always use the stored receipt number
    return receiptData.details?.receiptNumber || 'RECEIPT-NOT-GENERATED';
  };

  const handlePrint = async () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const receiptNumber = getReceiptNumber();

    const receiptHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt - ${getReceiptTitle(receiptData.type, receiptData.details)}</title>
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
            
            .receipt {
              max-width: 800px;
              margin: 0 auto;
              padding: 20px;
              min-height: 90vh;
              display: flex;
              flex-direction: column;
            }
            
            /* Header - Logo and Hospital Name only */
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
            
            /* Receipt Title */
            .receipt-title {
              text-align: center;
              font-size: 18px;
              font-weight: bold;
              margin: 10px 0 5px 0;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            
            /* Patient Information Box */
            .patient-info-box {
              border: 2px solid #333;
              padding: 15px;
              margin: 8px 0 20px 0;
              background: #f9f9f9;
            }
            
            .patient-line-1 {
              display: flex;
              margin-bottom: 8px;
              font-weight: bold;
              gap: 20px;
              align-items: center;
            }
            
            .patient-line-1 .name-section {
              flex: 2;
              min-width: 0;
            }
            
            .patient-line-1 .age-section {
              flex: 0 0 auto;
              min-width: 80px;
            }
            
            .patient-line-1 .sex-section {
              flex: 0 0 auto;
              min-width: 80px;
            }
            
            .patient-line-1 .date-section {
              flex: 0 0 auto;
              min-width: 120px;
              text-align: right;
            }
            
            .patient-line-2 {
              display: flex;
              justify-content: space-between;
              font-weight: bold;
            }
            
            /* Bill Details */
            .bill-section {
              margin: 20px 0;
              flex-grow: 1;
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
              text-align: right;
            }
            
            .total-row {
              font-weight: bold;
              background: #f0f0f0;
            }
            
            .description-section {
              margin: 15px 0;
              padding: 10px;
              background: #f9f9f9;
              border: 1px solid #ddd;
            }
            
            .description-title {
              font-weight: bold;
              margin-bottom: 5px;
            }
            
            /* Signature Section */
            .signature-section {
              margin-top: 40px;
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
              margin-top: 30px;
              padding-top: 15px;
              border-top: 2px solid #333;
              text-align: center;
              font-size: 12px;
              line-height: 1.5;
            }
            
            .footer-line {
              margin-bottom: 3px;
            }
            
            .receipt-id {
              margin-top: 10px;
              font-family: monospace;
              font-size: 10px;
              color: #666;
            }
            
            @page {
              margin: 0;
              size: A4;
            }
            
            @media print {
              body {
                margin: 0;
                padding: 10px;
              }
              .receipt {
                padding: 10px;
              }
            }
          </style>
        </head>
        <body>
          <div class="receipt">
            <!-- Header - Logo and Hospital Name Only -->
            <div class="header">
              <div class="hospital-info">
                ${hospitalInfo.logo ? `
                  <img src="${hospitalInfo.logo}" alt="Hospital Logo" class="hospital-logo">
                ` : ''}
                <div class="hospital-name">${hospitalInfo.name}</div>
              </div>
            </div>
            
            <!-- Receipt Title -->
            <div class="receipt-title">
              ${getReceiptTitle(receiptData.type, receiptData.details)}
            </div>
            
            <!-- Patient Information Box -->
            <div class="patient-info-box">
              <div class="patient-line-1">
                <span class="name-section">Name: ${receiptData.patientName} (${receiptData.patientId})</span>
                <span class="age-section">Age: ${getPatientAge()}</span>
                <span class="sex-section">Sex: ${getPatientGender()}</span>
                <span class="date-section">Date: ${(() => {
                  const date = new Date(receiptData.date);
                  return date.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                  });
                })()}</span>
              </div>
              <div class="patient-line-2">
                <span>Doctor: ${getDoctorName()}</span>
                <span>Receipt No: ${receiptNumber}</span>
              </div>
            </div>
            
            <!-- Bill Section -->
            <div class="bill-section">
              <table class="bill-table">
                <thead>
                  <tr>
                    <th style="width: 60%;">Description</th>
                    <th style="width: 20%;">Quantity</th>
                    <th style="width: 20%;">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>${receiptData.title}</td>
                    <td style="text-align: center;">1</td>
                    <td class="amount-cell">${receiptData.amount ? receiptData.amount.toLocaleString() : '0'}</td>
                  </tr>
                  <tr class="total-row">
                    <td colspan="2" style="text-align: right; font-weight: bold;">Total Amount:</td>
                    <td class="amount-cell" style="font-weight: bold;">₹${receiptData.amount ? receiptData.amount.toLocaleString() : '0'}</td>
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
              <div class="footer-line">${hospitalInfo.address}</div>
              <div class="footer-line">Phone: ${hospitalInfo.phone} | Email: ${hospitalInfo.email}</div>
              ${hospitalInfo.registrationNumber ? `
                <div class="footer-line">Registration No: ${hospitalInfo.registrationNumber}</div>
              ` : ''}
              <div class="receipt-id">
                Receipt ID: ${receiptNumber} | Generated on ${new Date().toLocaleString()}
              </div>
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
