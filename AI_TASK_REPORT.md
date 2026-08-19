# AI Task Report — Phase 4D Atelier Assignment Workflow

## TASK_STATUS

COMPLETE (source + automated tests + local API QA). Preview browser QA deferred: credential rotation required.

## STARTING_SHA

`ad2ed7392829dc18c78adbf459ff06eda6ece2d9`

## ENDING_SHA

See commit after this report is included.

## REMOTE_SHA

Set after push. If push is blocked, local SHA is recorded and REMOTE is unchanged.

## SUBAGENT_EXECUTION_SUMMARY

Lead implemented centrally after a short contract pass. Graphify was queried for the assignment graph; the existing graph is stale (`3c0a5dd3`) and the query drifted to try-on handlers. Source files were treated as authoritative. No additional implementation subagents were launched — the blast radius was already known from the takeover audit.

## GRAPHIFY_FINDINGS

- Graph built from `3c0a5dd3` (stale vs `ad2ed73`).
- Query for `assignedStaffId` / production-handler did not surface the Phase 4C production community first; it returned try-on/security nodes.

## GRAPHIFY_SOURCE_DISCREPANCIES

Trust source. Authoritative assignment path:

`ProductionJob.assignedStaffId` → `validateAssignedStaffId` → `lib/production-handler.ts` (create + PATCH) → `canUpdateProductionJob` / OWNER-MANAGER reassignment → `AtelierDashboard` / `OrderProduction` → `tests/production.test.ts`.

## ARCHITECTURE_DECISIONS

- Reused existing `assignedStaffId` on `ProductionJob`. No Staff table. No migration.
- Assignee source is a safe projection of `AUTH_USERS_JSON` / `AUTH_USERS_JSON_BASE64` (`MASTER_TAILOR` only).
- Added flat action `production:assign` (OWNER/MANAGER). Not bundled with `production:update`.
- Assignment history table not added. Current assignee is persisted; stage history remains the production timeline.

## ASSIGNMENT_CONTRACT

- View current assignee: already on job payload.
- Assign / reassign: `PATCH /api/production/{jobId}` `{ toStage, assignedStaffId }` with `toStage` equal to current stage for assignment-only updates.
- Create-time assign: `POST /api/orders/{orderId}/production` `{ assignedStaffId? }`.
- List candidates: `GET /api/production/assignees` → `{ assignees: [{ username, displayName, role }] }`.
- Clear assignment: `assignedStaffId: null`.
- Actor, timestamps, and eligibility are server-owned.

## ASSIGNEE_SOURCE

`lib/customer/staff-directory.ts` reads `getAuthorizedUsers()`, keeps `MASTER_TAILOR` only, strips `passwordHash`. Injectable in tests.

## ASSIGNMENT_HISTORY_DECISION

Not implemented. Disproportionate for Phase 4D. Current assignment is enough. Stage changes still append `ProductionStageHistory`.

## DATABASE_CHANGES

None.

## BACKEND_CHANGES

- `production:assign` grant
- Allowlist assignee validation on create/reassign
- `GET /api/production/assignees`
- `AuthConfigurationError` mapped to 503 in `mapDomainErrorToResponse`

## FRONTEND_CHANGES

- `ProductionAssignment` control
- Order Production: assign on start + assign/reassign on existing jobs
- Atelier Dashboard: Incoming column (`CONFIRMED` / `FABRIC_READY`) + assign/reassign for authorized callers
- Unauthorized callers (assignees GET 403/503) see read-only username text

## PERMISSION_CHANGES

| Action | OWNER | MANAGER | STAFF | STYLE_CONSULTANT | MASTER_TAILOR | QC_STAFF |
|---|---|---|---|---|---|---|
| `production:assign` | ✓ | ✓ | | | | |

Existing production read/update scoping unchanged.

## SECURITY_RESULTS

Covered in `tests/production.test.ts`:

- Owner/Manager assign + reassign + persist
- Staff / Style Consultant / Master Tailor / QC cannot assign or list assignees
- Master Tailor cannot self-assign
- STAFF username and unknown pattern-valid usernames rejected (400)
- Unknown job 404
- Forged `changedBy` 400
- Unauthenticated list 401
- Missing allowlist 503
- Assignee payload has no `passwordHash`

## TEST_RESULTS

`npm test` PASS — 444 tests (317 + 117 + 4 + 6), 0 fail.

## LINT

`npm run lint` PASS

## TYPECHECK

`npm run typecheck` PASS (after removing stale Finder-duplicate files under `.next/types`, which is gitignored)

## BUILD

`npm run build` PASS. New route: `/api/production/assignees`.

## LOCAL_BROWSER_QA

No browser MCP in this session. Local `next dev` used as substitute:

- `GET /atelier` 200; dashboard SSR includes “Atelier Dashboard”
- `GET /api/production` 200 (0 jobs in this local DB)
- `PATCH` unknown job 404
- `PATCH` with `changedBy` 400
- `GET /api/production/assignees` 503 — local allowlist is not a valid generated `AUTH_USERS_JSON_BASE64` (fail-closed). Interactive assign dropdown therefore stays hidden until a real allowlist with at least one `MASTER_TAILOR` is configured.

Role-matrix UI clicks (Manager vs Tailor vs QC) were verified by automated handler tests, not by a headed browser.

## PREVIEW_STATUS

Not deployed by this agent. Feature branch work only.

## PREVIEW_QA_BLOCKER

`credential rotation required`

Do not treat this as an application defect. Use `npm run auth:create-user -- showroom "Showroom Staff" STAFF` (interactive TTY) and set Preview-only `AUTH_USERS_JSON_BASE64`. Include at least one `MASTER_TAILOR` entry if Preview assignment dropdown should be non-empty.

## COMMITTED

Yes — `feat(atelier): add production assignment workflow`

## PUSHED

See final response. If the environment blocks publish, local SHA is reported honestly.

## OPENAI_CALLED

No.

## PRODUCTION_AFFECTED

No.

## KNOWN_LIMITATIONS

- Preview STAFF credentials still write-only / unknown
- Local `.env.local` may not contain a parseable allowlist with `MASTER_TAILOR` identities
- Assignment history is not recorded beyond current `assignedStaffId`
- No fabric edit/retire UI (unchanged)
- Single Preview/dev database (unchanged)

## NEXT_RECOMMENDED_TASK

Rotate Preview credentials (include `showroom` plus at least one `MASTER_TAILOR`) and run Preview browser QA of assign/reassign. Then, if the atelier needs it: fabric catalogue edit/retire UI, or dedicated Production database provisioning.
