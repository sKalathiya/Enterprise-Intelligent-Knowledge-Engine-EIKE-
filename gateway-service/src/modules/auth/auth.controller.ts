import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HttpCode, HttpStatus } from '@nestjs/common';
import { LoginDto } from './dto/login.dto.js';

@ApiTags("Authentication Gateway")
@Controller('auth')
export class AuthController {

    constructor( private readonly authService: AuthService) {}

    @Post('register')
    @ApiOperation({ summary: 'Register a new enterprise user account' })
    @ApiResponse({ status: 201, description: 'User account successfully registered.' })
    @ApiResponse({ status: 400, description: 'Payload validation parameters failed.' })
    @ApiResponse({ status: 409, description: 'Email address already exists in database.' })
    async register(@Body() registerDto: RegisterDto): Promise<{ msg: string }> {
        return this.authService.register(registerDto);
    }

    @Post('login')
    @HttpCode(HttpStatus.OK) // Changes default POST response status from 21 Created to 200 OK
    @ApiOperation({ summary: 'Authenticate user credentials and mint a stateless JWT pass' })
    @ApiResponse({ status: 200, description: 'Authentication successful. Returning access token.' })
    @ApiResponse({ status: 401, description: 'Invalid login credentials provided.' })
    async login(@Body() loginDto: LoginDto): Promise<{ accessToken: string }> {
        return this.authService.login(loginDto);
    }
}
