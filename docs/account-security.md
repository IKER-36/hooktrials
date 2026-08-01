# Account security

HookTrials keeps account access separate from webhook and monitoring credentials. Use **Account
settings** from the profile area to review your profile, email status, password and active browser
sessions.

## Email verification

If your account still needs verification, Account settings shows the current email state and a
**Resend verification email** action. Use it when the first message has not arrived, then check the
inbox and spam folder. The action does not change your email, password or existing workspace data.
Accounts that were already active before verification enforcement remain usable; only accounts
marked as requiring verification are asked to complete this step.

## Active sessions

The **Active sessions** section lists every unexpired browser session for your account, including
when it was created, when it was last used and when it expires. The current browser is marked
clearly. Use **Sign out other sessions** after using a shared computer or whenever you want to
invalidate older browser sessions without changing your password.

Changing the password or completing a password reset also signs out all other sessions. The current
session is kept active so you can continue working and confirm the change in Account settings.

Session management requires the signed-in browser session; API keys cannot use it. A revoked session
cannot be restored and must sign in again.

## Team access

Workspace members do not share browser cookies or API keys. Owners and admins invite members with a
single-use token that expires after seven days, and the invited address must accept while signed in.
Use the smallest role that matches the work: viewers read evidence, operators triage incidents and
run safe checks, and owners/admins manage configuration and access.

## Automation credentials

API keys are scoped to `read` or `write`, displayed only once and stored as hashes. Keep them in a
CI secret store, rotate them when a job or team member changes, and revoke unused keys from
**Resources → API keys**. Browser sessions and API keys are intentionally different credentials.
