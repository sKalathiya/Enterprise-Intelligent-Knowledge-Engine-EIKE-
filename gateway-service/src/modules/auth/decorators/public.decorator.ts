import { SetMetadata } from '@nestjs/common';

// JwtAuthGuard reads this metadata. Use @Public() on routes that must work without a Bearer token.
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);