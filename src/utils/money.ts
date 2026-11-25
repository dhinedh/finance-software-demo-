/**
 * Financial Currency Utilities
 * Strictly uses integer paise (1 Rupee = 100 paise) to eliminate JavaScript floating-point rounding errors.
 */

export function toPaise(rupees: number | string): number {
  if (typeof rupees === 'string') {
    // Strip commas, currency symbols, and extra spaces
    const cleanStr = rupees.replace(/[^0-9.-]/g, '');
    const parsed = parseFloat(cleanStr);
    if (isNaN(parsed)) return 0;
    return Math.round(parsed * 100);
  }
  return Math.round(rupees * 100);
}

export function toRupees(paise: number): number {
  return (paise || 0) / 100;
}

export function formatINR(paise: number, showDecimals: boolean = true): string {
  const rupees = toRupees(paise);
  const isNegative = rupees < 0;
  const absVal = Math.abs(rupees);
  
  const options: Intl.NumberFormatOptions = {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  };
  
  const formatted = new Intl.NumberFormat('en-IN', options).format(absVal);
  return `${isNegative ? '-' : ''}₹${formatted}`;
}

export function formatINRCompact(paise: number): string {
  const rupees = toRupees(paise);
  if (Math.abs(rupees) >= 10000000) {
    return `₹${(rupees / 10000000).toFixed(2)} Cr`;
  }
  if (Math.abs(rupees) >= 100000) {
    return `₹${(rupees / 100000).toFixed(2)} L`;
  }
  if (Math.abs(rupees) >= 1000) {
    return `₹${(rupees / 1000).toFixed(1)} K`;
  }
  return formatINR(paise, false);
}

export function parseFormattedINRToPaise(input: string): number {
  return toPaise(input);
}
