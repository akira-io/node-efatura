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
import { EfaturaError } from '../../domain/errors';
import type { Efatura } from '../../efatura';
import {
  type HttpResult,
  handleBuildEventXml,
  handleBuildXml,
  handleBuildZip,
  handleFiscalReadiness,
  handleRenderDfa,
  handleRenderDfaFromBody,
  handleSubmitMiddleware,
} from '../shared/http';

export const EFATURA = 'EFATURA';

export interface EfaturaModuleOptions {
  efatura: Efatura;
  allowUnauthenticated?: boolean;
}

@Controller('efatura')
export class EfaturaController {
  constructor(@Inject(EFATURA) private readonly efatura: Efatura) {}

  @Post('dfe/xml')
  async buildXml(@Body() body: unknown, @Res() response: Response): Promise<void> {
    send(response, await handleBuildXml(this.efatura, body));
  }

  @Post('event/xml')
  async buildEventXml(@Body() body: unknown, @Res() response: Response): Promise<void> {
    send(response, await handleBuildEventXml(this.efatura, body));
  }

  @Post('dfe/zip')
  async buildZip(@Body() body: unknown, @Res() response: Response): Promise<void> {
    send(response, await handleBuildZip(this.efatura, body));
  }

  @Post('dfe/submit/middleware')
  async submitMiddleware(@Body() body: unknown, @Res() response: Response): Promise<void> {
    send(response, await handleSubmitMiddleware(this.efatura, body));
  }

  @Post('dfe/validate/fiscal-readiness')
  async validateFiscalReadiness(@Body() body: unknown, @Res() response: Response): Promise<void> {
    send(response, await handleFiscalReadiness(this.efatura, body));
  }

  @Post('dfa')
  async renderDfaFromBody(@Body() body: unknown, @Res() response: Response): Promise<void> {
    send(response, await handleRenderDfaFromBody(this.efatura, body));
  }

  @Get('dfa/:iud')
  async renderDfa(@Param('iud') iud: string, @Res() response: Response): Promise<void> {
    send(response, await handleRenderDfa(this.efatura, iud));
  }
}

@Module({})
export class EfaturaModule {
  static forRoot(options: EfaturaModuleOptions): DynamicModule {
    if (options.allowUnauthenticated !== true) {
      throw new EfaturaError(
        'EfaturaModule exposes unauthenticated routes. Apply a global guard (e.g. APP_GUARD) and set `allowUnauthenticated: true` to acknowledge.',
      );
    }

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
