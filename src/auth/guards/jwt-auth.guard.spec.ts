import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from './jwt-auth.guard';
import { UnauthorizedException, ExecutionContext } from '@nestjs/common';

describe('JwtAuthGuard', () => {
    let guard: JwtAuthGuard;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [JwtAuthGuard],
        }).compile();

        guard = module.get<JwtAuthGuard>(JwtAuthGuard);
    });

    it('should be defined', () => {
        expect(guard).toBeDefined();
    });

    describe('handleRequest', () => {
        it('should return user if no error', () => {
            const user = { id: '123' };
            expect(guard.handleRequest(null, user, null)).toBe(user);
        });

        it('should throw UnauthorizedException if no user', () => {
            expect(() => guard.handleRequest(null, null, null)).toThrow(UnauthorizedException);
        });

        it('should throw error if error is passed', () => {
            const err = new Error('test');
            expect(() => guard.handleRequest(err, null, null)).toThrow(err);
        });
    });
});
