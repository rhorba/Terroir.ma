import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from '../../../src/common/controllers/user.controller';
import { CurrentUserPayload } from '../../../src/common/decorators/current-user.decorator';

function buildUser(overrides: Partial<CurrentUserPayload> = {}): CurrentUserPayload {
  return {
    sub: 'user-uuid',
    preferred_username: 'ahmed.admin',
    email: 'ahmed@coop.ma',
    realm_access: { roles: ['super-admin', 'offline_access'] },
    cooperative_id: undefined,
    ...overrides,
  };
}

describe('UserController — US-086', () => {
  let controller: UserController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
    }).compile();

    controller = module.get<UserController>(UserController);
  });

  describe('getMe()', () => {
    it('returns the full CurrentUserPayload from JWT claims', () => {
      const user = buildUser();
      const result = controller.getMe(user);
      expect(result).toBe(user);
      expect(result.sub).toBe('user-uuid');
      expect(result.email).toBe('ahmed@coop.ma');
    });
  });

  describe('getMyRoles()', () => {
    it('returns realm_access.roles from the JWT payload', () => {
      const user = buildUser();
      const result = controller.getMyRoles(user);
      expect(result).toEqual({ roles: ['super-admin', 'offline_access'] });
    });

    it('returns empty array when realm_access has no roles', () => {
      const user = buildUser({ realm_access: { roles: [] } });
      const result = controller.getMyRoles(user);
      expect(result).toEqual({ roles: [] });
    });
  });
});
