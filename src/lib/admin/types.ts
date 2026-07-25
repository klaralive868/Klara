// An organization's status, from the admin portal's point of view — derived
// from its owner membership row, not stored directly. 'pending' means the
// owner hasn't clicked their invite link and set a password yet; 'active'
// means they have. 'no-owner' is a defensive fallback for a data anomaly
// (an org with no owner row at all) that shouldn't happen through this
// app's own provisioning flow, but isn't structurally impossible.
export type AdminOrganizationStatus = 'pending' | 'active' | 'no-owner';

export interface AdminOrganizationRow {
	id: string;
	name: string;
	slug: string;
	ownerEmail: string | null;
	status: AdminOrganizationStatus;
	createdAt: string;
	memberCount: number;
}
