import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

const mockAuthService = {
    loginWithGoogle: jest.fn(),
    refreshTokens: jest.fn(),
    getMe: jest.fn(),
};

describe('AuthController', () => {
    let controller: AuthController;
    let service: AuthService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [AuthController],
            providers: [
                { provide: AuthService, useValue: mockAuthService },
            ],
        }).compile();

        controller = module.get<AuthController>(AuthController);
        service = module.get<AuthService>(AuthService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('googleLogin', () => {
        it('should call authService.loginWithGoogle', async () => {
            const dto = { idToken: 'test_token' };
            await controller.googleLogin(dto);
            expect(service.loginWithGoogle).toHaveBeenCalledWith(dto.idToken);
        });
    });

    describe('refresh', () => {
        it('should call authService.refreshTokens', async () => {
            const dto = { userId: '123', refreshToken: 'ref_token' };
            await controller.refresh(dto);
            expect(service.refreshTokens).toHaveBeenCalledWith(dto.userId, dto.refreshToken);
        });
    });

    describe('getMe', () => {
        it('should call authService.getMe', async () => {
            const req = { user: { userId: '123' } };
            await controller.getMe(req);
            expect(service.getMe).toHaveBeenCalledWith('123');
        });
    });
});
