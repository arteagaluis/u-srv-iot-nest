import { Controller, Post, Body, Get, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GoogleLoginDto } from './dto/google-login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Post('google')
    @HttpCode(HttpStatus.OK)
    async googleLogin(@Body() googleLoginDto: GoogleLoginDto) {
        return this.authService.loginWithGoogle(googleLoginDto.idToken);
    }

    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
        // In a production app, you might want to extract userId from the refreshToken payload
        // or use a dedicated RefreshTokenGuard. For simplicity and as requested:
        // We expect the frontend to send both userId and refreshToken or we decode it here.
        // Let's decode it to get the userId (sub).
        return this.authService.refreshTokens(
            refreshTokenDto.userId,
            refreshTokenDto.refreshToken,
        );
    }

    @UseGuards(JwtAuthGuard)
    @Get('me')
    async getMe(@Req() req: any) {
        return this.authService.getMe(req.user.userId);
    }
}
