import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { envSchema } from './config/env.config.js';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './modules/user/entities/user.entity.js';
import { Document } from './modules/document/entities/document.entity.js';
import { Team } from './modules/team/entities/team.entity.js';
import { TeamMember } from './modules/team/entities/team-member.entity.js';
import { TeamDocument } from './modules/team/entities/team-document.entity.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { UserModule } from './modules/user/user.module.js';
import { DocumentModule } from './modules/document/document.module.js';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.gaurd.js';
import { APP_GUARD } from '@nestjs/core';
import { TeamModule } from './modules/team/team.module.js';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('POSTGRES_HOST'),
        port: configService.get('POSTGRES_PORT'),
        username: configService.get('POSTGRES_USER'),
        password: configService.get('POSTGRES_PASSWORD'),
        database: configService.get('POSTGRES_DB'),
        entities: [User, Document, Team, TeamMember, TeamDocument],
        // Auto-creates gateway tables. Convenient locally; switch to migrations before production schema changes.
        synchronize: false,
      }),
    }),

    // Redis connection for BullMQ. maxRetriesPerRequest: null is required for blocking queue commands.
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get('REDIS_HOST'),
          port: configService.get('REDIS_PORT'),
          maxRetriesPerRequest: null,
        },
      }),
    }),

    ConfigModule.forRoot({
      isGlobal: true,
      // Local run uses gateway-service/.env; Compose uses the repo-root .env.
      envFilePath:
        process.env.NODE_ENV === 'test'
          ? ['.env.test', '../.env.test', '.env', '../.env']
          : ['.env', '../.env'],
      validationSchema: envSchema,
    }),
    AuthModule,
    DocumentModule,
    UserModule,
    TeamModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      // Every HTTP route requires a JWT unless the handler is marked @Public() (register/login).
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
