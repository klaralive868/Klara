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

// A member of a genuinely different organization, for cross-organization
// denied-access checks (e.g. catalog-item-crud.spec.ts).
export const SECOND_ORG_EMAIL = 'e2e-second-org-member@example.com';
export const SECOND_ORG_PASSWORD = 'password123';

// catalog-item-crud.spec.ts's own dedicated user (same org as TEST_USER_EMAIL)
// — its 3 sign-ins would otherwise share TEST_USER_EMAIL's rate-limit bucket
// with auth.spec.ts's own several sign-ins and push the combined total over
// the 5/15min limit, exactly the collision INVITER_EMAIL exists to avoid.
export const CATALOG_OWNER_EMAIL = 'e2e-catalog-owner@example.com';
export const CATALOG_OWNER_PASSWORD = 'password123';

// catalog-categories.spec.ts's own dedicated user, same reasoning as
// CATALOG_OWNER_EMAIL — kept separate so its sign-ins don't share a
// rate-limit bucket with catalog-item-crud.spec.ts's.
export const CATEGORIES_OWNER_EMAIL = 'e2e-categories-owner@example.com';
export const CATEGORIES_OWNER_PASSWORD = 'password123';

// catalog-images.spec.ts's own dedicated user, same reasoning as the other
// catalog spec-file-scoped users above.
export const IMAGES_OWNER_EMAIL = 'e2e-images-owner@example.com';
export const IMAGES_OWNER_PASSWORD = 'password123';

// catalog-stock.spec.ts's own dedicated user, same reasoning as the other
// catalog spec-file-scoped users above.
export const STOCK_OWNER_EMAIL = 'e2e-stock-owner@example.com';
export const STOCK_OWNER_PASSWORD = 'password123';

// catalog-list-table.spec.ts's own dedicated user, same reasoning as the
// other catalog spec-file-scoped users above.
export const LIST_TABLE_OWNER_EMAIL = 'e2e-list-table-owner@example.com';
export const LIST_TABLE_OWNER_PASSWORD = 'password123';
