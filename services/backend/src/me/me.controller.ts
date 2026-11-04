import { Controller, Get, Req } from '@nestjs/common';
import type express from 'express';
import { auth } from '../auth/auth';
import { fromNodeHeaders } from 'better-auth/node';
import { MeService } from './me.service';

@Controller('me')
export class MeController {
  constructor(private readonly meService: MeService) {}

  @Get()
  async getProfile(@Req() req: express.Request) {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    return this.meService.getProfile(session);
  }
}
