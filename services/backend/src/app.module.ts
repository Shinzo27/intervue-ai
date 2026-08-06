import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { LoggerModule } from 'nestjs-pino';
import { auth } from './auth/auth';
import { HealthModule } from './health/health.module';

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
    AuthModule.forRoot({ auth }),
    HealthModule,
  ],
})
export class AppModule {}
