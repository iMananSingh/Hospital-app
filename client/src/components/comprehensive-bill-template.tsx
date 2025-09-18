
import React, { useEffect, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';

interface BillItem {
  type: 'service' | 'pathology' | 'admission' | 'payment' | 'discount';
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  quantity?: number;
  details: any;
}

interface BillSummary {
  totalCharges: number;
  totalPayments: number;
  totalDiscounts: number;
  remainingBalance: number;
  lastPaymentDate?: string;
  lastDiscountDate?: string;
}

interface BillData {
  patient: any;
  billItems: BillItem[];
  summary: BillSummary;
}

interface HospitalInfo {
  name: string;
  address: string;
  phone: string;
  email: string;
  registrationNumber: string;
  logoPath?: string;
}

interface ComprehensiveBillTemplateProps {
  billData: BillData;
  hospitalInfo: HospitalInfo;
  isOpen: boolean;
  onClose: () => void;
}

export function ComprehensiveBillTemplate({
  billData,
  hospitalInfo,
  isOpen,
  onClose,
}: ComprehensiveBillTemplateProps) {
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN');
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto print:max-w-none print:max-h-none print:overflow-visible">
        <div ref={printRef} className="comprehensive-bill-template">
          <style jsx>{`
            @media print {
              @page {
                margin: 1in;
                size: A4;
              }
              
              .print-header {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                height: 120px;
                background: white;
                z-index: 1000;
                page-break-inside: avoid;
              }
              
              .print-footer {
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                height: 80px;
                background: white;
                z-index: 1000;
                page-break-inside: avoid;
              }
              
              .print-content {
                margin-top: 140px;
                margin-bottom: 100px;
                page-break-inside: auto;
              }
              
              .no-print {
                display: none !important;
              }
            }
          `}</style>

          {/* Header - appears on every page when printed */}
          <div className="print-header border-b-2 border-gray-300 pb-4 mb-6">
            <div className="flex items-center justify-between">
              {hospitalInfo.logoPath && (
                <img
                  src={hospitalInfo.logoPath}
                  alt="Hospital Logo"
                  className="h-16 w-16 object-contain"
                />
              )}
              <div className="text-center flex-1">
                <h1 className="text-2xl font-bold text-gray-800">
                  {hospitalInfo.name}
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                  {hospitalInfo.address}
                </p>
                <p className="text-sm text-gray-600">
                  Phone: {hospitalInfo.phone} | Email: {hospitalInfo.email}
                </p>
                {hospitalInfo.registrationNumber && (
                  <p className="text-sm text-gray-600">
                    Reg. No: {hospitalInfo.registrationNumber}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="print-content">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold">COMPREHENSIVE FINANCIAL STATEMENT</h2>
            </div>

            {/* Patient Information */}
            <div className="mb-6 p-4 border border-gray-300">
              <h3 className="font-semibold mb-2">Patient Information</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <strong>Name:</strong> {billData.patient.name}
                </div>
                <div>
                  <strong>Patient ID:</strong> {billData.patient.id}
                </div>
                <div>
                  <strong>Phone:</strong> {billData.patient.phone}
                </div>
                <div>
                  <strong>Age:</strong> {billData.patient.age}
                </div>
                <div>
                  <strong>Gender:</strong> {billData.patient.gender}
                </div>
                <div>
                  <strong>Address:</strong> {billData.patient.address}
                </div>
              </div>
            </div>

            {/* Bill Items */}
            <div className="mb-6">
              <h3 className="font-semibold mb-2">Service Details</h3>
              <table className="w-full border-collapse border border-gray-300 text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 p-2 text-left">Date</th>
                    <th className="border border-gray-300 p-2 text-left">Type</th>
                    <th className="border border-gray-300 p-2 text-left">Description</th>
                    <th className="border border-gray-300 p-2 text-left">Category</th>
                    <th className="border border-gray-300 p-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {billData.billItems.map((item, index) => (
                    <tr key={index}>
                      <td className="border border-gray-300 p-2">
                        {formatDate(item.date)}
                      </td>
                      <td className="border border-gray-300 p-2 capitalize">
                        {item.type}
                      </td>
                      <td className="border border-gray-300 p-2">
                        {item.description}
                      </td>
                      <td className="border border-gray-300 p-2">
                        {item.category}
                      </td>
                      <td className="border border-gray-300 p-2 text-right">
                        {item.type === 'payment' || item.type === 'discount' ? 
                          `(${formatAmount(Math.abs(item.amount))})` : 
                          formatAmount(item.amount)
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary */}
            <div className="mb-6">
              <div className="border border-gray-300 p-4">
                <h3 className="font-semibold mb-4">Financial Summary</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <strong>Total Charges:</strong>
                    <span>{formatAmount(billData.summary.totalCharges)}</span>
                  </div>
                  <div className="flex justify-between">
                    <strong>Total Payments:</strong>
                    <span>{formatAmount(billData.summary.totalPayments)}</span>
                  </div>
                  <div className="flex justify-between">
                    <strong>Total Discounts:</strong>
                    <span>{formatAmount(billData.summary.totalDiscounts)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <strong>Remaining Balance:</strong>
                    <strong className={billData.summary.remainingBalance > 0 ? 'text-red-600' : 'text-green-600'}>
                      {formatAmount(billData.summary.remainingBalance)}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 text-center">
              <div className="border-t border-gray-400 w-48 mx-auto pt-2">
                <p className="text-sm">Authorized Signature & Stamp</p>
              </div>
            </div>
          </div>

          {/* Footer - appears on every page when printed */}
          <div className="print-footer border-t-2 border-gray-300 pt-4">
            <div className="text-center text-sm text-gray-600">
              <p>{hospitalInfo.address}</p>
              <p>Phone: {hospitalInfo.phone} | Email: {hospitalInfo.email}</p>
            </div>
          </div>

          {/* Close button - only visible on screen */}
          <button
            onClick={onClose}
            className="no-print fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
