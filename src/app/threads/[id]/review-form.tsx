"use client";

// Day 11 (post-validation remediation): reviewer form split + cascade.
//
// Changes from Day 9 version (per MD instruction):
//   - Question 1: "Is this a real business thread?" (replaces the old
//     "Should this thread show up on the MD dashboard?" which Rahul
//     misread as "is this a real thread?" during Day 10 validation.)
//   - Question 2: "Should this be shown on the MD dashboard now?" with a
//     warning: "Only say yes if customer, stage and evidence are strong
//     enough for management reporting."
//   - Cascade: if customer_correct=false OR stage_correct=false, the
//     dashboard answer is locked to "No" (and the server action enforces
//     this too — see actions.ts).
//   - Submit button debounce: prevents double-clicks (Day 10 produced
//     duplicate rows on threads f2825604 and 1084560f).

import { useState, useTransition } from "react";
import Link from "next/link";
import { saveThreadReview } from "./actions";

interface Props {
  threadId: string;
  customerName: string | null;
  currentStage: string;
  defaultReviewer?: string;
  existingReviewerNames?: string[];
}

export function ReviewForm({ threadId, customerName, currentStage, defaultReviewer = "", existingReviewerNames = [] }: Props) {
  const [customerCorrect, setCustomerCorrect] = useState<"" | "true" | "false">("");
  const [stageCorrect, setStageCorrect] = useState<"" | "true" | "false">("");
  const [tallyLinkCorrect, setTallyLinkCorrect] = useState<"" | "yes" | "no" | "not_applicable">("");
  const [isRealBusinessThread, setIsRealBusinessThread] = useState<"" | "true" | "false">("");
  const [shouldPromote, setShouldPromote] = useState<"" | "true" | "false">("");
  const [reviewerNote, setReviewerNote] = useState("");
  const [reviewer, setReviewer] = useState(defaultReviewer);
  const [isPending, startTransition] = useTransition();

  const youAlreadyReviewed = !!defaultReviewer && existingReviewerNames.includes(defaultReviewer);
  const othersWhoReviewed = existingReviewerNames.filter((n) => n !== defaultReviewer);

  // Cascade rule: any "false" on customer/stage forces promote to "false".
  const dashboardLockedToNo = customerCorrect === "false" || stageCorrect === "false";
  const effectiveShouldPromote = dashboardLockedToNo ? "false" : shouldPromote;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isPending) return;
    const fd = new FormData(e.currentTarget);
    fd.set("should_promote", effectiveShouldPromote);
    startTransition(() => {
      saveThreadReview(fd);
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 px-4 py-3 text-sm">
      <input type="hidden" name="thread_id" value={threadId} />

      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">
          Your name (auto-filled from your login{defaultReviewer ? ` — ${defaultReviewer}` : ""}; edit only if you want a different attribution)
        </span>
        <input
          type="text"
          name="reviewer"
          required
          value={reviewer}
          onChange={(e) => setReviewer(e.target.value)}
          placeholder="e.g. MD, Rahul, Arjun"
          className="rounded border bg-background px-2 py-1.5 text-sm"
        />
        {youAlreadyReviewed && (
          <p className="text-[11px] text-amber-700 dark:text-amber-400">
            You already submitted a review under this name. Saving again will <strong>update your existing row</strong> (no duplicates created).
          </p>
        )}
        {othersWhoReviewed.length > 0 && (
          <p className="text-[11px] text-muted-foreground">
            Already reviewed by: {othersWhoReviewed.join(", ")}. Your save will be a separate row — others&apos; reviews are preserved.
          </p>
        )}
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">
          Is the customer right? (The thread says <strong>{customerName || "(unknown)"}</strong>.)
        </span>
        <select
          name="customer_correct"
          required
          value={customerCorrect}
          onChange={(e) => setCustomerCorrect(e.target.value as "" | "true" | "false")}
          className="rounded border bg-background px-2 py-1.5 text-sm"
        >
          <option value="">— pick one —</option>
          <option value="true">Yes — customer is right</option>
          <option value="false">No — wrong customer</option>
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">
          Is the lifecycle stage right? (The thread says <strong>{currentStage}</strong>.)
        </span>
        <select
          name="stage_correct"
          required
          value={stageCorrect}
          onChange={(e) => setStageCorrect(e.target.value as "" | "true" | "false")}
          className="rounded border bg-background px-2 py-1.5 text-sm"
        >
          <option value="">— pick one —</option>
          <option value="true">Yes — stage is right</option>
          <option value="false">No — should be a different stage</option>
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">
          Is the Tally link right? (Pick N/A if there&apos;s no Tally evidence to validate.)
        </span>
        <select
          name="tally_link_correct"
          required
          value={tallyLinkCorrect}
          onChange={(e) => setTallyLinkCorrect(e.target.value as "" | "yes" | "no" | "not_applicable")}
          className="rounded border bg-background px-2 py-1.5 text-sm"
        >
          <option value="">— pick one —</option>
          <option value="yes">Yes — the Tally invoice/bill matches</option>
          <option value="no">No — the Tally link is wrong or misleading</option>
          <option value="not_applicable">N/A — no Tally link to evaluate</option>
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">
          1) Is this a real business thread? (i.e. a genuine RFQ / PO / invoice
          / production matter — not spam, not a system notification.)
        </span>
        <select
          name="is_real_business_thread"
          required
          value={isRealBusinessThread}
          onChange={(e) => setIsRealBusinessThread(e.target.value as "" | "true" | "false")}
          className="rounded border bg-background px-2 py-1.5 text-sm"
        >
          <option value="">— pick one —</option>
          <option value="true">Yes — real business thread</option>
          <option value="false">No — noise / system / wrong inbox</option>
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">
          2) Should this be shown on the MD dashboard now?
        </span>
        <select
          name="should_promote_input"
          required
          value={effectiveShouldPromote}
          onChange={(e) => setShouldPromote(e.target.value as "" | "true" | "false")}
          disabled={dashboardLockedToNo}
          className="rounded border bg-background px-2 py-1.5 text-sm disabled:opacity-60"
        >
          <option value="">— pick one —</option>
          <option value="true">Yes — show on MD dashboard</option>
          <option value="false">No — hold as dry-run</option>
        </select>
        {dashboardLockedToNo ? (
          <p className="text-[11px] text-amber-600">
            Locked to <strong>No</strong> because either customer or stage is marked wrong.
            Fix those first if this thread should still be promoted.
          </p>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            Only say yes if customer, stage and evidence are strong enough for management reporting.
          </p>
        )}
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Note (optional)</span>
        <textarea
          name="reviewer_note"
          rows={3}
          value={reviewerNote}
          onChange={(e) => setReviewerNote(e.target.value)}
          className="rounded border bg-background px-2 py-1.5 text-sm"
          placeholder="Anything we should know about this thread"
        />
      </label>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {isPending ? "Saving…" : "Save review"}
        </button>
        <Link href="/threads/validation" className="text-xs text-muted-foreground hover:underline">
          Skip and go back to list
        </Link>
      </div>
    </form>
  );
}
