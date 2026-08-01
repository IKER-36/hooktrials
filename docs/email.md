# Transactional email

HookTrials can send account-security email through [Maileroo](https://maileroo.com/docs). The
integration is server-side: the API key is never sent to the browser, stored in the database or
committed to Git.

## Messages

- Email verification after registration, plus a verification reminder when a new unverified account
  attempts to log in or requests a resend from Account settings.
- Welcome message after verification.
- Password reset link with a short, single-use expiry.
- Password-changed confirmation after a successful reset.

All messages use a responsive, plain-text-compatible HookTrials template: dark graphite surfaces,
HookTrials green actions, the product logo and a short security explanation. Tracking is disabled
for these account emails.

## Maileroo setup

1. Verify `hooktrials.com` (or the sending subdomain you choose) in Maileroo and keep its DNS
   records active.
2. Create a sending key for the verified domain in Maileroo. Treat it like a password.
3. Configure the API service with the following values. Never put them in Git or a frontend `.env`:

   ```dotenv
   MAILEROO_API_KEY=replace-with-a-sending-key
   MAILEROO_BASE_URL=https://smtp.maileroo.com/api/v2
   MAIL_FROM_ADDRESS=noreply@hooktrials.com
   MAIL_FROM_NAME=HookTrials
   MAIL_REPLY_TO=support@hooktrials.com
   AUTH_EMAIL_VERIFICATION_REQUIRED=true
   AUTH_EMAIL_VERIFICATION_TTL_HOURS=24
   AUTH_PASSWORD_RESET_TTL_MINUTES=60
   ```

Cloud enables verification for new registrations while existing accounts remain usable through the
compatibility flag stored on each user. Self-host installations keep email optional unless the
operator supplies the variables. With no Maileroo key, self-hosted registration and login continue
to work without email checks.

## Security behaviour

- Token values are random, stored only as SHA-256 hashes and invalidated after one use.
- Verification links expire after 24 hours by default; reset links expire after 60 minutes.
- Password reset requests return the same response whether an email exists, avoiding account
  enumeration.
- Password changes invalidate all existing sessions.
- Email changes remain pending until the new address confirms its single-use link.
- Existing accounts created before verification was enabled are not blocked by the new policy.
- Maileroo failures are logged as delivery failures without logging recipient secrets or token URLs.

## Verification checklist

After adding the runtime values, create a disposable account and confirm:

1. Registration returns the verify-email state instead of opening the dashboard.
2. Maileroo logs a `email-verification` message from the verified domain.
3. The link opens `/verify-email`, marks the account verified and sends the welcome message.
4. Login succeeds after verification.
5. Account settings can resend verification for an unverified account without changing its email.
6. `/forgot-password` sends a reset link and the link can be used once.
7. A second use of either link is rejected.

The API uses Maileroo's JSON endpoint `POST https://smtp.maileroo.com/api/v2/emails` with an
`X-Api-Key` header, as documented in the [Maileroo Email API reference](https://maileroo.com/docs/api-reference/emails/send-email).
