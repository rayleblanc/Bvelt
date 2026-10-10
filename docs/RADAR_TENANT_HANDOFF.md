# Bvelt Radar Tenant Integration Handoff

1. Radar service operates in tenant mode (`mode=tenant`) using tenant_id for scoped opportunity feeds.
2. Bvelt will call Radar later using a founder service key and endpoint configured via `VITE_RADAR_TENANT_URL`.
3. Calls to Radar will only be active when feature flag `ENABLE_RADAR_TENANT=1` (or true) is enabled.
4. Today, Bvelt relies exclusively on `jobFinderEngine` for local opportunity discovery and map signal scanning.
5. The `TenantOpportunityPort` interface (`src/services/tenantOpportunityPort.ts`) provides a thin abstraction layer.
6. `EmptyTenantOpportunityPort` serves as the current default implementation returning empty arrays `[]`.
7. Future integration will implement `RadarTenantOpportunityPort` implementing `TenantOpportunityPort`.
8. `jobFinderEngine` can merge results from `TenantOpportunityPort` alongside local cascade sources when enabled.
9. No active production network requests to external Radar tenants are made in current release.
10. Tenant identification remains tied to `auth.currentUser.uid` or provisioned profile ID.
