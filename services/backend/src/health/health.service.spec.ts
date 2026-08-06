import { Test, TestingModule } from '@nestjs/testing';
import { HealthService } from './health.service';

describe('HealthService', () => {
  let service: HealthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HealthService],
    }).compile();

    service = module.get<HealthService>(HealthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return health check payload structure', async () => {
    const result = await service.check();
    expect(result).toHaveProperty('status');
    expect(result.service).toBe('intervue-ai-backend');
    expect(result.version).toBe('0.1.0');
    expect(typeof result.uptime).toBe('number');
  });
});
