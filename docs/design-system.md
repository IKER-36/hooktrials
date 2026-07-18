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
- Motion is short and purposeful: focus feedback, state transitions and live-state pulses.

## Source layout

- `apps/web/src/styles/tokens.css`: semantic color, typography and shadow tokens.
- `apps/web/src/styles.css`: reset, fonts and shared primitive controls.
- `apps/web/src/styles/app.css`: existing component layout and behavior.
- `apps/web/src/styles/modern.css`: component geometry and responsive application shell.
- `apps/web/src/styles/theme.css`: theme compatibility for product and public surfaces.
- `apps/web/src/styles/refined.css`: authoritative visual layer for spacing, surfaces, contrast,
  typography and responsive refinements.

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
6. Desktop navigation lives in the left workspace rail. Mobile navigation becomes a six-icon bottom
   bar with accessible labels.
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

## Accessibility and verification

Every visual change must be checked at desktop and mobile widths, with authenticated and public
surfaces. The required gate is `pnpm check`; local browser validation should cover login, Control
Center, Webhook Hub, Monitoring, Operations, Trial endpoints, Failure scenarios, Guided Demo and
public evidence/status views.
