// Shared by every place that validates a plain email address — the public
// booking form, the public inquiry form, and the dashboard's customer
// quick-create — one pattern, not copies that could drift.
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
