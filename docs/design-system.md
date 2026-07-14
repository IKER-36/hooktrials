# Product design system

HookTrials uses one visual language across the self-hosted dashboard, Cloud dashboard, authentication
and public evidence views. The private marketing site mirrors the same tokens in its own repository;
landing source is intentionally not shipped with self-hosted installations.

## Direction

The system combines the operational clarity of TypeUI Kinetic with calmer, more approachable SaaS
geometry:

- Inter is the interface typeface; JetBrains Mono is reserved for URLs, payloads, identifiers and
  measured evidence.
- A light atmospheric canvas replaces the previous terminal-like black grid.
- Translucent white surfaces use subtle blur, soft elevation and 10–20px radii.
- Green is the product action and healthy-state color. Amber and red only communicate real warning
  or failure states; indigo is a restrained atmospheric accent.
- Icons come from Lucide and accompany navigation or meaning. They are not decorative filler.
- Motion is short and purposeful: lift on actionable cards, focus feedback and live-state pulses.

## Source layout

- `apps/web/src/styles/tokens.css`: semantic color, typography and shadow tokens.
- `apps/web/src/styles.css`: reset, fonts and shared primitive controls.
- `apps/web/src/styles/app.css`: existing component layout and behavior.
- `apps/web/src/styles/modern.css`: current visual layer and responsive application shell.

Keeping layout and visual overrides separate allows the product to evolve without changing API or
workflow behavior. New components should use semantic `--ht-*` tokens rather than hard-coded brand
colors.

## Component rules

1. Use a glass surface only for meaningful grouping. Nested content uses quieter solid fills.
2. Use a pill for statuses, badges and compact counters; use 10–16px corners for controls and cards.
3. Keep body copy in Inter. Use mono only where exact characters or timing matter.
4. Never use green for decoration beside a red or amber operational state that needs attention.
5. Every interactive element requires a visible focus state and at least a 36px touch target.
6. Desktop navigation lives in the left workspace rail. Mobile navigation becomes a six-icon bottom
   bar with accessible labels.
7. Respect `prefers-reduced-motion`; no workflow may depend on animation.

## Accessibility and verification

Every visual change must be checked at desktop and mobile widths, with authenticated and public
surfaces. The required gate is `pnpm check`; local browser validation should cover login, Overview,
Endpoints, Scenario Studio, Monitor, Operations, Demo Lab and public evidence.
