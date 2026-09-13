import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document, DocumentStatus } from './entities/document.entity.js';
import { User } from '../user/entities/user.entity.js';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import path from 'path';

@Injectable()
export class DocumentService {

  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectQueue('document-processing-queue')
    private readonly documentProcessingQueue: Queue,
  ) {}


  async uploadDocument(file: any, user_id: string) {

    const user = await this.userRepository.findOneBy({id: user_id});
    if(!user) {
      throw new NotFoundException("Authorized User Context not found!")
    }

    const newDocument = this.documentRepository.create({
      fileName: file.originalname,
      storageUrl: path.join(process.env.SHARED_UPLOAD || '', file.filename), // Maps to our local hot-reload file workspace path
      status: DocumentStatus.PENDING,
    });

    newDocument.user = user;
    const savedDocument = await this.documentRepository.save(newDocument)
    console.log("Adding document to queue", savedDocument.id);
    await this.documentProcessingQueue.add('document-processing', {
      documentId: savedDocument.id,
      path: savedDocument.storageUrl,
      user_id: user_id,
    },
    {
      jobId: savedDocument.id,
      removeOnComplete: true,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    });

    return savedDocument;
  }


  async getUserDocuments(user_id: string) {
    const documents = await this.documentRepository.find({where: {user: {id: user_id}} , order: {createdAt: 'DESC'}})

    return documents;
  }

}
