import { Module } from '@nestjs/common';
import { DocumentService } from './document.service.js';
import { DocumentController } from './document.controller.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document } from './entities/document.entity.js';
import { User } from '../user/entities/user.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Document,User])
  ],
  controllers: [DocumentController],
  providers: [DocumentService],
  exports: [DocumentService],
})
export class DocumentModule {}
