// The old /alerts page rendered STATIC Sprint-1 seed data (frozen at AS_OF =
// 31 May) and was redundant with the MD Dashboard (/) and MD Workspace
// (/workspace), which both read the LIVE exception engine (v_ct_exceptions_open
// / v_ct_md_exceptions). The tab was removed from the nav; this stub keeps any
// old bookmark working by sending it to the live exception queue instead of
// ever showing stale numbers.
import { redirect } from "next/navigation";

export default function AlertsPage() {
  redirect("/workspace");
}
