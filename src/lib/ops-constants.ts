// Shared (client-safe) constants for the Operations forms.
// The laser-cladding shop-floor journey for a plug, tapped daily by production.
export const OPS_WIP_STAGES = ["Received", "Cladding", "Machining", "Hardfacing", "Grinding", "QC", "Ready to dispatch"] as const;
export type OpsWipStage = (typeof OPS_WIP_STAGES)[number];
