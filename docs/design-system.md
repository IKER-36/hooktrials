# Product design system

HookTrials uses one visual language across the self-hosted dashboard, Cloud dashboard, authentication
and public evidence views. The private marketing site mirrors the same tokens in its own repository;
landing source is intentionally not shipped with self-hosted installations.

## Direction

The system prioritizes operational clarity, legibility and predictable hierarchy:

- Inter is the interface typeface; JetBrains Mono is reserved for URLs, payloads, identifiers and
  measured evidence.
- Light mode uses a neutral gray canvas and white surfaces. Dark mode uses distinct charcoal
  surface levels instead of flattening every module into black.
- Operational pages use open sections, structural dividers and data rows. Contained surfaces are
  reserved for forms, dialogs, confirmations and safety-critical controls; hierarchy never depends
  on glass effects.
- Green is the product action and healthy-state color. Amber and red only communicate real warning
  or failure states.
- Icons come from Lucide and accompany navigation or meaning. They are not decorative filler.
- Motion is short and purposeful: focus feedback, state transitions and live-state pulses. Route
  transitions and telemetry entrances use Motion and always respect `prefers-reduced-motion`.

## Source layout

- `apps/web/src/styles/tokens.css`: semantic color, typography and shadow tokens.
- `apps/web/src/styles.css`: reset, fonts and shared primitive controls.
- `apps/web/src/styles/app.css`: existing component layout and behavior.
- `apps/web/src/styles/modern.css`: component geometry and responsive application shell.
- `apps/web/src/styles/theme.css`: theme compatibility for product and public surfaces.
- `apps/web/src/styles/refined.css`: authoritative visual layer for spacing, surfaces, contrast,
  typography and responsive refinements.
- `apps/web/src/styles/ui-polish.css`: final shared control rhythm, metric surfaces, list states and
  chart containment. It is loaded last and uses the semantic tokens above.
- `apps/web/src/components/ui/MetricCard.tsx` and `RouteTransition.tsx`: shared metric and route
  transition contracts. Telemetry charts use Recharts only where a visual comparison is useful.
- Inventory and monitor rows must expose a visible open/selection affordance, a keyboard focus
  ring and an accessible name. Editors and dialogs must trap focus and restore it on close.
- Reliability, Evidence, Scenario and Guided Demo surfaces use the shared page-header contract;
  dense rows remain open and separated by hairlines rather than nested floating cards. Responsive
  layouts must stack the detail surface below its inventory or journey rail without horizontal
  scrolling.
- Operational lists (routes, monitors, incidents, dead letters and alerts) use a state-aware row
  contract: status first, context second, action last. Focus must remain visible without a light
  background fallback.

Keeping layout and visual overrides separate allows the product to evolve without changing API or
workflow behavior. New components should use semantic `--ht-*` tokens rather than hard-coded brand
colors.

## Component rules

1. Prefer the open Webhook Hub workspace language. Nested content changes one semantic surface
   level or uses a divider; it does not introduce a new floating card or shadow.
2. Use a pill only for statuses and compact counters; use restrained corners for controls and
   intentionally contained surfaces.
3. Keep body copy in Inter. Use mono only where exact characters or timing matter.
4. Never use green for decoration beside a red or amber operational state that needs attention.
5. Every interactive element requires a visible focus state and at least a 36px touch target.
6. Desktop navigation lives in the left workspace rail. Mobile navigation keeps four primary
   destinations visible and places the remaining modules in an explicit **More** sheet with
   accessible labels.
7. Respect `prefers-reduced-motion`; no workflow may depend on animation.
8. A route change starts at the top of the workspace. Scroll position from another module must not
   leak into the next screen.
9. Hover and selected container states use semantic surface tokens. A dark-theme interaction must
   never fall back to a literal white background, and selection remains visible while hovered.
10. Desktop navigation uses a compact rail that can collapse to icons. Active state is communicated
    through surface, border and icon color—not a decorative edge stripe. Icon-only controls require
    translated accessible names and tooltips.
11. Do not repeat navigation destinations or generic health copy above every page. Product routes
    begin with their own title and actions; global utilities remain in the rail.
12. Audit history is not a standalone navigation destination. Redacted operational activity remains
    available where it is actionable in Operations, and `/app/audit` is retained only as a
    compatibility redirect.
13. Operations begins with a unified chronological activity timeline. Timeline rows expose state,
    resource context, relative time and a direct link to the actionable queue; filters preserve the
    same layout on desktop and mobile.
14. Home metric surfaces are actionable links when they represent a destination. Their hover and
    focus treatment must remain visible in both themes, and any selected telemetry window must be
    repeated in chart headings and supporting counts.
15. Primary workspaces may expose a compact contextual journey when a workflow spans several
    modules. It must complement the global rail rather than duplicate it, link each step to its
    owning route, expose the current step, and collapse without horizontal scrolling on mobile.
16. Actionable list links should preserve non-sensitive view state in the URL when it improves
    hand-off or triage. A deep-linked row must expose a visible target state, keep its semantic
    status contrast, and remain reachable after asynchronous data loads.

## Accessibility and verification

Every visual change must be checked at desktop and mobile widths, with authenticated and public
surfaces. The required gate is `pnpm check`; local browser validation should cover login, Home,
Control Center, Webhook Hub, Monitoring, Operations, Trial endpoints, Failure scenarios, Guided Demo
and public evidence/status views. Check at least 320, 768, 1024 and 1440px in both themes, plus a
keyboard pass and a reduced-motion pass.
