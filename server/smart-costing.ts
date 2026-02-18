
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
  timezone?: string; // Add timezone to input
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
    const { service, quantity = 1, startDateTime, endDateTime, customParameters = {}, timezone = 'UTC' } = input;
    
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
        return this.calculatePerDate(service, startDateTime, endDateTime, timezone);
        
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

    const components = Array.isArray(billingParams.components)
      ? billingParams.components
      : [
          {
            label: "Base Charge",
            pricingType: "fixed",
            amount: billingParams.fixedCharge ?? service.price ?? 0,
            required: true,
            defaultSelected: true,
          },
          {
            label: "Distance",
            pricingType: "variable",
            unit: "km",
            amount: billingParams.perKmRate ?? 0,
            required: true,
            defaultSelected: true,
          },
        ];

    const quantities = customParameters.quantities || {};
    const selectedComponents =
      customParameters.selectedComponents ||
      customParameters.componentSelections ||
      {};
    const componentOverrides =
      customParameters.componentOverrides ||
      customParameters.overrideAmounts ||
      {};
    const breakdown: BillingCalculationResult["breakdown"] = [];
    let totalAmount = 0;

    components.forEach((component: any, index: number) => {
      const pricingType = component.pricingType ?? component.type ?? "fixed";
      const required = component.required === true;
      const defaultSelected =
        component.defaultSelected !== undefined
          ? component.defaultSelected
          : required;
      const selectedValue = Array.isArray(selectedComponents)
        ? selectedComponents[index]
        : selectedComponents && typeof selectedComponents === "object"
          ? (selectedComponents[index] ??
              (component.label
                ? selectedComponents[component.label]
                : undefined))
          : undefined;
      const isSelected =
        required ||
        (selectedValue !== undefined ? Boolean(selectedValue) : defaultSelected);

      if (!isSelected) {
        return;
      }

      if (pricingType === "fixed") {
        const configured = Number(component.amount ?? component.rate) || 0;
        const overrideValue = Array.isArray(componentOverrides)
          ? componentOverrides[index]
          : componentOverrides && typeof componentOverrides === "object"
            ? (componentOverrides[index] ??
                (component.label
                  ? componentOverrides[component.label]
                  : undefined))
            : undefined;
        const amount =
          configured === 0 ? Number(overrideValue) || 0 : configured;
        totalAmount += amount;
        breakdown.push({
          unitPrice: amount,
          quantity: 1,
          subtotal: amount,
          description: `${service.name} - ${component.label || "Fixed"}`
        });
        return;
      }

      if (pricingType === "variable") {
        const configuredRate = Number(component.amount ?? component.rate) || 0;
        const overrideValue = Array.isArray(componentOverrides)
          ? componentOverrides[index]
          : componentOverrides && typeof componentOverrides === "object"
            ? (componentOverrides[index] ??
                (component.label
                  ? componentOverrides[component.label]
                  : undefined))
            : undefined;
        const rate =
          configuredRate === 0
            ? Number(overrideValue) || 0
            : configuredRate;
        let quantity = 0;

        if (Array.isArray(quantities)) {
          quantity = Number(quantities[index]) || 0;
        } else if (quantities && typeof quantities === "object") {
          if (quantities[index] !== undefined) {
            quantity = Number(quantities[index]) || 0;
          } else if (component.label && quantities[component.label] !== undefined) {
            quantity = Number(quantities[component.label]) || 0;
          }
        }

        if (!quantity && customParameters.distance && index === 0) {
          quantity = Number(customParameters.distance) || 0;
        }

        const subtotal = rate * quantity;
        totalAmount += subtotal;

        breakdown.push({
          unitPrice: rate,
          quantity,
          subtotal,
          description: `${component.label || "Variable"}${component.unit ? ` (${quantity} ${component.unit})` : ` (${quantity})`}`
        });
      }
    });

    const billingDetails = breakdown
      .map((item) => `${item.description}: ₹${item.subtotal}`)
      .join(" + ");

    return {
      totalAmount,
      billingQuantity: 1,
      breakdown,
      billingDetails: billingDetails ? `${billingDetails} = ₹${totalAmount}` : `₹${totalAmount}`
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
  private static calculatePerDate(service: any, startDateTime?: string, endDateTime?: string, timezone: string = 'UTC'): BillingCalculationResult {
    const startDate = startDateTime ? new Date(startDateTime) : new Date();
    const endDate = endDateTime ? new Date(endDateTime) : new Date();

    // Use Intl.DateTimeFormat to get the date parts in the configured timezone
    const getParts = (date: Date, tz: string) => {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false
      });
      const parts: Record<string, number> = {};
      formatter.formatToParts(date).forEach(({ type, value }) => {
        if (type !== 'literal') parts[type] = parseInt(value, 10);
      });
      return parts;
    };

    const p1 = getParts(startDate, timezone);
    const p2 = getParts(endDate, timezone);

    // Create dates at midnight in the respective timezone days
    const d1 = new Date(Date.UTC(p1.year, p1.month - 1, p1.day));
    const d2 = new Date(Date.UTC(p2.year, p2.month - 1, p2.day));

    // Calculate difference in calendar dates
    const timeDiff = d2.getTime() - d1.getTime();
    const daysDiff = Math.floor(timeDiff / (1000 * 3600 * 24)) + 1;
    const billingDays = Math.max(1, daysDiff);

    const totalAmount = service.price * billingDays;
    
    return {
      totalAmount,
      billingQuantity: billingDays,
      breakdown: [{
        unitPrice: service.price,
        quantity: billingDays,
        subtotal: totalAmount,
        description: `${service.name} (${billingDays} calendar day${billingDays > 1 ? 's' : ''})`
      }],
      billingDetails: `Per calendar date: ₹${service.price} × ${billingDays} day${billingDays > 1 ? 's' : ''} = ₹${totalAmount} (${timezone} time)`
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
