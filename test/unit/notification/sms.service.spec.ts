import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SmsService } from '../../../src/modules/notification/services/sms.service';

const makeConfigService = (nodeEnv: string) => ({
  get: (key: string) => (key === 'NODE_ENV' ? nodeEnv : undefined),
});

describe('SmsService', () => {
  describe('in development mode', () => {
    let service: SmsService;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SmsService,
          { provide: ConfigService, useValue: makeConfigService('development') },
        ],
      }).compile();
      service = module.get<SmsService>(SmsService);
    });

    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('resolves without error in dev mode (logs instead of sending)', async () => {
      await expect(
        service.send({ to: '+212661234567', body: 'Certification accordée' }),
      ).resolves.toBeUndefined();
    });
  });

  describe('in production mode', () => {
    let service: SmsService;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SmsService,
          { provide: ConfigService, useValue: makeConfigService('production') },
        ],
      }).compile();
      service = module.get<SmsService>(SmsService);
    });

    it('resolves without error (gateway not yet configured — drops message)', async () => {
      await expect(
        service.send({ to: '+212661234567', body: 'Certification accordée' }),
      ).resolves.toBeUndefined();
    });
  });
});
