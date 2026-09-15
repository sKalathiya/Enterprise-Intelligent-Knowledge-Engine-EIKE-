import { Module } from '@nestjs/common';
import { UserService } from './user.service.js';
import { UserController } from './user.controller.js';
import { User } from './entities/user.entity.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bullmq';
import { Document } from '../document/entities/document.entity.js';
import { Team } from '../team/entities/team.entity.js';
import { S3Service } from '../document/s3Service.js';

@Module({
  imports: [TypeOrmModule.forFeature([User, Document, Team]),
    HttpModule,
    BullModule.registerQueue({
      name: 'document-processing-queue',
    }),
],
  controllers: [UserController],
  providers: [UserService, S3Service],
})
export class UserModule {}
