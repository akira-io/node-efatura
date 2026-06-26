import {
  Body,
  Controller,
  type DynamicModule,
  Get,
  Inject,
  Module,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import type { Efatura } from '../../efatura';
import {
  type HttpResult,
  handleBuildXml,
  handleBuildZip,
  handleRenderDfa,
  handleSubmitMiddleware,
} from '../shared/http';

export const EFATURA = 'EFATURA';

export interface EfaturaModuleOptions {
  efatura: Efatura;
}

@Controller('efatura')
export class EfaturaController {
  constructor(@Inject(EFATURA) private readonly efatura: Efatura) {}

  @Post('dfe/xml')
  async buildXml(@Body() body: unknown, @Res() response: Response): Promise<void> {
    send(response, await handleBuildXml(this.efatura, body));
  }

  @Post('dfe/zip')
  async buildZip(@Body() body: unknown, @Res() response: Response): Promise<void> {
    send(response, await handleBuildZip(this.efatura, body));
  }

  @Post('dfe/submit/middleware')
  async submitMiddleware(@Body() body: unknown, @Res() response: Response): Promise<void> {
    send(response, await handleSubmitMiddleware(this.efatura, body));
  }

  @Get('dfa/:iud')
  async renderDfa(@Param('iud') iud: string, @Res() response: Response): Promise<void> {
    send(response, await handleRenderDfa(this.efatura, iud));
  }
}

@Module({})
export class EfaturaModule {
  static forRoot(options: EfaturaModuleOptions): DynamicModule {
    return {
      module: EfaturaModule,
      controllers: [EfaturaController],
      providers: [{ provide: EFATURA, useValue: options.efatura }],
      exports: [EFATURA],
    };
  }
}

function send(response: Response, result: HttpResult): void {
  for (const [name, value] of Object.entries(result.headers ?? {})) {
    response.setHeader(name, value);
  }

  response.status(result.status).send(result.body);
}
