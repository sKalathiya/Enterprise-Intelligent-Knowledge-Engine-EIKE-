import { Module } from '@nestjs/common';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { envSchema } from './config/env.config.js';

// import { ThrottlerModule } from '@nestjs/throttler';

export const { ObserveModule, ObserveInstrument } = createObserveModule();
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './modules/user/entities/user.entity.js';
import { Document } from './modules/document/entities/document.entity.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { UserModule } from './modules/user/user.module.js';
import { DocumentModule } from './modules/document/document.module.js';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.gaurd.js';
import { APP_GUARD } from '@nestjs/core';

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
        entities: [User, Document],
        synchronize: true,
        logging:['error','query'],
      }),
    }),

    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../.env',
      validationSchema: envSchema,
    }),
    // ThrottlerModule.forRoot([{
    //   ttl: 60000, 
    //   limit: 100,
    // }]),
    // Distributed tracing, auto-correlated logs, request/job metrics, error
    // telemetry, alarms, and more — out of the box. Sign up at https://observe.nestjs.com
    ObserveModule.forRoot({
      appKey: 'YOUR_APP_KEY',
      appSecret: 'YOUR_APP_SECRET',
      serviceId: 'gateway-service',
    }),
    AuthModule,
    DocumentModule,
    UserModule,
  ],
  controllers: [AppController],
  providers: [AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    }
  ],
})
export class AppModule {}
