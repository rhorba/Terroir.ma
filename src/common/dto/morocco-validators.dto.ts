import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';

/** Validates Moroccan phone number: +212XXXXXXXXX */
export function IsMoroccanPhone(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isMoroccanPhone',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return typeof value === 'string' && /^\+212[5-7]\d{8}$/.test(value);
        },
        defaultMessage(_args: ValidationArguments): string {
          return 'Phone must be in +212XXXXXXXXX format (Morocco)';
        },
      },
    });
  };
}

/** Validates Moroccan CIN/CNIE: 1-2 letters + 5-6 digits */
export function IsMoroccanCIN(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isMoroccanCIN',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return typeof value === 'string' && /^[A-Z]{1,2}\d{5,6}$/.test(value);
        },
        defaultMessage(): string {
          return 'CIN must be 1-2 letters followed by 5-6 digits (e.g., AB123456)';
        },
      },
    });
  };
}

/** Validates ICE (Identifiant Commun de l'Entreprise): exactly 15 digits */
export function IsMoroccanICE(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isMoroccanICE',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return typeof value === 'string' && /^\d{15}$/.test(value);
        },
        defaultMessage(): string {
          return 'ICE must be exactly 15 digits';
        },
      },
    });
  };
}

/** Validates IF (Identifiant Fiscal): 7-8 digits */
export function IsMoroccanIF(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isMoroccanIF',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return typeof value === 'string' && /^\d{7,8}$/.test(value);
        },
        defaultMessage(): string {
          return 'IF must be 7-8 digits';
        },
      },
    });
  };
}
