import { BadRequestException, HttpException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document, DocumentStatus } from './entities/document.entity.js';
import { User } from '../user/entities/user.entity.js';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import path from 'path';
import { HttpService } from '@nestjs/axios';
import { Observable } from 'rxjs';
import { Readable } from 'stream';
import * as fs from 'fs/promises';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class DocumentService {

  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectQueue('document-processing-queue')
    private readonly documentProcessingQueue: Queue,
    private readonly httpService: HttpService,
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


  async searchDocuments(query: string, user_id: string) {
    const internalAPIKey = process.env.API_KEY;
    
    const response = await this.httpService.axiosRef.post(`${process.env.DOCUMENT_SERVICE_URL}/query`, 
      {query: query, user_id: user_id},
      {
        headers: {
          'X-Internal-Api-Key': internalAPIKey,
          'Content-Type': 'application/json',
        },
        responseType: 'stream',
      }
    );

    

    return new Observable(subscriber => {
      const stream = response.data as Readable;
      let buffer = '';

      const emitFrame = (frame: string) => {
        const line = frame.trim();
        if(!line.startsWith('data:')) return;
        const payload = line.slice(5).trim();
        const parsed = JSON.parse(payload);
        if(!subscriber.closed) {
          subscriber.next({ data: parsed });
        }
      };

      const onData = (chunk: any) => {
        buffer += chunk.toString();
        let parts = buffer.split('\n\n');
        buffer = parts.pop() || '';
        for (const part of parts){
          emitFrame(part);
        }
      };

      const onEnd = () => {
        if(buffer.trim()) emitFrame(buffer);
        if(!subscriber.closed) {
          subscriber.complete();
        }
      };
      const onError = (error: any) => {
        subscriber.error(error);
      };
      stream.on('data', onData);
      stream.on('end', onEnd);
      stream.on('error', onError);
      stream.on('close', onEnd);

      return () => {
        stream.off('data', onData);
        stream.off('end', onEnd);
        stream.off('error', onError);
        stream.off('close', onEnd);
        stream.destroy();
      };
    })  ;
  }


  async deleteDocument(documentId: string, userId: string) {

    const doc = await this.documentRepository.findOneBy({id: documentId , user: {id: userId}})
    if(!doc){
      throw new NotFoundException("No such document found!")
    }

    await this.documentProcessingQueue.remove(doc.id).catch((error) => undefined);

    await firstValueFrom(
    this.httpService.delete(
      `${process.env.DOCUMENT_SERVICE_URL}/chunks/document/${documentId}`,
      {
        headers: { 'X-Internal-Api-Key': process.env.API_KEY as string },
      },
    ),
  );
  if (doc.storageUrl) {
    await fs.unlink(doc.storageUrl).catch(() => undefined);
  }
  await this.documentRepository.remove(doc);
  return { status: 'deleted', id: documentId };
  }

  async retryDocument(documentId: string, userId: string) {
    const doc = await this.documentRepository.findOne({
      where: { id: documentId, user: { id: userId } },
    });
    if (!doc) throw new NotFoundException('Document not found');
    if (doc.status !== DocumentStatus.FAILED) {
      throw new BadRequestException('Only failed documents can be retried');
    }
    await this.documentProcessingQueue.remove(documentId).catch(() => undefined);
    doc.status = DocumentStatus.PENDING;
    doc.errorMessage = '';
    await this.documentRepository.save(doc);
    await this.documentProcessingQueue.add(
      'document-processing',
      { documentId: doc.id, path: doc.storageUrl, user_id: userId },
      { jobId: doc.id, removeOnComplete: true, attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
    );
    return doc;
  }

}
