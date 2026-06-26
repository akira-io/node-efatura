import { EfaturaValidationError } from '../errors';

export function calculateLuhnCheckDigit(payload: string): string {
  assertDigits(payload, 'payload');

  let sum = 0;
  let shouldDouble = true;

  for (let index = payload.length - 1; index >= 0; index -= 1) {
    let digit = Number(payload[index]);

    if (shouldDouble) {
      digit *= 2;

      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return String((10 - (sum % 10)) % 10);
}

export function validateLuhn(payloadWithCheckDigit: string): boolean {
  assertDigits(payloadWithCheckDigit, 'payloadWithCheckDigit');

  if (payloadWithCheckDigit.length < 2) {
    return false;
  }

  const payload = payloadWithCheckDigit.slice(0, -1);
  const checkDigit = payloadWithCheckDigit.slice(-1);

  return calculateLuhnCheckDigit(payload) === checkDigit;
}

function assertDigits(value: string, field: string): void {
  if (!/^\d+$/.test(value)) {
    throw new EfaturaValidationError(field, 'Luhn payload must contain only digits.', 'iud.digits');
  }
}
