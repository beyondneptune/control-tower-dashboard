// Day 11 multi-reviewer support: derive the canonical reviewer name used in
// thread_validation_reviews.reviewer from the logged-in Supabase user.
//
// Why a lookup map rather than profile.name?
//   The reviewer field stays a free-text string for historical continuity —
//   "MD" reviewed 4 threads on Day 11 v2 launch under the literal string "MD",
//   not "Meridian MD". Arjun and Rahul expect to see their first-name only.
//
// Add new entries here when a new reviewer is provisioned.

const NAME_BY_EMAIL = new Map<string, string>([
  ["md@meridian.example", "MD"],
  ["arjun@meridian.example", "Arjun"],
  ["finance@meridian.example", "Rahul"],
  ["production@meridian.example", "Production"],
]);

export interface ReviewerIdentity {
  email: string | null;
  name: string;
  role: string | null;
}

export function reviewerNameFromUser(user: { email?: string | null; app_metadata?: Record<string, unknown> } | null | undefined): ReviewerIdentity {
  const email = user?.email?.toLowerCase() || null;
  const role = (user?.app_metadata?.role as string | undefined) || null;
  if (!email) return { email: null, name: "", role };
  const mapped = NAME_BY_EMAIL.get(email);
  if (mapped) return { email, name: mapped, role };
  return { email, name: email.split("@")[0], role };
}
