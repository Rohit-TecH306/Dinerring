# Dinerring — Phase 0 Architecture

**Status:** Architecture and scope baseline for phased implementation  
**Scope:** Requirements and planning only; no feature in this document is claimed to be implemented or tested  
**Product:** One common multi-tenant platform serving independent restaurants

## 1. Confirmed decisions and scope

Dinerring is one application used by multiple independent restaurants. It is not a separate software installation for each restaurant. Restaurant-owned information and operations must be strictly isolated by the backend.

The initial version supports one branch per restaurant. The data model and authorization model must include branches so that multiple branches can be added later without redesigning the tenant boundary. Initial restaurant managers and staff operate only within their permitted restaurant and branch scope.

The first version focuses on the complete restaurant workflow: table QR access, guest visits, menus, shared ordering, kitchen operations, service tasks, pickup and delivery, combined billing, verified payments, feedback, and optional waiting-time games.

### Confirmed technology stack

| Area | Decision |
|---|---|
| Backend | Node.js, JavaScript ES modules, Express.js |
| Database and ORM | PostgreSQL, Prisma ORM, Prisma migrations |
| Validation and API documentation | Zod, OpenAPI/Swagger |
| Real-time updates | Socket.IO where live updates are appropriate |
| Backend testing | Vitest and Supertest |
| Code quality | ESLint |
| Frontend | React, TypeScript, and Vite, developed separately |
| Architecture | Modular monolith |

Microservices and Redis are not part of the initial implementation. They may be considered only if a demonstrated later need justifies them.

## 2. Actors, authentication, and permissions

| Actor | Responsibilities | Access boundary |
|---|---|---|
| Customer/designated guest | Browse the menu, manage shared orders, track orders, request service, view/pay the combined bill, submit feedback, and play enabled games | One validated active visit, table, branch, and restaurant; no staff or other-table data |
| Kitchen staff | View the branch kitchen queue, accept orders, prepare items, update readiness, add notes, and flag item issues | Authorized restaurant/branch operations only |
| Service staff | Claim and complete tasks, collect ready orders, confirm delivery, and escalate work | Eligible tasks and related orders/tables in authorized branches |
| Restaurant manager | Manage authorized restaurant/branch tables, menus, staff access, orders, tasks, bills, feedback, and reports; override closure with a reason | Assigned restaurant and branches only; sensitive actions are audited |
| Platform administrator | Manage restaurant approval/lifecycle, create initial branches, assign initial managers, and operate platform controls | Separate platform-wide privilege with least privilege and audit logging |

Staff authentication uses secure server-side sessions backed by a persistent session store. Every protected staff operation verifies the authenticated session, permissions, restaurant scope, and branch scope where applicable. Planned controls include secure and appropriately scoped cookies, session expiry and renewal, logout/revocation, CSRF protection where applicable, HTTPS, and secure deployment configuration.

Customers do not need permanent accounts for the initial table-ordering experience. A QR code identifies a table; it does not independently authorize privileged actions. A limited guest session is issued or associated only after the backend validates the QR/table, restaurant, branch, and active table visit. Guest operations must validate the guest session, active visit, table, expiry/revocation state, and permitted action on every request.

## 3. Core workflows

### Table access and shared ordering

1. Authorized staff opens a table visit.
2. A QR code identifies the branch and table. It is not permanent authorization.
3. The backend validates the active visit and creates or resumes a limited anonymous designated-guest session.
4. The guest sees the published branch menu. Unavailable items may remain visible with an `Unavailable` label but cannot be ordered.
5. The guest manages a shared table cart and can submit multiple separate orders during the same visit.
6. For each submission, the backend re-reads menu data, validates items, options, quantities, availability, ordering-pause state, and visit scope, then calculates prices and totals server-side inside an appropriate transaction.
7. Orders are associated with the restaurant, branch, table, and active visit. Each order retains its own lifecycle, timestamps, status history, and purchase-time item/price snapshots.
8. Guests may modify or cancel an order only while it awaits kitchen acceptance. Accepted-order changes require the defined staff workflow and any required guest agreement.
9. Guest sessions expire after inactivity and are invalidated when the visit closes.

One visit can contain multiple separately submitted orders. The combined bill aggregates applicable charges for all eligible orders in that visit; it does not erase the separate order lifecycles or histories.

### Kitchen, pickup, and delivery

Order lifecycle:

`PLACED → ACCEPTED → PREPARING → READY → PICKED_UP → DELIVERED`

Kitchen staff control acceptance and preparation. Service staff control pickup and delivery. Each transition is authorized, validated, timestamped, and recorded. Estimated waiting times and workload alerts are operational estimates, not guarantees. A branch ordering pause blocks new orders server-side while existing orders, tracking, tasks, billing, and payments continue.

If an ordered item becomes unavailable, the system flags it for staff resolution and notifies the designated guest. Substitution requires guest agreement. Cancellation or adjustment updates the applicable bill safely and never silently removes the item.

### Service requests and staff tasks

Customers can request water, cutlery, waiter assistance, extra items, manager assistance, or a bill. Requests belong to the restaurant, branch, table, and active visit. The shared branch task queue supports:

`OPEN → ASSIGNED → IN_PROGRESS → RESOLVED`

Permitted cancellation and escalation states are also supported. Eligible staff claim tasks through an atomic server operation. Configurable response thresholds can flag or escalate overdue unclaimed or unresolved tasks. Tasks already in progress are not silently reassigned.

### Combined billing and payment

One combined bill covers all orders during a table visit. The designated guest can request and view the running bill without closing the visit. Pending orders and non-final charges are clearly distinguished.

Taxes and service charges are configured at the restaurant or branch level, calculated server-side, and snapshotted on the bill. Later configuration changes do not alter an issued bill. The applicable jurisdictional requirements and currency remain unresolved decisions.

The initial payment scope is verified full online payment only. Partial payments and split bills are deferred unless explicitly approved later. A failed payment leaves the bill unpaid. Payment status remains pending until confirmed by a trusted provider webhook or server-to-server check. Signature verification, duplicate and delayed event handling, idempotency, and payment history are required. Raw card data is never stored, and a frontend success response is never proof of payment.

### Visit closure

Normal closure requires resolved orders, a fully paid bill, and closure of required service tasks. An authorized manager may override closure only with a recorded reason in the audit log. Closure must not cancel orders or mark unpaid bills as paid. All guest sessions are invalidated after closure.

### Feedback, games, and future loyalty

After visit orders are resolved, the designated guest may submit one overall rating and optional comments. Feedback is tied to the verified visit and duplicate submissions are prevented. Editing follows a configurable eligibility policy.

Optional waiting-time games may include food trivia, general-knowledge quizzes, and guess-the-dish. They must never block ordering, tracking, service requests, billing, or payment. Results are validated server-side. Loyalty points, rewards, coupons, and other persistent reward systems are deferred until explicitly approved and any required customer-account model exists.

### Connectivity loss

Previously loaded menu data may remain visible in read-only fallback mode with a clear offline indicator. New orders, service requests, and payments require a live server connection. On reconnection, the client refreshes server state and safely retries only eligible actions using idempotency protection. Browser disconnection and frontend payment results never prove payment success.

## 4. Tenant and database architecture

PostgreSQL is the system of record and Prisma manages versioned migrations. The tenant root is `restaurant`. The initial data model creates one branch for each restaurant, while allowing more branches later.

Every tenant-owned record must have an explicit `restaurant_id` or a reliable, enforced relationship through its branch and parent records. Queries and mutations must apply restaurant and authorized branch scope in backend services/repositories; frontend filtering is not a security boundary.

### Core entities

| Entity | Important fields | Relationships and constraints |
|---|---|---|
| `restaurants` | `id`, name, status, settings, timestamps | Tenant root; owns branches, staff assignments, menus/configuration, and audit scope |
| `branches` | `id`, `restaurant_id`, name, timezone, address, status, ordering-paused flag | Belongs to one restaurant; initially one per restaurant; owns tables and branch operations |
| `users` | `id`, name, email, password hash, status | Staff/managers; platform administrators use a separate audited privilege scope |
| `staff_assignments` / roles | user, restaurant, optional branch, role | Explicit restaurant and optional branch authorization |
| `staff_sessions` | user, persistent-session reference, expiry, revoked-at, timestamps | Server-side lifecycle; do not store raw session secrets unnecessarily |
| `tables` | `id`, `branch_id`, label, capacity, status, QR version | Unique label within a branch; has visits, orders, and tasks |
| `table_visits` | restaurant/branch/table, status, opened/closed by, timestamps, closure reason | Staff-controlled visit boundary; enforce one active visit per table as configured |
| `guest_sessions` | visit, token hash/reference, expiry, last activity, revoked-at | Anonymous designated-guest access; invalid after expiry or visit closure |
| `menu_categories` / `menu_items` | branch/category, name, description, price, image URL, availability, status | Published menu scope; unavailable items remain displayable but cannot be ordered |
| Customization groups/options | item scope, name, price delta, availability | Validated against the current menu at submission |
| `orders` | restaurant, branch, table, visit, status, totals, idempotency key, timestamps | Multiple orders per visit; unique idempotency scope; server-calculated totals |
| `order_items` | order, item snapshot, quantity, unit price, notes, line total | Preserves purchase-time values, substitutions, and adjustments |
| `order_status_history` | order, from/to status, actor, timestamp, metadata | Immutable lifecycle audit |
| `service_requests` | restaurant/branch/table/visit, type, priority, status, due time | Shared branch task queue |
| `task_assignments` | request/order, staff, claim/close timestamps | Atomic claim and ownership record |
| `bills` | restaurant/branch/table/visit, totals, tax/charge snapshots, status | One combined bill per visit; pending/final amounts are explicit |
| `payments` / `payment_events` | bill, provider reference, amount, status, event ID, timestamps | Unique provider events; idempotent processing |
| `feedback` | restaurant/branch/visit, rating, comments, edit metadata | One eligible overall submission per visit; scoped access |
| `games` / `game_attempts` | restaurant/branch configuration, session, result, score, timestamps | Server-validated attempts; no initial monetary/points rewards |
| `audit_logs` | actor, tenant/branch scope, action, entity, metadata, timestamp | Immutable record for sensitive changes and state overrides |

Use primary keys, explicit foreign keys, and deliberate delete behavior. Add indexes for tenant/branch scope, active visits and sessions, order/task statuses, timestamps, and payment references. Use database constraints for branch-scoped table labels, active visit rules, idempotency keys, provider event IDs, and other invariants that should not depend solely on application code. Use transactions for order creation, bill updates, state transitions where needed, task claims, and payment-event handling.

## 5. System architecture

```text
Customer / staff / manager React clients
                |
        REST API + Socket.IO
                |
 Express modular monolith (JavaScript ES modules)
 auth | tenants | branches | tables | visits | menu | orders |
 kitchen | tasks | billing | payments | feedback | engagement | admin
                |
             Prisma ORM
                |
            PostgreSQL
```

The frontend owns presentation, local UI state, offline indicators, and API consumption. The backend owns authentication, authorization, tenant isolation, session validity, menu availability, totals, state transitions, payment verification, persistence, and audit history.

Expose versioned REST endpoints under `/api/v1` and document them with OpenAPI/Swagger. REST is the source of truth. Socket.IO provides appropriate live kitchen, order, task, pickup, delivery, and bill updates; it does not bypass authorization or persistence rules.

Background jobs may support inactivity expiry, overdue-task escalation, notifications, operational aggregation, and retryable provider work. Payment webhooks use a dedicated endpoint with signature verification and idempotent event handling. No payment provider or deployment provider is selected in Phase 0.

## 6. Security and cross-cutting standards

- Never trust client prices, totals, taxes, charges, availability, permissions, statuses, game scores, or payment results.
- Calculate menu prices and order totals on the server from current authoritative data, then preserve purchase-time snapshots.
- Verify every protected staff action against authentication, permissions, restaurant scope, and branch scope.
- Verify every customer mutation against the guest session, active visit/table, expiry, and allowed state.
- Validate and record order and service-task state transitions; do not accept arbitrary client-supplied statuses.
- Verify payment signatures/provider status; never mark a bill paid from frontend state.
- Use idempotency keys and database constraints for order submissions, payment events, retries, and other repeatable actions.
- Use secure server-side sessions, secure cookie attributes, expiry, logout/revocation, renewal policy, CSRF protection where applicable, HTTPS, strict CORS, rate limiting, secure password hashing, and appropriate security headers.
- Keep secrets in environment variables or an approved secret store; never commit them. Validate required configuration at startup.
- Use centralized error middleware with stable codes, safe messages, request IDs, and correct HTTP status codes.
- Use safe structured logs containing request ID, actor, tenant, route, duration, and outcome; redact credentials, session data, payment data, and sensitive personal data.
- Do not expose passwords, raw session secrets, raw payment data, internal notes, or cross-tenant records.
- Use Prisma migrations with a documented production migration procedure.
- Test tenant isolation, authorization, state transitions, transactions, idempotency, payment webhooks, and important business rules with Vitest and Supertest; add end-to-end workflow coverage later.
- Document authentication/session rules, permissions, status enums, error formats, examples, and Socket.IO events in OpenAPI and related API documentation.

## 7. Initial scope and deferred features

The initial implementation should complete the restaurant workflow before expanding platform complexity. The following remain deferred or optional until the core system works:

- Loyalty points and rewards.
- Advanced games and reward systems.
- Advanced analytics.
- Full multi-branch management and branch administration UX; the schema and authorization model must still support future branches.
- Complex POS/KDS integrations.
- Offline order submission.
- Partial payments and split bills, unless explicitly approved later.

Existing requirements for administration, QR identification, visits, menus, availability, shared ordering, kitchen flow, service requests, pickup/delivery, combined billing, verified payments, closure, feedback, games, audit logs, and operational monitoring remain in scope or planned in the phases below.

## 8. Implementation roadmap

| Phase | Objective | Key deliverables | Major dependencies |
|---|---|---|---|
| 0. Architecture and scope | Confirm boundaries, workflows, security, and sequencing | This architecture baseline; confirmed/deferred/unresolved decisions; domain and tenant model | Product decisions captured here |
| 1. Backend foundation and database setup | Establish the runnable modular-monolith foundation | Project structure, ES modules, Express bootstrap, configuration, error/logging conventions, Prisma/PostgreSQL setup, initial migration strategy, lint/test harness | Phase 0; PostgreSQL environment |
| 2. Authentication and security | Protect staff access and establish security primitives | Password hashing, server-side staff sessions, cookies, expiry, logout/revocation, CSRF approach, authorization middleware, request validation, rate/security controls | Phase 1; session-store decision; CSRF decision |
| 3. Restaurants, tables, QR identification, and table visits | Establish tenant/branch/table boundaries and guest visit lifecycle | Restaurant/branch administration primitives, table records, QR identification, open/validate/close visits, guest sessions, isolation tests | Phases 1–2; tenant administration decision |
| 4. Menu categories, items, availability, and menu APIs | Publish scoped menus safely | Categories/items/options, server-side availability, ordering pauses, menu APIs, scope and validation tests | Phase 3; restaurant/branch configuration |
| 5. Shared cart and order creation | Support repeated guest orders in one visit | Shared cart flow, multiple orders per visit, server validation/pricing, snapshots, idempotency, order APIs, order-rule tests | Phases 3–4; order-adjustment policy |
| 6. Kitchen workflow and order tracking | Operate and observe order lifecycles | Kitchen queue, validated transitions/history, estimates, issue handling, staff/customer updates, transition tests | Phase 5; Socket.IO conventions |
| 7. Service requests and staff tasks | Manage customer assistance through a branch queue | Request types, task lifecycle, atomic claims, assignment/escalation rules, notifications/monitoring hooks | Phase 3 and Phase 6; task-threshold decision |
| 8. Pickup and delivery | Complete handoff operations | Pickup/delivery actions, staff authorization, timestamps, guest tracking, handoff tests | Phase 6; Phase 7 where tasks are linked |
| 9. Combined billing and payments | Aggregate visit charges and verify payment | Running/final bills, charge snapshots, full online payment flow, provider abstraction, webhook verification, idempotency, closure prerequisites | Phases 5–8; tax/currency/provider decisions |
| 10. Optional waiting-time games | Add non-blocking engagement | Game catalog/configuration, server-validated attempts, limits, isolation from core workflows | Phase 3; engagement decisions |
| 11. Loyalty and rewards, deferred | Add persistent reward features only after approval | Account/reward model and rules if approved | Core workflow stable; explicit product approval |
| 12. Feedback and analytics | Capture feedback and useful operational insight | Visit feedback eligibility/editing, reporting and analytics that do not weaken tenant isolation | Phases 3, 6, and 9; feedback policy |
| 13. Security hardening, integration testing, deployment, and documentation | Prepare for controlled release | Threat review, tenant/authorization audit, integration and end-to-end tests, operational monitoring, deployment runbook, API/user documentation | All required prior phases; deployment/retention decisions |

## 9. Unresolved decisions

These decisions must be resolved before the affected implementation phase. No unresolved detail should be silently assumed in application code.

1. **Restaurant onboarding:** Can restaurants self-register, or does a platform administrator approve/create each restaurant? This remains open.
2. **Session implementation:** Persistent session-store technology, staff/guest inactivity durations, cookie lifetime, and renewal timing.
3. **CSRF policy:** Exact mechanism and endpoint exclusions once the cookie/session design is finalized.
4. **Branch authorization:** Whether a manager may operate all current/future branches by default or only explicitly assigned branches.
5. **Order adjustments:** Staff workflow for accepted-order edits, substitutions, cancellations, and guest approval timeouts.
6. **Task escalation:** Response thresholds, supervisor role, and notification channels.
7. **Billing and tax:** Currency, jurisdictional tax rules, service-charge policy, rounding, and bill retention requirements.
8. **Payment provider:** Provider, supported region, payment methods, webhook contract, and operational reconciliation process.
9. **Feedback editing:** Editing window and eligibility policy after the one allowed visit submission.
10. **Engagement launch:** Initial game catalog, attempt limits, and whether games are available throughout the visit or only under conditions.
11. **Integrations:** First POS/KDS integration targets and compatibility requirements.
12. **Deployment and operations:** Provider, regions, availability target, monitoring, backups, retention, and session-store hosting.

