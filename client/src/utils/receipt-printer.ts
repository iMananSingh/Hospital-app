/**
 * Utility function to generate and print receipts
 */

export interface ReceiptData {
  type: 'service' | 'pathology' | 'admission' | 'payment' | 'discount';
  id: string;
  title: string;
  date: string;
  amount?: number;
  description: string;
  patientName: string;
  patientId: string;
  details?: Record<string, any>;
}

export interface HospitalInfo {
  name: string;
  address: string;
  phone: string;
  email: string;
  registrationNumber?: string;
  logo?: string;
}

export function generateReceiptHTML(receiptData: ReceiptData, hospitalInfo: HospitalInfo): string {
  // This function mirrors the HTML generation logic from ReceiptTemplate component
  
  const getPatientAge = () => {
    const dateOfBirth = receiptData.details?.dateOfBirth || receiptData.details?.rawData?.patient?.dateOfBirth;
    if (!dateOfBirth) return 'N/A';
    const age = Math.floor((new Date().getTime() - new Date(dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    return age >= 0 && age < 150 ? age : 'N/A';
  };

  const getPatientGender = () => {
    return receiptData.details?.gender || receiptData.details?.rawData?.patient?.gender || 'N/A';
  };

  const getDoctorName = () => {
    if (receiptData.details?.doctor?.name) return receiptData.details.doctor.name;
    if (receiptData.details?.doctorName) return receiptData.details.doctorName;
    return 'N/A';
  };

  const getReceiptTitle = (type: string, details?: Record<string, any>) => {
    switch (type) {
      case 'pathology':
        return 'Pathology Receipt';
      case 'service':
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
        const category = details?.category;
        if (category) {
          switch (category) {
            case 'diagnostics':
              return 'Diagnostic Service Receipt';
            case 'procedures':
              return 'Procedure Receipt';
            default:
              return `${category} Service Receipt`;
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

  const getReceiptNumber = () => {
    const checkBothCases = (obj: any, key: string) => {
      if (!obj) return null;
      return obj[key] || obj[key.charAt(0).toLowerCase() + key.slice(1)] ||
             obj[key.charAt(0).toUpperCase() + key.slice(1)];
    };

    let receiptNum = checkBothCases(receiptData.details, 'receiptNumber');
    if (receiptNum) {
      return receiptNum;
    }

    if (receiptData.type === 'pathology') {
      receiptNum = checkBothCases(receiptData.details?.rawData?.order, 'receiptNumber');
      if (receiptNum) return receiptNum;
      receiptNum = checkBothCases(receiptData.details?.order, 'receiptNumber');
      if (receiptNum) return receiptNum;
    }

    if (receiptData.type === 'admission') {
      receiptNum = checkBothCases(receiptData.details?.rawData?.event, 'receiptNumber');
      if (receiptNum) return receiptNum;
    }

    return 'N/A';
  };

  const receiptNumber = getReceiptNumber();

  const receiptHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${getReceiptTitle(receiptData.type, receiptData.details)}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: Arial, sans-serif;
          color: #333;
          background: white;
        }

        @page {
          size: auto;
          margin: 0.3in 0.5in;
        }

        .page-container {
          max-width: 8.5in;
          margin: 0 auto;
          background: white;
          padding: 0;
        }

        .header {
          border-bottom: 2px solid #333;
          margin-bottom: 5px;
          padding-bottom: 10px;
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

        .receipt-title {
          text-align: center;
          font-size: 18px;
          font-weight: bold;
          margin: 10px 0 5px 0;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

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

        .bill-section {
          margin: 2px 0 5px 0;
        }

        .bill-table {
          width: 100%;
          border-collapse: collapse;
          margin: 8px 0;
        }

        .bill-table th {
          background-color: #f0f0f0;
          border: 1px solid #999;
          padding: 8px;
          text-align: left;
          font-weight: bold;
        }

        .bill-table td {
          border: 1px solid #999;
          padding: 8px;
          vertical-align: top;
        }

        .amount-cell {
          text-align: right !important;
        }

        .signature-section {
          margin-top: 15px;
          display: flex;
          justify-content: flex-end;
        }

        .signature-box {
          text-align: center;
          width: 150px;
        }

        .signature-line {
          border-top: 1px solid #333;
          height: 60px;
        }

        .footer {
          margin-top: 15px;
          border-top: 2px solid #333;
          padding-top: 10px;
          font-size: 11px;
          line-height: 1.5;
        }

        .footer-line {
          margin: 2px 0;
        }

        .receipt-id {
          margin-top: 5px;
          font-weight: bold;
        }

        .receipt {
          padding: 0;
        }

        @media print {
          body {
            margin: 0;
            padding: 0;
          }
          .page-container {
            margin: 0;
            padding: 0;
          }
        }
      </style>
    </head>
    <body>
      <div class="page-container">
        <div class="receipt">
          <div class="header">
            <div class="hospital-info">
              ${hospitalInfo.logo ? `<img src="${hospitalInfo.logo}" alt="Hospital Logo" class="hospital-logo">` : ''}
              <div class="hospital-name">${hospitalInfo.name}</div>
            </div>
          </div>

          <div class="receipt-title">
            ${getReceiptTitle(receiptData.type, receiptData.details)}
          </div>

          <div class="patient-info-box">
            <div class="patient-line-1">
              <span class="name-section">Name: ${receiptData.patientName} (${receiptData.patientId})</span>
              <span class="age-section">Age: ${getPatientAge()} yrs</span>
              <span class="sex-section">Sex: ${getPatientGender()}</span>
              <span class="date-section">Date: ${(() => {
                const dateStr = receiptData.date || receiptData.details?.scheduledDate || receiptData.details?.orderedDate;
                if (!dateStr) return 'N/A';
                const date = new Date(dateStr);
                if (isNaN(date.getTime())) return 'Invalid Date';
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
                  if (receiptData.details?.orderNumber) return receiptData.details.orderNumber;
                  if (receiptData.details?.order?.orderNumber) return receiptData.details.order.orderNumber;
                  if (receiptData.details?.order?.orderId) return receiptData.details.order.orderId;
                  if (receiptData.details?.orderId) return receiptData.details.orderId;
                  if (receiptData.details?.rawData?.order?.orderId) return receiptData.details.rawData.order.orderId;
                  return receiptData.id;
                })()}</span>
                <span>Receipt No: ${receiptNumber}</span>
              </div>
              ` : `<span>Receipt No: ${receiptNumber}</span>`}
            </div>
          </div>

          <div class="bill-section">
            <table class="bill-table">
              <thead>
                <tr>
                  <th style="width: 60%;">${receiptData.type === 'pathology' ? 'Tests' : 'Description'}</th>
                  <th style="width: 15%; text-align: center !important;">Qty</th>
                  <th style="width: 25%; text-align: right !important;">Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                ${(() => {
                  if (receiptData.type === 'pathology') {
                    let tests = null;
                    if (receiptData.details?.tests && Array.isArray(receiptData.details.tests)) {
                      tests = receiptData.details.tests;
                    } else if (receiptData.details?.order?.tests && Array.isArray(receiptData.details.order.tests)) {
                      tests = receiptData.details.order.tests;
                    } else if (receiptData.details?.rawData?.tests && Array.isArray(receiptData.details.rawData.tests)) {
                      tests = receiptData.details.rawData.tests;
                    } else if (receiptData.details && Array.isArray(receiptData.details) && receiptData.details.length > 0) {
                      tests = receiptData.details;
                    }

                    if (tests && tests.length > 0) {
                      return tests.map((test: any, index: number) => {
                        const testName = test.testName || test.test_name || test.name || `Lab Test ${index + 1}`;
                        const testPrice = test.price || 0;
                        const testQty = test.quantity || 1;
                        return `
                          <tr>
                            <td>${testName}</td>
                            <td style="text-align: center !important;">${testQty}</td>
                            <td class="amount-cell" style="text-align: right !important;">₹${testPrice.toLocaleString()}</td>
                          </tr>
                        `;
                      }).join('');
                    } else {
                      const orderName = receiptData.title || `Pathology Order ${(receiptData.details as any)?.orderId || receiptData.id}`;
                      return `
                        <tr>
                          <td>${orderName}</td>
                          <td style="text-align: center !important;">1</td>
                          <td class="amount-cell" style="text-align: right !important;">₹${(receiptData.amount || 0).toLocaleString()}</td>
                        </tr>
                      `;
                    }
                  } else if (receiptData.type === 'service') {
                    let services = null;
                    if (receiptData.details?.services && Array.isArray(receiptData.details.services)) {
                      services = receiptData.details.services;
                    } else if (receiptData.details?.rawData?.services && Array.isArray(receiptData.details.rawData.services)) {
                      services = receiptData.details.rawData.services;
                    }

                    if (services && services.length > 0) {
                      return services.map((service: any, index: number) => {
                        const serviceName = service.serviceName || service.service_name || service.name || `Service ${index + 1}`;
                        const servicePrice = service.price || 0;
                        const serviceQty = service.billingQuantity || service.quantity || 1;
                        return `
                          <tr>
                            <td>${serviceName}</td>
                            <td style="text-align: center !important;">${serviceQty}</td>
                            <td class="amount-cell" style="text-align: right !important;">₹${servicePrice.toLocaleString()}</td>
                          </tr>
                        `;
                      }).join('');
                    } else {
                      const qty = receiptData.details?.billingQuantity || receiptData.details?.quantity || 1;
                      return `
                        <tr>
                          <td>${receiptData.description || receiptData.title || 'Service'}</td>
                          <td style="text-align: center !important;">${qty}</td>
                          <td class="amount-cell" style="text-align: right !important;">₹${(receiptData.amount || 0).toLocaleString()}</td>
                        </tr>
                      `;
                    }
                  } else {
                    return `
                      <tr>
                        <td>${receiptData.description || receiptData.title || 'Item'}</td>
                        <td style="text-align: center !important;">1</td>
                        <td class="amount-cell" style="text-align: right !important;">₹${(receiptData.amount || 0).toLocaleString()}</td>
                      </tr>
                    `;
                  }
                })()}
              </tbody>
            </table>
            
            <div style="margin-top: 8px; display: flex; justify-content: flex-end; padding-right: 8px;">
              <div style="display: flex; gap: 20px; align-items: center;">
                <span style="font-weight: bold; font-size: 16px;">Total Amount:</span>
                <span style="font-weight: bold; font-size: 16px; min-width: 80px; text-align: right;">₹${receiptData.amount ? receiptData.amount.toLocaleString() : '0'}</span>
              </div>
            </div>
          </div>

          <div class="signature-section">
            <div class="signature-box" style="margin-left: auto;">
              <div class="signature-line"></div>
              <div>Authorized Signature & Stamp</div>
            </div>
          </div>

          <div class="footer">
            <div class="footer-line">Address: ${hospitalInfo.address}</div>
            <div class="footer-line">Phone: ${hospitalInfo.phone} | Email: ${hospitalInfo.email}${hospitalInfo.registrationNumber ? ` | Reg. No.: ${hospitalInfo.registrationNumber}` : ''}</div>
            <div class="receipt-id">
              Receipt ID: ${receiptNumber} | Generated on ${new Date().toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  return receiptHtml;
}

export function printReceipt(receiptData: ReceiptData, hospitalInfo: HospitalInfo) {
  console.log('=== PRINT RECEIPT DEBUG ===');
  console.log('receiptData:', receiptData);
  console.log('receiptData.details?.tests:', receiptData.details?.tests);
  
  const receiptHtml = generateReceiptHTML(receiptData, hospitalInfo);
  
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow pop-ups to print receipts');
    return;
  }

  printWindow.document.write(receiptHtml);
  printWindow.document.close();
  printWindow.focus();

  setTimeout(() => {
    printWindow.print();
    setTimeout(() => {
      printWindow.close();
    }, 100);
  }, 250);
}
