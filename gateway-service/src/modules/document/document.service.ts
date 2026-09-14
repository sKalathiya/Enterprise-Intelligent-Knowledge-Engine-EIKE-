import { BadRequestException, HttpException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document, DocumentStatus } from './entities/document.entity.js';
import { User } from '../user/entities/user.entity.js';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import path from 'path';
import { HttpService } from '@nestjs/axios';
import { Readable } from 'stream';
import type { Request, Response } from 'express';
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

  // read tommorro

  async pipeSearchDocuments(query: string, user_id: string, req: Request, res: Response) {
    const response = await this.httpService.axiosRef.post(
      `${process.env.DOCUMENT_SERVICE_URL}/query`,
      { query, user_id },
      {
        headers: {
          'X-Internal-Api-Key': process.env.API_KEY,
          'Content-Type': 'application/json',
        },
        responseType: 'stream',
        timeout: 0,
      },
    );

    const stream = response.data as Readable;
    res.status(response.status);
    const contentType = response.headers['content-type'];
    res.setHeader('Content-Type', typeof contentType === 'string' ? contentType : 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    await new Promise<void>((resolve, reject) => {
      const abort = () => {
        stream.destroy();
      };
      req.once('close', abort);
      stream.once('error', (error) => {
        req.off('close', abort);
        if (!res.writableEnded) res.end();
        reject(error);
      });
      res.once('finish', () => {
        req.off('close', abort);
        resolve();
      });
      stream.pipe(res);
    });
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
