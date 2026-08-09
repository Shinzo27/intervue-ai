import { Test, TestingModule } from '@nestjs/testing';
import { PipelineStagesController } from './pipeline-stages.controller';

describe('PipelineStagesController', () => {
  let controller: PipelineStagesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PipelineStagesController],
    }).compile();

    controller = module.get<PipelineStagesController>(PipelineStagesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
