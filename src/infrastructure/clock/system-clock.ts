import type { Clock } from '../../core/contracts';

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
