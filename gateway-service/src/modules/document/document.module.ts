import { Module } from '@nestjs/common';
import { DocumentService } from './document.service.js';
import { DocumentController } from './document.controller.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document } from './entities/document.entity.js';
import { User } from '../user/entities/user.entity.js';
import { BullModule } from '@nestjs/bullmq';
import { HttpModule } from '@nestjs/axios';
import { Team } from '../team/entities/team.entity.js';
import { TeamMember } from '../team/entities/team-member.entity.js';
import { TeamDocument } from '../team/entities/team-document.entity.js';
import { DocumentQueueListener } from './document.queue.listener.js';
import { S3Service } from './s3Service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Document,User,Team,TeamMember,TeamDocument]),
    BullModule.registerQueue({
      name: 'document-processing-queue',
    }),
    HttpModule,
  ],
  controllers: [DocumentController],
  providers: [DocumentService, DocumentQueueListener, S3Service],
  exports: [DocumentService],
})
export class DocumentModule {}
