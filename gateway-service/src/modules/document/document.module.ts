import { Module } from '@nestjs/common';
import { DocumentService } from './document.service.js';
import { DocumentController } from './document.controller.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document } from './entities/document.entity.js';
import { User } from '../user/entities/user.entity.js';
import { BullModule } from '@nestjs/bullmq';
import { HttpModule } from '@nestjs/axios';
import { DocumentProcessor } from './document.processor.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Document,User]),
    BullModule.registerQueue({
      name: 'document-processing-queue',
    }),
    HttpModule,
  ],
  controllers: [DocumentController],
  providers: [DocumentService, DocumentProcessor],
  exports: [DocumentService],
})
export class DocumentModule {}
