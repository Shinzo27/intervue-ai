/**
 * Notification transport — the seam between queue workers and a real email
 * provider (master-note §45).
 *
 * `dev` logs messages and needs no credentials, so the whole notification
 * pipeline (queue → worker → transport) runs locally and in tests. Setting
 * RESEND_API_KEY switches to real delivery without touching the workers.
 */

export interface NotificationMessage {
  to: string;
  subject: string;
  text: string;
  meta?: Record<string, unknown>;
}

export interface NotificationTransport {
  readonly name: string;
  send(message: NotificationMessage): Promise<void>;
}

export class DevNotificationTransport implements NotificationTransport {
  readonly name = 'dev';

  async send(message: NotificationMessage): Promise<void> {
    console.log(
      `📧 [dev-notifications] → ${message.to}\n` +
        `   subject: ${message.subject}\n` +
        `   ${message.text.replace(/\n/g, '\n   ')}`,
    );
  }
}

export class ResendNotificationTransport implements NotificationTransport {
  readonly name = 'resend';

  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(message: NotificationMessage): Promise<void> {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(
        `Resend rejected the notification (${response.status}): ${body.slice(0, 200)}`,
      );
    }
  }
}

/** Transport from the environment: Resend when configured, otherwise dev. */
export function createNotificationTransport(
  env: NodeJS.ProcessEnv = process.env,
): NotificationTransport {
  const apiKey = env.RESEND_API_KEY;
  if (apiKey) {
    return new ResendNotificationTransport(
      apiKey,
      env.NOTIFICATION_FROM ?? 'Intervue AI <onboarding@resend.dev>',
    );
  }
  return new DevNotificationTransport();
}

/** Where candidates open their interview (used to build links). */
export function candidatePortalUrl(env: NodeJS.ProcessEnv = process.env): string {
  return env.CANDIDATE_PORTAL_URL ?? 'http://localhost:3003';
}
