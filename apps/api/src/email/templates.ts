type EmailLayoutInput = {
  preview: string;
  title: string;
  intro: string;
  actionLabel?: string;
  actionUrl?: string;
  detail?: string;
  footer?: string;
  origin: string;
};

export type RenderedEmail = { subject: string; html: string; plain: string };

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ??
      character,
  );
}

function layout(input: EmailLayoutInput): { html: string; plain: string } {
  const action =
    input.actionLabel && input.actionUrl
      ? `<a href="${escapeHtml(input.actionUrl)}" style="display:inline-block;background:#2dd978;color:#06130b;text-decoration:none;font-weight:800;padding:14px 20px;border-radius:8px;">${escapeHtml(input.actionLabel)} <span aria-hidden="true">→</span></a>`
      : '';
  const logoUrl = `${input.origin.replace(/\/$/, '')}/logo.png`;
  return {
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(input.title)}</title></head><body style="margin:0;background:#050907;color:#eaf5ee;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;"><span style="display:none!important;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${escapeHtml(input.preview)}</span><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#050907;padding:32px 12px;"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#0b1510;border:1px solid #1f3a2a;border-radius:16px;overflow:hidden;"><tr><td style="height:4px;background:#2dd978;font-size:0;line-height:0;">&nbsp;</td></tr><tr><td style="padding:28px 32px 12px;"><img src="${escapeHtml(logoUrl)}" alt="HookTrials" width="42" height="42" style="display:block;border:0;border-radius:10px;background:#eaf5ee;object-fit:contain;"></td></tr><tr><td style="padding:8px 32px 32px;"><p style="margin:0 0 12px;color:#6bf0a0;font:700 12px/1.4 Arial,Helvetica,sans-serif;letter-spacing:1.6px;text-transform:uppercase;">HOOKTRIALS</p><h1 style="margin:0 0 16px;color:#f3fbf6;font:800 30px/1.12 Arial,Helvetica,sans-serif;letter-spacing:-.5px;">${escapeHtml(input.title)}</h1><p style="margin:0;color:#b6c9bc;font:400 16px/1.6 Arial,Helvetica,sans-serif;">${escapeHtml(input.intro)}</p>${input.detail ? `<p style="margin:20px 0 0;padding:14px 16px;border-left:3px solid #2dd978;background:#102419;color:#d5e6da;font:400 14px/1.5 Arial,Helvetica,sans-serif;">${escapeHtml(input.detail)}</p>` : ''}${action ? `<div style="padding-top:28px;">${action}</div>` : ''}</td></tr><tr><td style="border-top:1px solid #1f3a2a;padding:20px 32px 28px;color:#759182;font:400 12px/1.6 Arial,Helvetica,sans-serif;">${escapeHtml(input.footer ?? 'You are receiving this message because you have a HookTrials account.')}<br><br><a href="${escapeHtml(input.origin)}" style="color:#6bf0a0;text-decoration:none;">hooktrials.com</a></td></tr></table><p style="max-width:560px;color:#52685a;font:400 11px/1.5 Arial,Helvetica,sans-serif;text-align:center;">HookTrials · Integration reliability, measured.</p></td></tr></table></body></html>`,
    plain: `${input.title}\n\n${input.intro}${input.detail ? `\n\n${input.detail}` : ''}${input.actionUrl ? `\n\n${input.actionLabel}: ${input.actionUrl}` : ''}\n\n${input.footer ?? 'You are receiving this message because you have a HookTrials account.'}`,
  };
}

export function verificationEmail(input: {
  name: string;
  verifyUrl: string;
  origin: string;
  ttlHours: number;
}): RenderedEmail {
  const body = layout({
    origin: input.origin,
    preview: 'Confirm your HookTrials email address.',
    title: 'Confirm your email',
    intro: `Hi ${input.name}, confirm your email to activate your HookTrials account and keep your workspace secure.`,
    actionLabel: 'Verify email',
    actionUrl: input.verifyUrl,
    detail: `This link expires in ${input.ttlHours} hours. If you did not create this account, you can safely ignore this message.`,
  });
  return { subject: 'Confirm your HookTrials email', ...body };
}

export function welcomeEmail(input: { name: string; origin: string }): RenderedEmail {
  const body = layout({
    origin: input.origin,
    preview: 'Your HookTrials account is ready.',
    title: 'Your workspace is ready',
    intro: `Welcome, ${input.name}. Your HookTrials account is now verified and ready for reliable integration testing.`,
    actionLabel: 'Open HookTrials',
    actionUrl: input.origin,
    detail:
      'Start with a Trial endpoint, inspect a real webhook, or open the Guided Demo to see the full recovery loop.',
  });
  return { subject: 'Welcome to HookTrials', ...body };
}

export function passwordResetEmail(input: {
  name: string;
  resetUrl: string;
  origin: string;
  ttlMinutes: number;
}): RenderedEmail {
  const body = layout({
    origin: input.origin,
    preview: 'Reset your HookTrials password.',
    title: 'Reset your password',
    intro: `Hi ${input.name}, we received a request to create a new password for your HookTrials account.`,
    actionLabel: 'Choose a new password',
    actionUrl: input.resetUrl,
    detail: `This link expires in ${input.ttlMinutes} minutes and can only be used once. If you did not request this, no changes were made.`,
  });
  return { subject: 'Reset your HookTrials password', ...body };
}

export function passwordChangedEmail(input: { name: string; origin: string }): RenderedEmail {
  const body = layout({
    origin: input.origin,
    preview: 'Your HookTrials password was changed.',
    title: 'Password changed',
    intro: `Hi ${input.name}, your HookTrials password was changed successfully.`,
    actionLabel: 'Open HookTrials',
    actionUrl: input.origin,
    detail:
      'If you did not make this change, reset your password again and contact the HookTrials team.',
  });
  return { subject: 'Your HookTrials password was changed', ...body };
}
