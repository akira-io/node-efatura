import type { EfaturaDependencies } from './application/efatura-options';
import { type EfaturaConfig, type ResolvedEfaturaConfig, resolveConfig } from './config';
import { Efatura } from './efatura';

export interface CreateEfaturaOptions extends EfaturaDependencies {}

export function createEfatura(config: EfaturaConfig, options: CreateEfaturaOptions = {}): Efatura {
  return new Efatura(resolveConfig(config), options);
}

export type { EfaturaConfig, ResolvedEfaturaConfig };
