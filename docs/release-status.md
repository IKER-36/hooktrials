# Current release status

Updated: 1 August 2026.

## Release `v0.33.8` — Contextual reliability journey

Released 1 August 2026. The workspace now makes the operational path visible while you work,
so each module points naturally to the next place to connect, inspect, measure, recover and prove.

### Added

- A compact workflow strip is available across Home, Webhook Hub, Control Center, Monitoring,
  Operations and Evidence.
- Each step links to its owning workspace and highlights the current destination.
- The workflow remains usable on small screens, with a three-column layout and clear labels.

### Improved

- Navigation context is visible without duplicating the global sidebar or hiding secondary modules.
- Keyboard focus, hover states and reduced-motion behavior follow the shared dashboard contract.
- The sequence keeps the product story concrete: connect traffic, inspect delivery, measure
  dependencies, recover incidents and retain evidence.

No database migration or user action is required.

## Release `v0.33.7` — Actionable Home dashboard

Released 1 August 2026. Home now helps you move from a signal to the next useful action without
leaving the workspace overview.

### Added

- A time-window selector for monitor coverage and reliability checks: 24 hours, 7 days or 30 days.
- Home metric surfaces now link directly to Webhook Hub, Trial endpoints, Monitoring or Operations.
- A live “Updated” indicator makes the refresh cadence visible.

### Improved

- Availability charts and check counts now identify the selected period instead of always implying
  a fixed window.
- Metric links have visible hover and keyboard-focus treatments while preserving the compact grid.
- The dashboard keeps its existing responsive and reduced-motion behavior across the new controls.

No database migration or user action is required.

## Release `v0.33.6` — Unified operational timeline

Released 1 August 2026. Operations now starts with one chronological view of the signals that need
attention, while the existing incident, recovery and alert workspaces remain available below it.

### Added

- A **What changed recently** timeline combines incidents, dead-letter recovery and alert delivery
  evidence in one view.
- Activity can be filtered by incidents, recovery queue or alert delivery without losing the
  surrounding operational context.
- Each timeline item links directly to the queue where it can be investigated or resolved.

### Improved

- The removed standalone Audit History destination is now represented by contextual operational
  evidence instead of a duplicate navigation surface.
- Timeline rows use the same state, focus and responsive treatment as the rest of Operations.
- Empty activity states explain what will appear when the workspace starts receiving signals.

No database migration or user action is required.

## Release `v0.33.5` — Operational surface coherence

Released 1 August 2026. Webhook Hub, Monitoring, Operations and account workspaces now share a
more consistent operational layout, with clearer status grouping and responsive action placement.

### Improved

- Webhook Hub live connections now expose their state through consistent row treatments, visible
  actions and clearer focus behavior.
- Monitoring, incident, dead-letter and alert rows use the same scan order for status, context and
  next action across desktop and mobile.
- Public status-page management uses the same compact list and action language as the rest of the
  operational workspace.
- Account and workspace pages now use the shared page-header contract, keeping titles, context and
  role/security indicators aligned with the rest of the dashboard.

### Fixed

- Operational rows no longer rely on a hover colour alone to communicate their state.
- Long route names, hosts and delivery messages stay contained instead of pushing action controls
  outside the viewport.
- Mobile action groups wrap into an operable order without exposing light-theme fallbacks in dark
  mode.

No database migration or user action is required.

## Release `v0.33.4` — Reliability workspace coherence

Released 1 August 2026. Reliability, Evidence and Lab surfaces now share the same visual rhythm
and clearer action states as the rest of the dashboard.

### Added

- Failure scenarios and Guided Demo now use the shared page header and responsive workspace layout.
- Evidence rows expose a visible **Open** affordance alongside their keyboard-accessible selection.
- Scenario library items and evidence filters show consistent selected, hover and focus states.

### Improved

- Reliability monitor rows are easier to scan across availability, latency, incidents and budget.
- The Guided Demo rail reads as one chronological journey, with the control surface kept beside it
  on desktop and below it on smaller screens.
- Scenario editing keeps the response sequence, repeat policy and destructive actions grouped with
  predictable spacing on desktop and mobile.

### Fixed

- Reliability no longer crashes when an older or partial response omits an error-budget percentage;
  it keeps the status label and available metrics visible.
- Dense Evidence, Scenario and Demo layouts no longer depend on light-theme surfaces in dark mode.
- New lab headings follow the selected language in the same way as the other workspace headings.

No database migration or user action is required.

## Release `v0.33.3` — Operational workspace polish

Released 1 August 2026. The dashboard now makes module actions, selected resources and empty
states easier to understand and operate.

### Added

- Integration inventory rows now show an explicit **Open** affordance and expose the same action to
  assistive technology.
- The monitor editor traps keyboard focus while open and returns focus to the control that launched
  it when closed.
- Control Center’s first-run state now has a clearer start point and a more compact responsive
  composition.

### Improved

- Selected monitor rows and inventory rows have consistent hover, focus and selected treatments in
  light and dark themes.
- Control Center summary actions now look like actionable controls instead of unstyled links.
- Mobile empty states keep the logo, instructions and primary action in a readable order.

### Fixed

- Unstyled inventory buttons no longer look like inert text rows.
- The monitor editor no longer allows keyboard focus to escape behind its modal surface.
- The Control Center summary label is translated with the rest of the workspace instead of being
  injected as a theme-only decoration.

No database migration or user action is required.

## Release `v0.33.2` — Workspace visual polish

Released 1 August 2026. The dashboard now uses a more consistent visual rhythm across modules,
with a clearer Home overview and a mobile navigation that keeps the full product reachable.

### Added

- Home metric surfaces for resource totals, health state and recovery signals.
- Calm route transitions and telemetry motion that respect reduced-motion preferences.
- A compact mobile **More** menu for secondary workspace destinations.

### Improved

- Shared button, field, panel, list and focus treatments across the authenticated workspace.
- Stable chart and metric layouts that remain readable while data is loading.
- Dark and light theme contrast for hover, focus and selected states.

### Fixed

- Mobile navigation wrapping and hidden destinations at narrow widths.
- Page movement during chart loading and inconsistent action sizing between modules.

Read the [v0.33.2 release notes](releases/v0.33.2.md).

## Release `v0.33.1` — Self-host diagnostics

Released 1 August 2026. Self-hosted operators can now run a deeper read-only preflight before an
update or handoff.

### Added

- `./hooktrials doctor --deep` checks Compose services, API health, setup metadata, disk space and
  local backup presence.

### Improved

- Diagnostic output remains safe for support handoffs and never prints runtime secrets or payloads.
- Update and rollback behavior is unchanged, including backup-first protection.

Read the [v0.33.1 release notes](releases/v0.33.1.md).

## Release `v0.33.0` — Account session controls

Released 1 August 2026. Account settings now shows active browser sessions and lets users sign out
other sessions without changing their password.

### Added

- Session inventory with created, last-used and expiry times.
- One-click sign-out for every other active browser session.
- Public [account security guidance](account-security.md) covering sessions, team roles and API-key
  hygiene.

### Improved

- Self-service profile, password, email and session actions are available to every workspace role.
- Password rotation and recovery continue to invalidate older sessions.

### Fixed

- Viewer and operator accounts no longer hit workspace-role gates when changing their own account
  security settings.

Read the [v0.33.0 release notes](releases/v0.33.0.md).

## Release `v0.32.0` — SLOs and error-budget alerts

Released 1 August 2026. This release adds configurable reliability objectives, explainable error budgets and alert events when a rolling objective is breached.

### Added

- Configure a 90–100% availability objective and a 1–30 day rolling window per monitor.
- Review budget remaining, burn rate and objective state alongside availability, latency and incidents.
- Route budget-breach and recovery events to the existing Discord or generic HTTPS alert channel.
- Existing monitors receive a 99.90% / seven-day baseline and continue using their existing credentials and checks.

Read the [v0.32.0 release notes](releases/v0.32.0.md) and the [SLO guide](slo-and-alerts.md).

## Release `v0.31.0` — Delivery policies for resilient routes

Protect routes can now send one event to one destination, every destination or an ordered fallback
chain. Each target keeps its own delivery evidence and retries carry a stable idempotency key.

### Added

- **Single**, **Fan-out** and **Failover** routing in Webhook Hub and route configuration.
- Up to three HTTPS targets per policy, with per-target timeout, expected status range and optional
  headers.
- Per-destination or per-event idempotency scope through `X-HookTrials-Idempotency-Key`.
- Redacted topology summaries in endpoint lists and a write-only target editor.
- Public [delivery policy guidance](delivery-policies.md) and an updated OpenAPI contract.

### Improved

- Fan-out deliveries are tracked independently, so partial failure stays visible.
- Failover hand-offs are recorded as first-class delivery events and remain available in Operations.
- Existing endpoints without a policy continue to use their current single destination.

### Fixed

- Advanced route edits preserve existing write-only targets when the topology is not changed.
- Destination URLs and custom headers remain encrypted and are never returned by the API.

### Upgrade note

The release includes an additive database migration. Existing routes, accounts and evidence remain
compatible; Trial and Observe behavior is unchanged.

## Release `v0.30.0` — OpenAPI import for monitored integrations

The dashboard can now read an OpenAPI 3.x contract, preview safe operations and create reviewed
test or staging monitors without copying authentication details or request bodies.

### Added

- **Resources → Import OpenAPI** accepts JSON/YAML files, pasted documents and public CORS-enabled
  URLs.
- The review step shows the resolved server, operation method, path and expected success range.
- Up to 20 selected monitors can be created in one action, with per-operation success and failure
  results.
- GET and HEAD operations are selected by default; POST requires an explicit side-effect warning
  acknowledgement.

### Improved

- Path templates and unsupported write methods remain visible with a reason instead of becoming
  ambiguous monitors.
- Import is limited to Test and Staging so every generated check can be reviewed before production.
- Public and in-product documentation now includes the complete import workflow and safety model.

### Fixed

- Avoided copying authentication schemes, headers, request bodies, examples or secrets from an API
  specification.
- Kept the import flow browser-local, preventing the API from becoming an arbitrary specification
  proxy.

No database migration is required. Existing accounts, resources, events and API keys remain
compatible.

## Release `v0.29.0` — API catalogue and CI discovery

This release makes the HookTrials integration surface easier to discover and safer to automate.
Every installation now publishes a redacted OpenAPI contract, and the CLI can inspect that contract
before a team depends on a route in CI.

### Added

- A public **OpenAPI 3.1 catalogue** is available at `/openapi.json` on every API origin.
- The catalogue documents system checks, route and monitor operations, public status pages,
  redacted evidence and the scoped automation endpoints.
- **`hooktrials-api`** lists documented operations, exports the contract to a file and checks that a
  required operation ID exists.
- The in-product **Documentation** page now links directly to the live API catalogue alongside the
  public technical guides.

### Improved

- Automation documentation clearly separates dashboard sessions from read/write API-key scopes.
- OpenAPI descriptions explain the safe boundaries: synthetic checks only, no arbitrary destinations
  and no raw payloads or credentials in evidence responses.
- Self-hosted operators can point the same CLI command at their own API origin without changing the
  product workflow or exposing runtime secrets.

### Fixed

- Integrators no longer need to infer the supported automation paths from browser network traffic.
- API contract checks now fail clearly when an origin is unavailable or returns an invalid document.
- API catalogue examples use redacted values and do not encourage copying secrets into source files.

### Upgrade note

The release adds a read-only API route and a CLI command. Existing routes, accounts, data and
automation keys remain compatible.

## Release `v0.28.1` — Safer alert and status-page workflows

This maintenance release makes two operational workflows easier to complete safely: configuring
what is shared on a public status page and cleaning up an alert destination when it is no longer
needed.

### Added

- A live **Public preview** appears while creating or editing a status page, showing the selected
  monitors, their current health and the exact redacted information that can be shared.
- Alert channels can be removed from **Operations** when a destination has been retired or replaced.
- Status-page actions now use the same accessible confirmation dialog as the rest of the dashboard.

### Improved

- Status-page previews update as the headline, description, accent and monitor selection change, so
  the public result is understandable before it is published.
- Rotating a public link explains that the previous URL will stop working, while the existing page
  remains available until the action is confirmed.
- Removing an alert channel leaves its historical delivery evidence in Operations while stopping
  future notifications immediately.

### Fixed

- Replaced browser-native delete and rotate prompts with keyboard-friendly, focus-trapped dialogs.
- Added an explicit cleanup path for saved Discord and generic webhook alert channels.
- Kept public status pages limited to selected monitor names, redacted hosts and health metrics.

No API, database or account migration is required.

## Release `v0.28.0` — A shared visual system for the workspace

The dashboard now uses one page-heading and responsive composition across the operational modules.
The result is a calmer, easier-to-scan workspace where the page title, supporting context and next
action stay aligned on desktop, tablet and mobile.

### Added

- A shared page-header component now gives Home, Webhook Hub, Monitoring, Operations, Evidence,
  Reliability and account/resource screens the same hierarchy and action placement.
- Mobile page headers stack their actions deliberately instead of squeezing controls beside a title.
- Summary strips use a consistent instrument-panel treatment so health counts read as one operational
  signal rather than unrelated cards.

### Improved

- The visual contract is applied across the remaining dashboard modules, including Trial endpoints,
  Failure scenarios, Guided demo, Documentation, API keys, Workspace and Account settings.
- Keyboard focus is visibly preserved for links, controls and data selectors in dense operational
  views.
- Existing light/dark tokens, button variants and reduced-motion behaviour remain the single source
  of interaction feedback.
- The standalone Audit history tab remains removed; operational audit entries stay with Operations
  and the legacy URL continues to redirect safely.

### Fixed

- Page headers no longer change spacing and action alignment from one module to another.
- Long titles and descriptions wrap inside the content measure instead of pushing actions off-screen.
- Narrow screens no longer rely on a horizontally compressed page header to expose primary actions.

No API, database or account migration is required.

## Release `v0.27.0` — Safer self-hosted updates

Self-hosted operators can now review, apply and undo application updates with clearer recovery
boundaries while keeping their stored data and runtime secrets intact.

### Added

- Preview a tagged release with `./hooktrials update --release vX.Y.Z --check` before rebuilding
  anything.
- Automatic mode-`0600` snapshots of the PostgreSQL database and encrypted runtime configuration
  before a real update.
- Persistent update state showing the target release, backup references and completion status.
- Explicit `./hooktrials rollback --yes` to restore the previous application checkout and restart
  the stack.

### Improved

- `./hooktrials status` now shows the active release and the last update state.
- Failed updates restore the previous checkout automatically and retain both recovery references.
- Update guidance explains exactly what is preserved: PostgreSQL, Redis, users, endpoints, events
  and encryption keys remain in place.

### Fixed

- Update failures no longer leave the operator without a clear runtime backup reference.
- A failed tag switch is recorded as a failed update instead of appearing to have completed.
- Rollback is explicit and never silently reverses database migrations.

No application data migration is included. Existing self-hosted installations can continue using
their current release and adopt the new workflow on the next update.

## Release `v0.26.0` — Command palette and faster navigation

This release adds a keyboard-first way to move around the workspace and run common actions without
losing the current route context.

### Added

- Open the command palette from the search control in the workspace bar or with **Cmd/Ctrl + K**.
- Search every dashboard module, account settings and workspace action from one place.
- Navigate results with the arrow keys, jump to the first or last result and confirm with Enter.
- Switch theme, open the product tour, refresh workspace data and collapse the sidebar directly from
  the palette.

### Improved

- The palette groups destinations and actions so a search result explains where it will take you.
- The dialog traps focus, announces its active result and closes cleanly with Escape or a backdrop
  click.
- The shortcut remains available on narrow screens through the compact search control.
- Empty searches explain what to try next instead of presenting a blank panel.

### Fixed

- Prevented arrow-key navigation from moving to an invalid result when a search has no matches.
- Refresh actions now surface the same session and request errors as the rest of the dashboard.
- Kept the legacy `/app/audit` link redirecting to Operations; no separate Audit history tab is
  exposed.

No account, route, monitor, incident or database migration is required.

## Release `v0.25.0` — Evidence and reports

This release gives recorded events a dedicated, redacted evidence workspace so teams can explain
delivery outcomes, prove recovery and hand off an incident without opening raw payloads.

### Added

- **Evidence & reports** is now available under Resources with search, endpoint filters and report
  status filters for recorded events.
- Each report shows an explainable resilience score, outcome, impact, duration, attempt count and
  destination-delivery count.
- A recovery timeline makes the sequence of provider responses, delivery states and next actions
  readable without reconstructing it from separate screens.
- Authenticated JSON and Markdown exports are available from the selected report.
- Temporary 24-hour handoff links share only redacted evidence and can be replaced when a new link
  is created.

### Improved

- Event-level evidence is no longer buried inside an individual inspector; the report inventory can
  be scanned first and opened only when an event needs attention.
- Report loading, empty, filtered and last-known states explain what the workspace currently knows.
- Route context stays connected through a direct link back to the selected route control view.

### Fixed

- Removed the standalone Audit history navigation surface. Existing `/app/audit` links continue to
  redirect to Operations, while event-level recovery proof is available in Evidence & reports.
- Report views intentionally exclude request payloads, secret headers, credentials and destination
  URLs from list responses and temporary share links.

No account, route, monitor, incident or database migration is required.

## Release `v0.24.0` — Webhook Hub operations

This release makes real webhook connections easier to configure, verify and operate without
confusing them with synthetic Trial endpoints.

### Added

- **Inbound contract preview** shows the provider headers HookTrials expects before a route is
  created, including signature requirements where supported.
- **Quick smoke test** gives every new live route a copy-ready `curl` example for sending a safe
  first event.
- **Connection filters** separate all live routes from paused connections and routes that need
  attention.
- **Live delivery signal** shows the latest recorded delivery state and time beside each route.

### Improved

- Webhook Hub now refreshes operational evidence automatically so recent tests and deliveries are
  visible without leaving the page.
- Provider setup, destination details and post-creation actions follow one clearer sequence from
  configuration to first traffic.
- The former standalone Audit history screen is no longer part of dashboard navigation. Its
  redacted operational record remains available from Operations, and old links continue to work.
- Live route rows remain usable on narrow screens, with status and actions kept together.

### Fixed

- Prevented an audit route from opening a separate, disconnected surface after the navigation was
  consolidated around Operations.
- Added an explicit loading and error state when live integration evidence is unavailable instead
  of presenting a stale-looking route list.

No account, route, monitor, incident or evidence migration is required.

## Release `v0.23.0` — Workspace telemetry

This release turns Home into a practical operating overview with visual signals that help users
decide what to inspect next.

### Added

- **Resource health** shows the current mix of healthy, degraded, unavailable and newly configured
  routes and monitors in one glance.
- **Monitor coverage** visualizes each monitor's measured availability against its configured target
  for the current 24-hour window.
- **Evidence counters** keep the number of checks and protected recoveries visible beside the charts.

### Improved

- Home combines the existing metrics, next actions, route activity and telemetry without duplicating
  configuration or delivery controls.
- Charts use the same status colours, typography and dark/light surfaces as the rest of the product.
- The telemetry area adapts to narrow screens and remains readable when a workspace has many resources.

### Fixed

- A workspace with no checks now shows a clear explanation instead of an empty or misleading graph.
- Reduced-motion preferences disable chart and panel entrance animation while retaining the same data.

No account, route, monitor, incident or evidence migration is required.

## Release `v0.22.0` — Route lifecycle and workspace Home

This release makes the dashboard easier to understand from the first screen and keeps each route's
journey connected from setup through recovery.

### Added

- **Workspace Home** gives one read-only overview of live routes, Trial endpoints, monitors, open
  incidents, recoveries and recent evidence.
- **Route journey** in Control Center connects setup, traffic inspection, monitoring and Operations
  with direct links for the selected route.
- Home highlights the next actions that will create the most useful reliability evidence, alongside
  shortcuts to the main product and Lab workflows.

### Improved

- The dashboard now distinguishes Home (workspace orientation) from Control Center (route-level
  evidence and retry timelines).
- Route and integration links preserve the selected endpoint when moving between modules.
- The route journey and Home surfaces adapt to narrow screens without hiding the next action.

### Fixed

- `/app` no longer opens an ambiguous route-detail screen; it now opens the workspace overview.
- Direct route links no longer fall back to a generic page when the endpoint context is valid.
- Invalid route links show a clear recovery action to choose another endpoint.

Existing routes, monitors, incidents, evidence and accounts continue to work without reconfiguration.
See [Product guide](product-guide.md) for the updated workspace flow.

## Release `v0.21.0` — Account security and settings

This release adds account-level security controls while preserving access for existing users.

### Added

- New registrations can require a single-use email verification link before dashboard access.
- Existing accounts are marked as legacy-compatible during migration and remain usable.
- Account settings now manage the display name, HTTPS profile image, email-change confirmation and
  password rotation.
- API-key management is linked directly from account settings.

### Improved

- Email changes are staged until the new address is confirmed.
- Password changes invalidate other sessions and trigger a security notification.
- Account tokens remain hashed, short-lived and single-use.

### Upgrade note

The migration is additive. Existing workspaces, routes, monitors, API keys and evidence remain intact.
See [v0.21.0 release notes](releases/v0.21.0.md).

## Release `v0.20.0` — Shared workspaces and incident ownership

This release adds a practical collaboration layer for teams operating the same integrations.

### Added

- **Team workspace** groups routes, monitors, scenarios, status pages, operations and audit history
  under a shared view.
- **Owner, admin, operator and viewer roles** provide explicit boundaries for configuration,
  recovery and read-only access.
- **Time-limited invitations** let administrators add a teammate with a chosen role and review
  pending invitations from the workspace screen.
- **Incident assignment** makes the current owner of operational work visible and editable from
  Operations.

### Improved

- Existing accounts are migrated into personal workspaces without changing their routes, monitor
  history, API keys or evidence links.
- Shared resource queries include workspace members while secrets and payloads remain outside the
  workspace view.
- Workspace and incident changes continue to produce redacted audit entries.

### Upgrade note

The update applies additive workspace and incident-assignment migrations. No manual data move is
required. See [Workspaces and roles](workspaces-and-roles.md) for the invitation and permissions
workflow.

## Release `v0.19.0` — Reliability evidence and audit history

This release makes recurring operation easier to explain and hand over.

### Added

- **SLO & reliability** reports availability, check volume, average latency, p95 latency and
  incidents for a selectable 24-hour, 7-day or 30-day evidence window.
- Each monitor now has its own objective row, so teams can spot a dependency that is below its
  target without opening every monitor individually.
- **Audit history** provides a chronological, account-scoped record of route, monitor, incident,
  recovery, alert and API-key actions.

### Improved

- Reliability screens show the target and sample size alongside each percentage, avoiding scores
  that cannot be explained.
- Audit entries identify whether an action came from the dashboard or a scoped automation key.
- Empty states direct users to collect monitor evidence before interpreting an objective.

### Privacy

- Audit records deliberately exclude request bodies, webhook payloads, destination URLs,
  authorization headers and credential values.

Existing routes, evidence exports and API keys continue to work without reconfiguration. The normal
update process applies the additive data change.

## Release `v0.18.1` — Reliable update assets

This patch keeps the CI automation and scoped API keys from `v0.18.0` while making the update
package more consistent for new and existing installations.

### Improved

- New installations and upgrades receive the same tested server and dashboard release assets.
- Release metadata stays aligned across the dashboard, CLI and self-hosting documentation.
- Update packaging now reports progress more clearly when a supporting asset is delayed.

### Fixed

- Fixed a case where a delayed release asset could leave an update waiting indefinitely.
- Kept the application source, self-hosted commands and API contracts unchanged.

Existing users do not need to change routes, accounts or API keys. Update normally when the new
release is available.

## Release `v0.18.0` — CI automation and scoped API keys

This release connects HookTrials to repeatable engineering workflows without weakening the
redaction and account-isolation boundaries.

### Added

- **Resources → API keys** creates account-scoped credentials with separate `read` and `write`
  permissions.
- The new `hooktrials-run` CLI command triggers a synthetic check against an existing Observe or
  Protect route and can save its redacted evidence in the same run.
- The new `hooktrials-evidence` CLI command downloads JSON or Markdown evidence for an existing
  event, ready for CI artifacts or change records.
- API keys are shown only once, then displayed by prefix; each key can be revoked independently.

### Improved

- CI automation uses short, explicit API paths instead of browser sessions or broad dashboard
  access.
- Evidence exports continue to share the same payload-free redaction boundary as the dashboard and
  public links.
- The API keys screen explains least-privilege scopes, rotation and secret-store usage in English
  and Spanish.

### Fixed

- Revoked or under-scoped keys now fail closed before an automation action is executed.
- Synthetic CI checks now return a stable event identifier that can be exported immediately.

Existing installations apply the database change during the normal update process. Create a key in
**Resources → API keys** after upgrading; no existing session or route needs to be recreated.

## Release `v0.17.0` — Delivery identity and retry control

This release strengthens Protect and Observe routes with a destination contract designed for real
recovery workflows.

### Added

- Destinations receive stable `x-hooktrials-event-id`, `x-hooktrials-delivery-id` and
  `x-hooktrials-delivery-attempt` headers so they can implement idempotency and correlate retries.
- Route Control includes Fast, Balanced, Patient and Custom retry profiles with clear attempt and
  backoff bounds.
- The event inspector and delivery history continue to distinguish duplicate provider attempts from
  new retry or replay deliveries.

### Improved

- Retry profiles respect a destination's `Retry-After` response while enforcing the configured
  maximum delay.
- System delivery identity headers cannot be overwritten by custom destination headers.
- Protect documentation now explains how to build a safe idempotency key and how retry/replay IDs
  relate to one event.

### Fixed

- Downstream services no longer need to infer duplicate events from provider-specific headers.
- Observe responses expose the HookTrials event and delivery identifiers for trace correlation.

Existing routes keep their current retry values. Choose a profile only when you want to change the
policy; no migration is required.

## Release `v0.16.1` — Activation path and delivery diagnostics

This patch makes the first useful HookTrials session easier to complete and leaves clearer evidence
when account email delivery is tested.

### Added

- A Control Center activation path now guides new workspaces from a safe Trial to a real Webhook Hub
  route, a dependency monitor and operational evidence.
- Each activation step links directly to the screen where it can be completed, and shows when the
  workspace has already proven it.
- The first-use guide is available in English and Spanish through the existing language switcher.

### Improved

- The activation path uses observed workspace state instead of a static progress counter, so it stays
  useful after a user returns later.
- Maileroo delivery diagnostics now record a bounded provider status and reference identifier without
  exposing recipients, API keys, links or long tokens in application logs.
- The public package version is aligned with the current release line.

### Fixed

- Temporarily unavailable supporting APIs no longer block the rest of the Control Center; the guide
  remains informational while the existing modules continue to work.

No database migration or route behaviour change is required for this patch.

## Release `v0.16.0` — Account security and recovery

This release adds a complete transactional email layer for account safety.

### Added

- Verify an email address after registration before entering a Cloud workspace.
- Request a fresh verification link when an unverified account tries to log in.
- Recover access through a single-use password reset link with a short expiry.
- Receive a welcome message after verification and a confirmation when the password changes.
- New verification, recovery and password-change screens with clear next steps and accessible
  error states.

### Improved

- Account emails share a responsive HookTrials design with the product logo, black/green palette and
  a plain-text alternative for mail clients that do not render HTML.
- Sensitive links are single-use, expire automatically and are never stored in readable form.
- Password reset requests use the same response whether or not an account exists.
- Changing a password signs out existing sessions so an old session cannot remain active.

### Fixed

- New Cloud accounts can no longer remain permanently unverified when email delivery is enabled.
- Expired or reused verification and recovery links now show an actionable error instead of failing
  silently.

Self-hosted installations keep email optional by default. Cloud operators can enable the same flow
with a verified sending domain and a Maileroo sending key.

## Release `v0.15.2` — Complete Linear starter headers

This patch completes the Linear contract starter introduced in `v0.15.1`.

### Improved

- Linear routes now expect the complete event, delivery, signature and timestamp header set.
- Safe Linear test events include a representative timestamp, making the captured request easier to
  compare with the provider's replay-protection guidance.
- The same header expectations are used consistently by new live connections and route contract
  presets.

### Fixed

- Linear starter contracts no longer omit `Linear-Timestamp` when validating or simulating a test
  delivery.

No existing route mode, retry policy or signature verification behaviour changes in this patch.

## Release `v0.15.1` — Expanded provider starters

This patch expands Webhook Hub coverage without changing the existing route model or delivery
semantics.

### Added

- GitLab starter with event, webhook UUID and token header expectations.
- Linear starter with event, delivery, signature and timestamp header expectations.
- HubSpot starter with signature and request-timestamp header expectations.
- The same provider choices are available when creating a live connection and when applying a
  route contract preset.

### Improved

- Provider-specific contract starters make it faster to move a real integration behind HookTrials
  while keeping the expected inbound shape visible before traffic arrives.
- Safe test events now include representative headers for the three additional provider starters,
  making the full capture and evidence flow easier to validate.
- Existing Stripe and GitHub native signature verification remains clearly distinguished from the
  contract-first starters.

### Fixed

- Provider metadata is preserved when listing and reopening live routes, including the new starter
  choices.

The new starters validate the expected method and headers. Native cryptographic verification remains
available for Stripe and GitHub; review and configure any provider's own secret requirements before
accepting production traffic.

## Release `v0.15.0` — Delivery Control Plane

Release `v0.15.0` adds a safe outbound pause for Protect routes:

- pause destination delivery while inbound events remain captured and correlated;
- keep queued work and attempt history intact;
- resume from Route control and continue the existing retry policy.

The setting defaults to normal delivery and does not change Trial or Observe behaviour.

## Release `v0.14.0` — Incident Center

Release `v0.14.0` adds a practical triage workflow to Operations:

- filter open, recovered and unacknowledged incidents;
- acknowledge an incident with an ownership timestamp;
- add a short operator note for handoffs and investigation context;
- keep recovery evidence and outgoing alert delivery audit independent.

The migration is additive. Existing incidents, captured data and delivery history remain intact.

## Release `v0.13.0` — safe self-hosted updates

Release `v0.13.0` adds a release-aware update path for self-hosted installations:

- create a protected PostgreSQL backup before changing versions;
- select a published release tag explicitly;
- wait for migrations and Compose health checks;
- restore the previous checkout and restart the previous stack when an update fails.

The managed cloud environment runs the same application release. Self-hosting keeps its own
database, runtime secrets and named volumes.

## Release `v0.12.4` — security-control

Release `v0.12.4` protects captured integration data and makes shared installations safer:

- captured request metadata is protected at rest and sensitive values stay redacted in logs and
  event views;
- endpoint tokens can be rotated without deleting the endpoint;
- authentication and cookie headers are not forwarded automatically to destinations, while provider
  signatures remain available for verification;
- monitor creation and manual checks have clear limits in managed installations;
- the installation includes safer backup handling, dependency updates and container defaults.

## Fixed

- ingestion URLs no longer retain endpoint tokens or query strings in stored request metadata;
- legacy request metadata is sanitized during the database upgrade.

## Release `v0.12.3`

Release `v0.12.3` makes the operational workspace easier to scan and act on:

- Control Center shows live delivery activity and retry timelines earlier, so the current route
  state is visible before configuration details;
- Operations puts incidents, dead letters and recent activity before alert configuration, making
  triage the first task on the page;
- Monitoring separates the integration list, monitor detail, monitor setup and public status pages
  into clearer work areas;
- recent monitor checks show a bounded history with a clear indication of how many checks are kept;
- the Control Center route selector is explicitly labelled, and endpoint rows explain where they
  open next;
- actions across Webhook Hub, Monitoring, Operations, Trial endpoints and the event inspector use
  consistent primary, secondary, danger and quiet button states, including focus and disabled
  feedback;
- wide screens use a readable centred content width and the dashboard removes repeated headings and
  duplicate integration rows.

## Fixed

- destructive actions remain visibly destructive instead of inheriting the appearance of nearby
  neutral actions;
- long-running monitor history no longer grows without a visible limit;
- dashboard controls no longer rely on surrounding containers to communicate that they are buttons.

## Previous release `v0.12.2`

Release `v0.12.2` makes the dashboard easier to navigate by naming every screen after the menu
entry that opens it:

- Control Center, Failure scenarios, Guided demo and Documentation now match their navigation
  labels;
- Control Center keeps its own title and shows the selected route beneath it;
- page headings no longer repeat the breadcrumb above them;
- Operations and Monitoring panels are named after the evidence they hold;
- delete controls read as destructive in both themes.

## Previous release `v0.12.1`

Release `v0.12.1` makes alert setup easier to find and the dashboard's action controls easier to
understand:

- Discord and generic webhook alerts are available at the top of Operations and from Monitoring;
- monitor, route, operations and public-status actions now share a clear button treatment;
- dark mode keeps action controls and public-status controls readable;
- the landing header stays aligned on wide screens and changes to the compact menu when needed.

## Previous release `v0.11.3`

Release `v0.11.3` completes dark-theme parity for operational status surfaces. Production Readiness
markers, monitor state notices, configuration chips, check history and public-status actions now use
the semantic dark palette instead of inheriting light-theme white fills. This keeps status meaning
legible without making the dashboard look like a light card inside the dark workspace.

The patch is presentation-only: it does not change authentication, delivery, monitoring, persistence
or data retention behaviour. The web typecheck and production build pass before the immutable image
promotion to CubePath.

## Previous release `v0.11.2`

Release `v0.11.2` removes the remaining light-surface leakage from the dark authentication view.
The platform badge, deterministic response sequence and CubePath attribution now use restrained
dark semantic surfaces with accessible status colours.
The patch was promoted backup-first to CubePath on 21 July 2026. All four public origins passed,
the production images became healthy and the exact authentication stylesheet was verified in the
deployed web asset after visual validation on the complete local stack.

## Previous release `v0.11.1`

Release `v0.11.1` completes the dark-theme presentation used by the jury journey. Guided Demo
success, running and failure rows now use restrained semantic surfaces with readable text instead
of inheriting light-theme fills. The complete eight-stage journey was repeated on the full local
Compose stack in Spanish and finished with every stage passed.
The patch was promoted backup-first to CubePath on 21 July 2026. Landing, dashboard, API and
ingestion origins returned 200; the production Guided Demo completed all eight stages in Spanish
and dark mode, and recent application logs contained no runtime errors.

## Previous release `v0.11.0`

Release `v0.11.0` makes the competition demonstration persist as a convincing, inspectable product
state instead of disappearing into one rewritten endpoint:

- Guided Demo creates separate Trial, Observe, Protect recovery, Protect dead-letter and synthetic
  destination routes;
- Webhook Hub retains the three Observe/Protect connections with explicit **DEMO DATA** labels while
  excluding them from hosted quotas;
- the recovery route receives a GitHub-shaped event with a valid HMAC signature and enforced inbound
  contract, then survives two destination failures before succeeding on the third durable attempt;
- Control Center selects that recovered route automatically, produces an ordered `500 -> 500 -> 200`
  delivery timeline and proves all ten Production Readiness controls on the public Cloud deployment;
- the redacted evidence link now documents the protected recovery, while the independent dead-letter
  route keeps Operations actionable without lowering the recovered route's readiness;
- origin-restricted, credential-free ingestion CORS permits realistic browser-generated signed demo
  traffic from the configured application origin;
- login and registration accept a sanitized in-app return path, allowing landing CTAs to open Guided
  Demo or Webhook Hub immediately after authentication.

The full release gate passes formatting, ESLint, strict TypeScript, 133 automated tests and every
production build. A browser-driven run on the complete self-hosted Compose stack passed all eight
steps and produced three Webhook Hub routes, five monitor types, seven audited synthetic alerts, a
protected recovery, one dead letter, a public status page and expiring redacted evidence. The
selected recovery route scores 90/100 locally because localhost is intentionally not public HTTPS.
The release was promoted to CubePath on 21 July 2026; all four public origins passed, the full
eight-step jury demo passed and the selected signed Protect recovery reached 100/100 in Cloud.
The README includes a six-scene animated tour captured from the deployed Cloud product.

## Previous release `v0.10.0`

Release `v0.10.0` reorganizes the authenticated application around an explicit operating boundary:

- **Product** contains Control Center, Webhook Hub, Monitoring and Operations;
- **Lab** contains Trial endpoints, Failure scenarios and the Guided Demo;
- **Resources** contains the searchable product documentation;
- Trial endpoints no longer list Observe/Protect connections, which remain centralized in Webhook
  Hub, preventing synthetic laboratory work from being confused with a live delivery path;
- every route carries a compact workspace/module context line and the mobile navigation retains all
  destinations through an accessible horizontal rail;
- the Webhook Hub visual language now covers the complete dashboard: metrics become data strips,
  inventories become open rows, split workspaces use structural dividers and only forms, dialogs or
  safety-critical controls remain deliberately contained;
- English and Spanish labels and in-product guides describe the same Product/Lab boundary.

Browser validation covers every authenticated route, the expanded and collapsed navigation,
English/Spanish hierarchy, a 390 px mobile viewport and zero content overflow. Strict TypeScript,
ESLint and the production web build pass before the full release gate.

## Release `v0.9.0`

Release `v0.9.0` makes real webhook intermediation the primary product experience:

- a dedicated Webhook Hub concentrates Stripe, GitHub, Shopify, Slack and generic providers in one
  operational workspace;
- live routes are created atomically with their encrypted destination, provider contract,
  environment, Observe/Protect strategy and optional signing secret;
- the activation panel provides the private ingestion URL, provider replacement instructions and a
  second-stage signature flow for providers that issue secrets only after URL registration;
- Observe captures and synchronously mirrors a real destination response; Protect persists first,
  retries durably and exposes exhausted work through Operations;
- the live-route inventory shows provider → HookTrials → destination topology and opens the existing
  authenticated request, validation, delivery and recovery inspector;
- application, in-product Docs, public operator documentation and marketing positioning are complete
  in English and Spanish.

The release preserves the separate deterministic Trial laboratory and the one-command self-hosted
deployment. A production-shaped end-to-end check created a real Observe route, sent a synthetic
`payment.completed` request, captured its complete JSON and headers, passed the inbound contract,
forwarded it to a public HTTPS destination, mirrored `HTTP 204` and produced a successful delivery
journey and report. The temporary validation data was removed afterwards.

The release gate passes formatting, ESLint, strict TypeScript, the expanded automated suite and all
production builds. Browser validation covers the Webhook Hub in Spanish, atomic route creation,
public URL activation, live traffic interception and the final event inspector.

## Previous release `v0.8.2`

Release `v0.8.2` makes the authenticated workspace denser and removes redundant chrome:

- the desktop navigation rail is narrower and can collapse to a persistent 64px icon rail;
- active navigation and selectable cards use restrained surface and border changes without a
  generic colored stripe;
- language, theme, tour, source and logout controls share one compact utility row alongside a
  concise account and runtime state;
- the repeated workspace/health/help header is removed so every route starts with its actual page
  content;
- official CubePath branding replaces the plain hosting text and adapts to light, dark and collapsed
  states;
- page margins, headings and vertical rhythm are tightened to expose more working data at once.

The sidebar preference persists locally. English and Spanish labels, icon-only accessible names,
desktop expanded/collapsed states and both themes passed browser validation. The release gate passes
formatting, ESLint, strict TypeScript, 129 automated tests and the production web build.

## Previous release `v0.8.1`

Patch `v0.8.1` keeps selectable containers inside the active theme's contrast range. Template,
scenario, endpoint, monitor, studio, integration and route-mode cards now use a restrained semantic
hover surface instead of inheriting a white legacy background. Selected cards preserve their
green-tinted state while hovered, so their headings, descriptions and response sequences remain
legible in both light and dark modes.

The release gate passes formatting, ESLint, strict TypeScript, 129 automated tests and the
production web build. Browser validation covers template and scenario selection in both themes.

## Previous release `v0.8.0`

Release `v0.8.0` replaces the mixed glass/terminal presentation with one sober product system:

- solid semantic surfaces and restrained borders across dashboard, authentication, event drawers,
  evidence and public status pages;
- distinct light and dark surface hierarchies with repaired contrast for replay cards, monitor
  states, metrics, public evidence and status badges;
- a fixed full-height workspace rail, clearer page rhythm, larger operational copy and consistent
  controls, tables, forms and cards;
- a compact event inspector that preserves context without the light-card-on-dark failure shown in
  earlier builds;
- responsive two-column and single-column fallbacks for templates, readiness, metrics and drawers;
- route-level scroll restoration so a newly opened module never inherits the previous screen's
  vertical position.

The release gate passes ESLint, strict TypeScript, 129 automated tests and the production web build.
Browser validation covers all seven authenticated routes, the event inspector and customizable
public status pages in light and dark modes. The production-shaped self-hosted stack remained
healthy throughout the review.

## Release `v0.7.0`

Release `v0.7.0` expands Monitor from individual HTTP checks into a bilingual service-health
surface:

- editable HTTP/HTTPS and ICMP monitors, with private target values kept write-only;
- bounded ICMP probing with the same public/private network policy used by HTTP checks;
- customizable multi-monitor status pages with headline, description, accent, visibility, monitor
  selection and immediate URL rotation;
- complete English and Spanish UI across authentication, dashboard, tour, documentation, evidence
  and public status pages;
- corrected onboarding stacking so the fixed tour card always remains interactive above the
  highlighted product surface.

Migration `0009` adds monitor protocol and multi-monitor status-page tables. The local release gate
passes formatting, ESLint, strict TypeScript, 129 automated tests, all production builds and a
complete Docker rebuild. Browser validation covers language switching in both directions, ICMP
create/edit and live reachability evidence, customizable status-page publication, the previously
blocked tour step and an 8/8 Demo Lab run that publishes HTTP + ICMP status evidence.

Patch `v0.6.1` keeps the selected Docs article synchronized with filtered navigation and expands
search across steps, expected results and troubleshooting.

## Release `v0.6.0`

Release `v0.6.0` makes the complete reliability control plane easier to learn and operate:

- consistent responsive geometry and semantic surfaces across every dashboard module;
- persistent accessible light and dark themes, stronger focus indicators and labelled controls;
- a seven-step contextual tour that exposes and highlights the real module being explained;
- searchable in-product Docs with purpose, workflow, expected result and troubleshooting;
- a public operator guide for self-hosted users.

The release gate passes formatting, ESLint, strict TypeScript, 115 automated tests and every
production build. Browser validation covered all seven authenticated routes in both themes, the
contextual tour, zero horizontal overflow, endpoint and scenario creation, real Trial ingestion,
event inspection, a real Protect delivery, active external API monitoring and a redacted public
status page. The production-shaped local stack remained healthy throughout.

## Previous release `v0.5.0`

Release `v0.5.0` turns existing reliability evidence into an operator-facing decision layer:

- Reliability Replay with deterministic diagnosis, impact, causal stages and runbook;
- first-to-selected attempt comparison for HTTP response, latency, integrity and payload stability;
- explainable 100-point Production Readiness with a highest-impact next action;
- Stripe, GitHub, Shopify and Slack route-configuration starters;
- revocable public monitor status pages with 24-hour health and incident history;
- reload-safe Demo Lab recovery, all-run reset and quota-reserved temporary endpoints.

The release gate passes formatting, ESLint, strict TypeScript, 115 automated tests, production
builds, migration `0008`, a production-shaped Docker rebuild and a browser-driven eight-step Demo
Lab. Browser validation also covered recovered-run reset, reload recovery, Readiness, Reliability
Replay and zero console errors. Immutable multi-architecture images were published and the
backup-first CubePath promotion passed on 15 July 2026.

## Previous release `v0.4.0`

Release `v0.4.0` makes the complete product easier to understand and demonstrate:

- a modern, accessible dashboard with a calmer glass-and-rounded visual system;
- an eight-step Demo Lab covering Scenario Studio, Trial, Observe, Protect, Monitor, the recovery
  queue, Operations and redacted Evidence;
- four active monitor types with healthy, degraded, down and recovered histories;
- a real protected delivery that exhausts three attempts and enters the dead-letter inbox;
- isolated cleanup by authenticated user and private `demoRunId`.

The release gate passes formatting, ESLint, strict TypeScript, 112 automated tests, all production
builds and the complete browser-driven Demo Lab. The verified run produced a recoverable delivery,
an unresolved dead letter, open and recovered incidents, synthetic alert audit records and an
expiring evidence report without browser-console errors.

## Previous release `v0.3.6`

The current public release includes the complete Integration Reliability Control Plane:

- deterministic Trial scenarios and guided retry demonstrations;
- Observe forwarding and Protect durable delivery;
- active HTTP monitoring, incidents and explainable scores;
- contracts, GitHub/Stripe signatures, dead letters, alerts and redacted evidence links;
- unified Control Center, Monitor inventory, Operations queue and persisted seven-step onboarding;
- one-command self-hosting with local, existing-proxy and direct-domain modes;
- a full Demo Lab for Trial, Observe, Protect, Monitor and Operations evidence;
- a terminal CLI and bundled GitHub Action for exact response-sequence checks in CI.

The quality gate passes formatting, ESLint, strict TypeScript, 112 automated tests and all
production builds. A clean self-hosted E2E passed outgoing alert delivery, monitor incident and
recovery, Protect dead-letter and manual recovery, and Operations reconciliation.

The Demo Lab then passed direct API and browser execution: Trial `500 -> 500 -> 200`, Observe
destination failure, Protect `202` plus three-attempt durable recovery, three immediate Monitor
checks, recovered incident, Operations summary and cleanup of exactly the three run-owned resources.
The CLI and bundled Action independently passed the same `500 -> 500 -> 200` scenario and emitted
JSON plus JUnit evidence.

## Self-host worker correction

Public release `v0.3.3` attached `worker` only to the internal `data` network. That prevented active
monitors, Protect deliveries and outgoing alert webhooks from reaching external destinations even
though application-level SSRF controls were working. Trial and Observe remained functional.

The correction is included in `v0.3.6`. Self-hosted `v0.3.3` operators can either update or add the
egress-capable `edge` network to the worker service:

```yaml
services:
  worker:
    networks: [edge, data]
```

Then apply the change with:

```bash
./hooktrials up
```

Keep `data` internal and never publish PostgreSQL or Redis ports. The Cloud deployment already uses
this dual-network topology. Release `v0.3.6` was promoted to the managed sandbox through a
backup-first deployment and passed its authenticated post-deploy journey on 14 July 2026.

## Cloud availability

- Landing: <https://hooktrials.com>
- Dashboard: <https://app.hooktrials.com>
- API health: <https://api.hooktrials.com/healthz>
- Ingestion health: <https://hooks.hooktrials.com/healthz>

The hosted sandbox uses quotas and 72-hour payload retention. It is a testing service, not a vault;
prefer synthetic data.

Managed Cloud runs server and dashboard `v0.11.0` with landing `v0.7.0`. Immutable image
references and rollback copies are recorded only in the private Cloud repository. Backup-first
promotion, four-origin smoke, real Observe forwarding, authenticated desktop/mobile validation,
zero restarts, restricted ingestion CORS and the authenticated eight-step jury journey passed on
21 July 2026.

Patch `v0.3.6` also accepts authenticated empty payload ciphertext during report analysis. Empty
webhook bodies now produce normal deterministic evidence instead of a failed background job.
