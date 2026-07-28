# Current release status

Updated: 28 July 2026.

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
