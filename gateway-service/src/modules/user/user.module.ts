import { Module } from '@nestjs/common';
import { UserService } from './user.service.js';
import { UserController } from './user.controller.js';
import { User } from './entities/user.entity.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [TypeOrmModule.forFeature([User]),
    HttpModule,
    BullModule.registerQueue({
      name: 'document-processing-queue',
    }),
],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
