import { Test, TestingModule } from '@nestjs/testing';
import { PipelinesService } from './pipelines.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PipelinesService', () => {
  let service: PipelinesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PipelinesService,
        {
          provide: PrismaService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<PipelinesService>(PipelinesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
