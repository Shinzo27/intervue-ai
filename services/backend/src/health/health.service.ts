import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

export interface HealthResponse {
  status: string;
  service: string;
  database: string;
  version: string;
  uptime: number;
}

@Injectable()
export class HealthService implements OnModuleDestroy {
  private prisma: PrismaClient | null = null;

  private getPrismaClient(): PrismaClient {
    if (!this.prisma) {
      const connectionString = process.env.DATABASE_URL;
      const adapter = new PrismaPg({ connectionString });
      this.prisma = new PrismaClient({ adapter });
    }
    return this.prisma;
  }

  async onModuleDestroy() {
    if (this.prisma) {
      await this.prisma.$disconnect();
    }
  }

  async check(): Promise<HealthResponse> {
    let databaseStatus = 'disconnected';

    try {
      const client = this.getPrismaClient();
      await client.$queryRaw`SELECT 1`;
      databaseStatus = 'connected';
    } catch {
      databaseStatus = 'disconnected';
    }

    return {
      status: databaseStatus === 'connected' ? 'ok' : 'error',
      service: 'intervue-ai-backend',
      database: databaseStatus,
      version: '0.1.0',
      uptime: Math.floor(process.uptime()),
    };
  }
}
