"use client";

/**
 * Cosmetic UI role, driven by the authenticated Supabase session (the `role`
 * claim in app_metadata — which the user cannot edit). This decides only which
 * menus/pages are *shown*; it is NOT a security boundary. Real enforcement is
 * RLS + server checks in the database. Defaults to the least-privileged role
 * until the session resolves, so nothing privileged ever flashes.
 */

import { create } from "zustand";
import type { Role } from "@/domain/types";

interface RoleState {
  role: Role;
  ready: boolean;
  setRole: (role: Role) => void;
  clear: () => void;
}

export const useRole = create<RoleState>((set) => ({
  role: "auditor",
  ready: false,
  setRole: (role) => set({ role, ready: true }),
  clear: () => set({ role: "auditor", ready: false }),
}));
