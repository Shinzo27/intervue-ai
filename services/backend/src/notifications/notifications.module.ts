import { Module } from '@nestjs/common';
import {
  createNotificationTransport,
  type NotificationTransport,
} from './notification-transport';

export const NOTIFICATION_TRANSPORT = 'NOTIFICATION_TRANSPORT';

/**
 * Provides the notification transport to queue workers. Keeping it behind a
 * token means workers never construct a provider themselves, so swapping
 * dev → Resend (or a future provider) is one line at the module boundary.
 */
@Module({
  providers: [
    {
      provide: NOTIFICATION_TRANSPORT,
      useFactory: (): NotificationTransport => createNotificationTransport(),
    },
  ],
  exports: [NOTIFICATION_TRANSPORT],
})
export class NotificationsModule {}
