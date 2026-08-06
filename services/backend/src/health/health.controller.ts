import { Controller, Get } from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { HealthService, HealthResponse } from './health.service';

@AllowAnonymous()
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async getHealth(): Promise<HealthResponse> {
    return this.healthService.check();
  }
}
