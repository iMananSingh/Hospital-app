
export interface BillingCalculationInput {
  service: {
    id: string;
    name: string;
    price: number;
    billingType: 'per_instance' | 'per_24_hours' | 'per_hour' | 'composite' | 'variable' | 'per_date';
    billingParameters?: string;
  };
  quantity?: number;
  startDateTime?: string;
  endDateTime?: string;
  customParameters?: Record<string, any>;
}

export interface BillingCalculationResult {
  totalAmount: number;
  billingQuantity: number;
  breakdown: {
    unitPrice: number;
    quantity: number;
    subtotal: number;
    description: string;
  }[];
  billingDetails: string;
}

export class SmartCostingEngine {
  
  /**
   * Calculate billing amount based on service type and parameters
   */
  static calculateBilling(input: BillingCalculationInput): BillingCalculationResult {
    const { service, quantity = 1, startDateTime, endDateTime, customParameters = {} } = input;
    
    switch (service.billingType) {
      case 'per_instance':
        return this.calculatePerInstance(service, quantity);
        
      case 'per_24_hours':
        return this.calculatePer24Hours(service, startDateTime, endDateTime);
        
      case 'per_hour':
        return this.calculatePerHour(service, quantity);
        
      case 'composite':
        return this.calculateComposite(service, customParameters);
        
      case 'variable':
        return this.calculateVariable(service, customParameters);
        
      case 'per_date':
        return this.calculatePerDate(service, quantity);
        
      default:
        return this.calculatePerInstance(service, quantity);
    }
  }

  /**
   * Per-instance billing (default for diagnostics, procedures)
   */
  private static calculatePerInstance(service: any, quantity: number): BillingCalculationResult {
    const totalAmount = service.price * quantity;
    
    return {
      totalAmount,
      billingQuantity: quantity,
      breakdown: [{
        unitPrice: service.price,
        quantity,
        subtotal: totalAmount,
        description: `${service.name} (${quantity} instance${quantity > 1 ? 's' : ''})`
      }],
      billingDetails: `Per instance billing: ₹${service.price} × ${quantity} = ₹${totalAmount}`
    };
  }

  /**
   * Per-24-hours billing (room charges)
   */
  private static calculatePer24Hours(service: any, startDateTime?: string, endDateTime?: string): BillingCalculationResult {
    if (!startDateTime) {
      // Default to 1 day if no dates provided
      return {
        totalAmount: service.price,
        billingQuantity: 1,
        breakdown: [{
          unitPrice: service.price,
          quantity: 1,
          subtotal: service.price,
          description: `${service.name} (1 day)`
        }],
        billingDetails: `Daily rate: ₹${service.price} × 1 day = ₹${service.price}`
      };
    }

    const startDate = new Date(startDateTime);
    const endDate = endDateTime ? new Date(endDateTime) : new Date();
    
    // Calculate number of 24-hour periods
    // Any part of a day counts as a full day (as per requirement)
    const timeDiff = endDate.getTime() - startDate.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
    const billingDays = Math.max(1, daysDiff); // Minimum 1 day
    
    const totalAmount = service.price * billingDays;
    
    return {
      totalAmount,
      billingQuantity: billingDays,
      breakdown: [{
        unitPrice: service.price,
        quantity: billingDays,
        subtotal: totalAmount,
        description: `${service.name} (${billingDays} day${billingDays > 1 ? 's' : ''})`
      }],
      billingDetails: `Daily rate: ₹${service.price} × ${billingDays} day${billingDays > 1 ? 's' : ''} = ₹${totalAmount}`
    };
  }

  /**
   * Per-hour billing (oxygen, etc.)
   */
  private static calculatePerHour(service: any, hours: number): BillingCalculationResult {
    const totalAmount = service.price * hours;
    
    return {
      totalAmount,
      billingQuantity: hours,
      breakdown: [{
        unitPrice: service.price,
        quantity: hours,
        subtotal: totalAmount,
        description: `${service.name} (${hours} hour${hours > 1 ? 's' : ''})`
      }],
      billingDetails: `Hourly rate: ₹${service.price} × ${hours} hour${hours > 1 ? 's' : ''} = ₹${totalAmount}`
    };
  }

  /**
   * Composite billing (ambulance: fixed + per-km)
   */
  private static calculateComposite(service: any, customParameters: Record<string, any>): BillingCalculationResult {
    let billingParams: any = {};
    
    try {
      billingParams = service.billingParameters ? JSON.parse(service.billingParameters) : {};
    } catch (e) {
      console.error('Error parsing billing parameters:', e);
    }

    const fixedCharge = billingParams.fixedCharge || service.price;
    const perKmRate = billingParams.perKmRate || 0;
    const distance = customParameters.distance || 0;
    
    const fixedAmount = fixedCharge;
    const distanceAmount = perKmRate * distance;
    const totalAmount = fixedAmount + distanceAmount;
    
    const breakdown = [
      {
        unitPrice: fixedCharge,
        quantity: 1,
        subtotal: fixedAmount,
        description: `${service.name} - Fixed charge`
      }
    ];

    if (distance > 0) {
      breakdown.push({
        unitPrice: perKmRate,
        quantity: distance,
        subtotal: distanceAmount,
        description: `Distance charge (${distance} km)`
      });
    }

    return {
      totalAmount,
      billingQuantity: 1,
      breakdown,
      billingDetails: `Fixed: ₹${fixedAmount}${distance > 0 ? ` + Distance: ₹${perKmRate} × ${distance}km = ₹${distanceAmount}` : ''} = ₹${totalAmount}`
    };
  }

  /**
   * Variable billing (user-defined price at time of service)
   */
  private static calculateVariable(service: any, customParameters: Record<string, any>): BillingCalculationResult {
    const variablePrice = customParameters.price || service.price || 0;
    
    return {
      totalAmount: variablePrice,
      billingQuantity: 1,
      breakdown: [{
        unitPrice: variablePrice,
        quantity: 1,
        subtotal: variablePrice,
        description: `${service.name} (Variable pricing)`
      }],
      billingDetails: `Variable price: ₹${variablePrice}`
    };
  }

  /**
   * Per calendar date billing (different from 24-hour billing)
   */
  private static calculatePerDate(service: any, quantity: number): BillingCalculationResult {
    const totalAmount = service.price * quantity;
    
    return {
      totalAmount,
      billingQuantity: quantity,
      breakdown: [{
        unitPrice: service.price,
        quantity,
        subtotal: totalAmount,
        description: `${service.name} (${quantity} calendar day${quantity > 1 ? 's' : ''})`
      }],
      billingDetails: `Per calendar date: ₹${service.price} × ${quantity} day${quantity > 1 ? 's' : ''} = ₹${totalAmount}`
    };
  }

  /**
   * Calculate room billing for admission duration
   */
  static calculateRoomBilling(dailyRate: number, admissionDate: string, dischargeDate?: string): BillingCalculationResult {
    const startDate = new Date(admissionDate);
    const endDate = dischargeDate ? new Date(dischargeDate) : new Date();
    
    // Calculate number of 24-hour periods
    const timeDiff = endDate.getTime() - startDate.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
    const billingDays = Math.max(1, daysDiff);
    
    const totalAmount = dailyRate * billingDays;
    
    return {
      totalAmount,
      billingQuantity: billingDays,
      breakdown: [{
        unitPrice: dailyRate,
        quantity: billingDays,
        subtotal: totalAmount,
        description: `Room charges (${billingDays} day${billingDays > 1 ? 's' : ''})`
      }],
      billingDetails: `Daily rate: ₹${dailyRate} × ${billingDays} day${billingDays > 1 ? 's' : ''} = ₹${totalAmount}`
    };
  }
}
