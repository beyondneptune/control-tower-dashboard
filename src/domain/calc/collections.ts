/**
 * Collections / outstanding balance.
 *
 * An invoice's outstanding = invoice total − (cash received + accepted
 * deductions). Deductions (TDS, agreed discounts) reduce the receivable, so
 * they count toward settling the invoice. Over-collection (received + deduction
 * exceeding the invoice) is flagged, not silently absorbed.
 */

export interface CollectionLike {
  amountReceived: number;
  deductionAmount: number;
}

/** Total settled against an invoice (cash + accepted deductions). */
export function totalSettled(collections: CollectionLike[]): number {
  return collections.reduce((s, c) => s + c.amountReceived + c.deductionAmount, 0);
}

/** Outstanding balance on an invoice. Not clamped — can go negative if over-collected. */
export function invoiceOutstanding(invoiceTotal: number, collections: CollectionLike[]): number {
  return invoiceTotal - totalSettled(collections);
}

/** True when settlements exceed the invoice total. */
export function isOverCollected(invoiceTotal: number, collections: CollectionLike[]): boolean {
  return totalSettled(collections) > invoiceTotal + 0.005; // tolerance for float noise
}

export interface CollectionCheck {
  valid: boolean;
  error?: string;
}

/**
 * Validate a proposed new collection against the current outstanding.
 * A collection cannot exceed the remaining balance unless explicitly marked as
 * excess.
 */
export function validateCollection(
  outstanding: number,
  proposed: CollectionLike,
  markedExcess = false,
): CollectionCheck {
  const settle = proposed.amountReceived + proposed.deductionAmount;
  if (settle <= 0) {
    return { valid: false, error: "Collection amount must be positive." };
  }
  if (settle > outstanding + 0.005 && !markedExcess) {
    return {
      valid: false,
      error: `Collection (${settle}) exceeds outstanding balance (${outstanding}). Mark as excess to proceed.`,
    };
  }
  return { valid: true };
}
