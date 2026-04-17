import { Test, TestingModule } from '@nestjs/testing';
import { JwtStrategy } from './jwt.strategy';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';

const mockConfigService = {
    get: jest.fn().mockReturnValue('secret'),
};

describe('JwtStrategy', () => {
    let strategy: JwtStrategy;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                JwtStrategy,
                { provide: ConfigService, useValue: mockConfigService },
            ],
        }).compile();

        strategy = module.get<JwtStrategy>(JwtStrategy);
    });

    it('should be defined', () => {
        expect(strategy).toBeDefined();
    });

    describe('validate', () => {
        it('should return user info from payload', async () => {
            const payload = { sub: '123', email: 'test@test.com' };
            const result = await strategy.validate(payload);
            expect(result).toEqual({ userId: '123', email: 'test@test.com' });
        });

        it('should throw UnauthorizedException if sub is missing', async () => {
            const payload = { email: 'test@test.com' };
            await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
        });
    });
});
