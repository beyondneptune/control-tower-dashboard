// Canonical PIPL↔Tally link-method classification (Codex #12).
//
// These MUST stay in lockstep with the bridge that WRITES the methods
// (scripts/email/bridge-pipl-to-tally-v4.mjs) and the promotion tiers that GRADE them
// (scripts/email/compute-promotion-tiers.mjs). The script-side mirror lives in
// scripts/email/link-methods.mjs — change both together. Previously the order-book page
// hard-coded its own subset and silently dropped `L1_exact_po_amount_date_match`, pushing
// genuinely PO-anchored threads into "data required".

// True anchors — a high-confidence link good enough for the "verified"/"inferred" lanes.
export const STRONG_LINK_METHODS = [
  "L1_exact_pipl_same_thread",
  "L1_exact_po_amount_date_match",
  "L2_customer_pipl_date_proximity",
] as const;

// Weak/ambiguous links — never strong on their own.
export const AMBIGUOUS_LINK_METHODS = [
  "L4_ambiguous",
  "L2_customer_pipl_ambiguous",
] as const;

export function isStrongLinkMethod(method: string | null | undefined): boolean {
  return !!method && (STRONG_LINK_METHODS as readonly string[]).includes(method);
}
