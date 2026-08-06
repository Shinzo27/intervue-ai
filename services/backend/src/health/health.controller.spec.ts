import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;
  let service: HealthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthService,
          useValue: {
            check: jest.fn().mockResolvedValue({
              status: 'ok',
              service: 'intervue-ai-backend',
              database: 'connected',
              version: '0.1.0',
              uptime: 123,
            }),
          },
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    service = module.get<HealthService>(HealthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return health check payload', async () => {
    const result = await controller.getHealth();
    expect(result).toEqual({
      status: 'ok',
      service: 'intervue-ai-backend',
      database: 'connected',
      version: '0.1.0',
      uptime: 123,
    });
    expect(jest.spyOn(service, 'check')).toHaveBeenCalled();
  });
});
