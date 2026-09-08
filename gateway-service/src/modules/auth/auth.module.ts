import { Module } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity.js';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller.js';

@Module({
   imports:[
    TypeOrmModule.forFeature([User]),

    JwtModule.registerAsync({
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
            secret: configService.get<string>("JWT_SECRET"),
            signOptions: {
                expiresIn: '24h'
            }
        })
    })
   ],
   controllers: [AuthController],
   providers: [AuthService],
   exports:[AuthService] 
})
export class AuthModule {}
