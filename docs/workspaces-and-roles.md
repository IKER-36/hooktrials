# Workspaces and roles

HookTrials can be shared by a small team without sharing browser sessions, API keys or webhook
secrets. Every account belongs to a workspace. Existing installations receive a personal workspace
for each account during the normal migration; resources remain available after the upgrade.

## Roles

- **Owner** controls the workspace and cannot be removed.
- **Admin** manages members, invitations, API keys and configuration.
- **Operator** can acknowledge and assign incidents, recover deliveries, run checks and use the
  operational controls needed during an incident.
- **Viewer** can inspect dashboards, evidence, monitors and history but cannot change configuration.

The role applies to the workspace, not to a single endpoint. New routes, monitors, scenarios, status
pages and alert configuration created by an administrator are visible to the whole workspace.

## Invite a teammate

1. Open **Resources → Team workspace**.
2. Enter the teammate's email and choose `admin`, `operator` or `viewer`.
3. Create the invitation and copy the one-time token. The token is shown only in the response that
   creates it; store it in a private channel.
4. The invited user signs in with the invited email and sends the token to the accepting endpoint
   when your integration or onboarding flow is ready.

Invitations expire after seven days. The email must match exactly (case-insensitive), and an invite
cannot grant the owner role.

## Incident ownership

Operations includes an assignee selector for each incident. The assignee must be a member of the
active workspace. Assignments, acknowledgements and operator notes are recorded by the audit
history so a hand-off remains explainable.

## Data isolation

Workspace queries include all members of the active workspace. Resource ownership is still stored on
the original owner account so existing data, API keys and deletion semantics remain stable. Payloads,
destination credentials and signing secrets are not exposed by the workspace screen or invitations.

Self-hosted installations can use the same controls locally. The public repository contains the
migrations and API contracts; no hosted account or infrastructure information is required.
