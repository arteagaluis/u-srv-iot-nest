import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
    canActivate(context: ExecutionContext) {
        // Add custom logic here if needed (e.g. roles check)
        return super.canActivate(context);
    }

    handleRequest(err, user, info) {
        // You can throw a custom exception here
        if (err || !user) {
            throw err || new UnauthorizedException('Authentication required to access this resource');
        }
        return user;
    }
}
