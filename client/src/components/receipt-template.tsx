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
  onPrint?: () => void;
}

export function ReceiptTemplate({ receiptData, hospitalInfo, onPrint }: ReceiptTemplateProps) {
  const getReceiptTitle = (type: string, details?: Record<string, any>) => {
    switch (type) {
      case 'pathology':
        return 'Pathology Receipt';
      case 'service':
        // Check if it's an OPD consultation first - check multiple possible identifiers
        if (details?.category === 'OPD Consultation' ||
            details?.serviceType === 'opd' ||
            details?.serviceName === 'OPD Consultation' ||
            receiptData.title === 'OPD Consultation' ||
            receiptData.title?.includes('OPD') ||
            receiptData.description?.includes('OPD') ||
            details?.type === 'opd_visit' ||
            details?.consultationFee) {
          return 'OPD Receipt';
        }

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
              display: flex;
              flex-direction: column;
            }

            /* Page Header for printing */
            .page-header {
              display: none;
            }

            /* Page Footer for printing */
            .page-footer {
              display: none;
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
              margin: 8px 0 5px 0;
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
              margin: 2px 0 5px 0;
              flex-grow: 1;
            }

            .bill-table {
              width: 100%;
              border-collapse: collapse;
              margin: 5px 0;
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

            .total-row {
              font-weight: bold;
              background: #f0f0f0;
            }

            .description-section {
              margin: 5px 0;
              padding: 8px;
              background: #f9f9f9;
              border: 1px solid #ddd;
            }

            .description-title {
              font-weight: bold;
              margin-bottom: 5px;
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

            .receipt-id {
              margin-top: 15px;
              font-family: monospace;
              font-size: 10px;
              color: #666;
            }

            @page {
              margin: 1.5in 1in 1in 1in;
              size: A4;
            }

            @media print {
              @page {
                margin: 0;
                size: A4;
              }
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

              /* Hide browser default headers and footers */
              @page {
                margin: 0;
                size: A4;
              }

              html {
                -webkit-print-color-adjust: exact;
              }

              .receipt {
                margin: 0 !important;
                padding: 0 !important;
                page-break-inside: avoid;
              }

              /* Show headers and footers on every page */
              .page-header {
                display: flex !important;
                align-items: center;
                justify-content: center;
                padding: 15px 0;
                border-bottom: 2px solid #333;
                background: white;
                width: 100%;
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                z-index: 1000;
              }

              .page-footer {
                display: block !important;
                text-align: center;
                font-size: 12px;
                line-height: 1.5;
                padding: 10px 0;
                border-top: 2px solid #333;
                background: white;
                width: 100%;
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                z-index: 1000;
              }

              /* Hide the regular header and footer in print */
              .header {
                display: none !important;
              }

              .footer {
                display: none !important;
              }

              /* Ensure content doesn't overlap with fixed header/footer */
              .receipt-title {
                margin-top: 100px !important;
              }

              .signature-section {
                margin-bottom: 80px !important;
              }
            }
          </style>
        </head>
        <body>
          <!-- Page Header for printing -->
          <div class="page-header">
            <div class="hospital-info">
              ${hospitalInfo.logo ? `
                <img src="${hospitalInfo.logo}" alt="Hospital Logo" class="hospital-logo">
              ` : ''}
              <div class="hospital-name">${hospitalInfo.name}</div>
            </div>
          </div>

          <!-- Page Footer for printing -->
          <div class="page-footer">
            <div class="footer-line">Address: ${hospitalInfo.address}</div>
            <div class="footer-line">Phone: ${hospitalInfo.phone} | Email: ${hospitalInfo.email}${hospitalInfo.registrationNumber ? ` | Reg. No.: ${hospitalInfo.registrationNumber}` : ''}</div>
          </div>

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
                <span class="age-section">Age: ${getPatientAge()} yrs</span>
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
                ${receiptData.type === 'pathology' ? `
                <div style="display: flex; gap: 30px; align-items: center;">
                  <span>Pathology Order: ${(() => {
                    // Check if there's a formatted order number in the details
                    if (receiptData.details?.orderNumber) {
                      return receiptData.details.orderNumber;
                    }
                    // Check if there's an order object with orderNumber
                    if (receiptData.details?.order?.orderNumber) {
                      return receiptData.details.order.orderNumber;
                    }
                    // Check if there's an orderId in the order object
                    if (receiptData.details?.order?.orderId) {
                      return receiptData.details.order.orderId;
                    }
                    // Check if there's an orderId in the details
                    if (receiptData.details?.orderId) {
                      return receiptData.details.orderId;
                    }
                    // Check if there's an orderId in the rawData
                    if (receiptData.details?.rawData?.order?.orderId) {
                      return receiptData.details.rawData.order.orderId;
                    }
                    // Fallback to the ID if no order number is found
                    return receiptData.id;
                  })()}</span>
                  <span>Receipt No: ${receiptNumber}</span>
                </div>
                ` : `<span>Receipt No: ${receiptNumber}</span>`}
              </div>
            </div>

            <!-- Bill Section -->
            <div class="bill-section">
              <table class="bill-table">
                <thead>
                  <tr>
                    <th style="width: 80%;">${receiptData.type === 'pathology' ? 'Tests' : 'Description'}</th>
                    <th style="width: 20%; text-align: right !important;">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  ${(() => {
                    // For pathology receipts, show individual tests if available
                    if (receiptData.type === 'pathology') {
                      // Try multiple possible locations for test data
                      let tests = null;

                      console.log('=== PATHOLOGY RECEIPT DEBUG ===');
                      console.log('receiptData.details:', receiptData.details);

                      // Check if tests are in details.tests (direct from API)
                      if (receiptData.details?.tests && Array.isArray(receiptData.details.tests)) {
                        tests = receiptData.details.tests;
                        console.log('Found tests in details.tests:', tests);
                      }
                      // Check if tests are in details.order.tests (from pathology order structure)
                      else if (receiptData.details?.order?.tests && Array.isArray(receiptData.details.order.tests)) {
                        tests = receiptData.details.order.tests;
                        console.log('Found tests in details.order.tests:', tests);
                      }
                      // Check if tests are in details.rawData.tests (backup location)
                      else if (receiptData.details?.rawData?.tests && Array.isArray(receiptData.details.rawData.tests)) {
                        tests = receiptData.details.rawData.tests;
                        console.log('Found tests in details.rawData.tests:', tests);
                      }
                      // Check if the entire details object is a pathology order with tests
                      else if (receiptData.details && Array.isArray(receiptData.details) && receiptData.details.length > 0) {
                        // Sometimes the details might be the tests array directly
                        tests = receiptData.details;
                        console.log('Found tests as details array directly:', tests);
                      }

                      console.log('Final tests to use:', tests);

                      if (tests && tests.length > 0) {
                        return tests.map((test, index) => {
                          const testName = test.testName || test.test_name || test.name || `Lab Test ${index + 1}`;
                          const testPrice = test.price || 0;
                          console.log(`Test ${index + 1}: ${testName} - ₹${testPrice}`);
                          return `
                            <tr>
                              <td>${testName}</td>
                              <td class="amount-cell" style="text-align: right !important;">₹${testPrice.toLocaleString()}</td>
                            </tr>
                          `;
                        }).join('');
                      } else {
                        console.log('No tests found, falling back to order display');
                        // Fallback: show the pathology order as a single line item
                        const orderName = receiptData.title || `Pathology Order ${receiptData.details?.orderId || receiptData.id}`;
                        return `
                          <tr>
                            <td>${orderName}</td>
                            <td class="amount-cell" style="text-align: right !important;">₹${receiptData.amount ? receiptData.amount.toLocaleString() : '0'}</td>
                          </tr>
                        `;
                      }
                    }

                    // For other types or if no tests available, use the title as usual
                    return `
                      <tr>
                        <td>${receiptData.title}</td>
                        <td class="amount-cell" style="text-align: right !important;">₹${receiptData.amount ? receiptData.amount.toLocaleString() : '0'}</td>
                      </tr>
                    `;
                  })()}
                  <tr class="total-row">
                    <td style="text-align: right; font-weight: bold;">Total Amount:</td>
                    <td class="amount-cell" style="font-weight: bold; text-align: right !important;">₹${receiptData.amount ? receiptData.amount.toLocaleString() : '0'}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Description Section (if applicable) -->
            ${receiptData.description && !receiptData.details?.services ? `
              <div class="description-section">
                <div class="description-title">Additional Information:</div>
                <div>${receiptData.description}</div>
              </div>
            ` : ''}

            <!-- Signature Section -->
            <div class="signature-section">
              <div class="signature-box" style="margin-left: auto;">
                <div class="signature-line"></div>
                <div>Authorized Signature & Stamp</div>
              </div>
            </div>

            <!-- Footer -->
            <div class="footer">
              <div class="footer-line">Address: ${hospitalInfo.address}</div>
              <div class="footer-line">Phone: ${hospitalInfo.phone} | Email: ${hospitalInfo.email}${hospitalInfo.registrationNumber ? ` | Reg. No.: ${hospitalInfo.registrationNumber}` : ''}</div>
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

    onPrint?.();
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