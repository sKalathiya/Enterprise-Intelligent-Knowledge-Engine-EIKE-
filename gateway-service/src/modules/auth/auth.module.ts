import { Module } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity.js';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller.js';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { Team } from '../team/entities/team.entity.js';
import { TeamMember } from '../team/entities/team-member.entity.js';

@Module({
   imports:[
    TypeOrmModule.forFeature([User, Team, TeamMember]),
    PassportModule.register({defaultStrategy : 'jwt'}),
    JwtModule.registerAsync({
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
            secret: configService.get<string>("JWT_SECRET"),
            signOptions: {
                expiresIn: '24h', // access token only; there is no refresh-token flow
            }
        })
    })
   ],
   controllers: [AuthController],
   providers: [AuthService, JwtStrategy],
   exports:[AuthService] 
})
export class AuthModule {}
