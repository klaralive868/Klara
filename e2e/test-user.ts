export const TEST_USER_EMAIL = 'e2e-member@example.com';
export const TEST_USER_PASSWORD = 'password123';

// A second, separate active user so invite-claim.spec.ts's sign-ins don't
// share a rate-limit bucket with auth.spec.ts's — the limiter is keyed by
// email, and the whole suite's cumulative sign-in attempts for one email
// would otherwise exceed the 5/15min limit and make the suite flaky.
export const INVITER_EMAIL = 'e2e-inviter@example.com';
export const INVITER_PASSWORD = 'password123';

// An active manager (not owner) in the same org, for testing that a manager
// cannot escalate an invitee straight to owner.
export const MANAGER_EMAIL = 'e2e-manager@example.com';
export const MANAGER_PASSWORD = 'password123';

// An active member who is also an operator, for testing the (admin) guard
// and the dashboard's Admin dropdown.
export const OPERATOR_EMAIL = 'e2e-operator@example.com';
export const OPERATOR_PASSWORD = 'password123';

// Every invitee created by invite-claim.spec.ts uses this prefix so
// global-teardown can find and remove them without tracking individual ids.
export const INVITEE_EMAIL_PREFIX = 'e2e-invitee-';
