import { describe, it, expect } from "vitest";
import { canAccess, visibleNav, isReadOnly } from "./rbac";

describe("canAccess", () => {
  it("grants MD master access to everything", () => {
    expect(canAccess("md", "user-management")).toBe(true);
    expect(canAccess("md", "cash")).toBe(true);
    expect(canAccess("md", "audit-log")).toBe(true);
  });

  it("blocks production from cash control", () => {
    expect(canAccess("production", "cash")).toBe(false);
  });

  it("lets finance into cash but not user management", () => {
    expect(canAccess("finance", "cash")).toBe(true);
    expect(canAccess("finance", "user-management")).toBe(false);
  });

  it("blocks quality from finance modules", () => {
    expect(canAccess("quality", "cash")).toBe(false);
    expect(canAccess("quality", "ct-qc")).toBe(true);
  });
});

describe("visibleNav", () => {
  it("returns only the modules a role may open", () => {
    const nav = visibleNav("quality");
    expect(nav.some((n) => n.key === "ct-qc")).toBe(true);      // quality opens QC / NCR
    expect(nav.some((n) => n.key === "workspace")).toBe(true);  // and its workspace
    expect(nav.some((n) => n.key === "cash")).toBe(false);      // but never finance cash
  });

  it("gives MD every module", () => {
    expect(visibleNav("md").length).toBeGreaterThanOrEqual(17);
  });
});

describe("isReadOnly", () => {
  it("marks auditor read-only and MD not", () => {
    expect(isReadOnly("auditor")).toBe(true);
    expect(isReadOnly("md")).toBe(false);
  });
});
