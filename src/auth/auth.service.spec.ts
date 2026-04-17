import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { getModelToken } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { User } from '../users/schemas/user.schema';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

const mockUser = {
    _id: 'anyid',
    email: 'test@gmail.com',
    name: 'Test User',
    picture: 'test.jpg',
    hashedRefreshToken: 'hashed_ref',
};

const mockUserModel = {
    findOne: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
};

const mockJwtService = {
    signAsync: jest.fn(),
};

const mockConfigService = {
    get: jest.fn((key: string) => {
        if (key === 'GOOGLE_CLIENT_ID') return 'google_id';
        if (key === 'JWT_ACCESS_SECRET') return 'access_secret';
        if (key === 'JWT_REFRESH_SECRET') return 'refresh_secret';
        return null;
    }),
};

// Mock google-auth-library
jest.mock('google-auth-library', () => {
    return {
        OAuth2Client: jest.fn().mockImplementation(() => {
            return {
                verifyIdToken: jest.fn().mockImplementation(({ idToken }) => {
                    if (idToken === 'valid_token') {
                        return {
                            getPayload: () => ({
                                email: 'test@gmail.com',
                                name: 'Test User',
                                picture: 'test.jpg',
                            }),
                        };
                    }
                    throw new Error('Invalid token');
                }),
            };
        }),
    };
});

describe('AuthService', () => {
    let service: AuthService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                { provide: getModelToken(User.name), useValue: mockUserModel },
                { provide: JwtService, useValue: mockJwtService },
                { provide: ConfigService, useValue: mockConfigService },
            ],
        }).compile();

        service = module.get<AuthService>(AuthService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('loginWithGoogle', () => {
        it('should login an existing user', async () => {
            mockUserModel.findOne.mockResolvedValue(mockUser);
            mockJwtService.signAsync.mockResolvedValue('token');
            jest.spyOn(bcrypt, 'hash').mockImplementation(() => Promise.resolve('hashed'));

            const result = await service.loginWithGoogle('valid_token');

            expect(result.accessToken).toBeDefined();
            expect(result.user.email).toBe(mockUser.email);
            expect(mockUserModel.findOne).toHaveBeenCalledWith({ email: mockUser.email });
        });

        it('should create and login a new user', async () => {
            mockUserModel.findOne.mockResolvedValue(null);
            mockUserModel.create.mockResolvedValue(mockUser);
            mockJwtService.signAsync.mockResolvedValue('token');
            jest.spyOn(bcrypt, 'hash').mockImplementation(() => Promise.resolve('hashed'));

            const result = await service.loginWithGoogle('valid_token');

            expect(mockUserModel.create).toHaveBeenCalled();
            expect(result.accessToken).toBeDefined();
        });

        it('should throw UnauthorizedException if google validation fails', async () => {
            await expect(service.loginWithGoogle('invalid_token')).rejects.toThrow(UnauthorizedException);
        });
    });

    describe('refreshTokens', () => {
        it('should refresh tokens for valid refresh token', async () => {
            mockUserModel.findById.mockResolvedValue(mockUser);
            jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));
            mockJwtService.signAsync.mockResolvedValue('new_token');
            jest.spyOn(bcrypt, 'hash').mockImplementation(() => Promise.resolve('new_hashed'));

            const result = await service.refreshTokens('anyid', 'valid_refresh');

            expect(result.accessToken).toBeDefined();
            expect(result.refreshToken).toBeDefined();
        });

        it('should throw ForbiddenException if tokens do not match', async () => {
            mockUserModel.findById.mockResolvedValue(mockUser);
            jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(false));

            await expect(service.refreshTokens('anyid', 'invalid_refresh')).rejects.toThrow(ForbiddenException);
        });
    });

    describe('getMe', () => {
        it('should return user data without hashedRefreshToken', async () => {
            const mockResult = {
                select: jest.fn().mockResolvedValue(mockUser),
            };
            mockUserModel.findById.mockReturnValue(mockResult);

            const result = await service.getMe('anyid');

            expect(result).toEqual(mockUser);
            expect(mockResult.select).toHaveBeenCalledWith('-hashedRefreshToken');
        });

        it('should throw UnauthorizedException if user not found', async () => {
            const mockResult = {
                select: jest.fn().mockResolvedValue(null),
            };
            mockUserModel.findById.mockReturnValue(mockResult);

            await expect(service.getMe('anyid')).rejects.toThrow(UnauthorizedException);
        });
    });
});
