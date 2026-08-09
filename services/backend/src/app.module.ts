import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { LoggerModule } from 'nestjs-pino';
import { v4 as uuidv4 } from 'uuid';
import { auth } from './auth/auth';
import { RequestIdMiddleware } from './common/middleware/request-id/request-id.middleware';
import { HealthModule } from './health/health.module';
import { MeModule } from './me/me.module';
import { PipelinesModule } from './pipelines/pipelines.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isProduction =
          configService.get<string>('NODE_ENV') === 'production';
        return {
          pinoHttp: {
            level: isProduction ? 'info' : 'debug',
            genReqId(req, res) {
              const existingId =
                (req.headers['x-request-id'] as string | undefined) ||
                (req as { id?: string }).id;
              const id = existingId || uuidv4();
              res.setHeader('X-Request-ID', id);
              return id;
            },
            customAttributeKeys: {
              responseTime: 'duration',
            },
            customProps(req) {
              const r = req as {
                user?: { id?: string };
                session?: {
                  userId?: string;
                  user?: { id?: string };
                  activeOrganizationId?: string;
                  session?: { activeOrganizationId?: string };
                };
                organizationId?: string;
                id?: string;
                headers: Record<string, string | string[] | undefined>;
              };
              const userId =
                r.user?.id || r.session?.user?.id || r.session?.userId || null;
              const organizationId =
                r.organizationId ||
                r.session?.activeOrganizationId ||
                r.session?.session?.activeOrganizationId ||
                null;
              const requestId =
                (r.headers['x-request-id'] as string | undefined) ||
                r.id ||
                null;

              return {
                userId,
                organizationId,
                requestId,
              };
            },
            transport: isProduction
              ? undefined
              : {
                  target: 'pino-pretty',
                  options: {
                    singleLine: true,
                    colorize: true,
                    translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
                    ignore: 'pid,hostname',
                  },
                },
            customSuccessMessage(req, res, responseTime) {
              return `${req.method} ${req.url} ${res.statusCode} ${responseTime}ms`;
            },
            customErrorMessage(req, res, error) {
              return `${req.method} ${req.url} ${res.statusCode} - ${error.message}`;
            },
          },
        };
      },
    }),
    HealthModule,
    AuthModule.forRoot({ auth }),
    MeModule,
    PipelinesModule,
    PrismaModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
