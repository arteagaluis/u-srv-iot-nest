import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from '../users/schemas/user.schema';

@Injectable()
export class AuthService {
    private googleClient: OAuth2Client;

    constructor(
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        private jwtService: JwtService,
        private configService: ConfigService,
    ) {
        this.googleClient = new OAuth2Client(
            this.configService.get<string>('GOOGLE_CLIENT_ID'),
        );
    }

    async loginWithGoogle(idToken: string) {
        let email: string;
        let name: string;
        let picture: string;

        // Check if we should skip real Google validation for local testing
        if (this.configService.get<string>('SKIP_GOOGLE_AUTH') === 'true') {
            email = 'test-user@teliot.com';
            name = 'IoT Developer Fake';
            picture = 'https://ui-avatars.com/api/?name=IoT+Dev';
        } else {
            const payload = await this.verifyGoogleToken(idToken);
            if (!payload || !payload.email) {
                throw new UnauthorizedException('Invalid Google token');
            }
            email = payload.email;
            name = payload.name;
            picture = payload.picture;
        }

        let user = await this.userModel.findOne({ email });

        if (!user) {
            user = await this.userModel.create({
                email,
                name,
                picture,
            });
        }

        const tokens = await this.getTokens(user._id.toString(), user.email);
        await this.updateRefreshToken(user._id.toString(), tokens.refreshToken);

        return {
            ...tokens,
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                picture: user.picture,
            },
        };
    }

    async refreshTokens(userId: string, refreshToken: string) {
        const user = await this.userModel.findById(userId);
        if (!user || !user.hashedRefreshToken) {
            throw new ForbiddenException('Access Denied');
        }

        const refreshTokenMatches = await bcrypt.compare(
            refreshToken,
            user.hashedRefreshToken,
        );
        if (!refreshTokenMatches) throw new ForbiddenException('Access Denied');

        const tokens = await this.getTokens(user._id.toString(), user.email);
        await this.updateRefreshToken(user._id.toString(), tokens.refreshToken);

        return tokens;
    }

    async getMe(userId: string) {
        const user = await this.userModel.findById(userId).select('-hashedRefreshToken');
        if (!user) throw new UnauthorizedException();
        return user;
    }

    private async verifyGoogleToken(idToken: string) {
        try {
            const ticket = await this.googleClient.verifyIdToken({
                idToken,
                audience: this.configService.get<string>('GOOGLE_CLIENT_ID'),
            });
            return ticket.getPayload();
        } catch (error) {
            throw new UnauthorizedException('Google validation failed');
        }
    }

    private async getTokens(userId: string, email: string) {
        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(
                { sub: userId, email },
                {
                    secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
                    expiresIn: '15m',
                },
            ),
            this.jwtService.signAsync(
                { sub: userId, email },
                {
                    secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
                    expiresIn: '7d',
                },
            ),
        ]);

        return { accessToken, refreshToken };
    }

    private async updateRefreshToken(userId: string, refreshToken: string) {
        const hashedToken = await bcrypt.hash(refreshToken, 10);
        await this.userModel.findByIdAndUpdate(userId, {
            hashedRefreshToken: hashedToken,
        });
    }
}
