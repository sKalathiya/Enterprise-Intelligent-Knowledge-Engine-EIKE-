import { BadRequestException, HttpException, Inject, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
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
import { TeamMember } from '../team/entities/team-member.entity.js';
import { PRIVATE_TEAM_NAME, Team } from '../team/entities/team.entity.js';
import { TeamDocument } from '../team/entities/team-document.entity.js';
import { SearchQueryDto } from './dto/search-query.dto.js';
import { S3Service } from './s3Service.js';
import { PresignDocumentDto } from './dto/presign-document.js';
import { randomUUID } from 'crypto';
import { HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';


@Injectable()
export class DocumentService {

  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>,
    @InjectRepository(TeamDocument)
    private readonly teamDocumentRepository: Repository<TeamDocument>,
    @InjectQueue('document-processing-queue')
    private readonly documentProcessingQueue: Queue,
    private readonly httpService: HttpService,
    private readonly s3Service: S3Service,  
  ) {}


  async presignDocument(dto: PresignDocumentDto, user_id: string) {
    const client = this.s3Service.requireClient();
    const { team_id, fileName, contentType, contentLength } = dto;
    const user = await this.userRepository.findOneBy({id: user_id});
    if(!user) {
      throw new NotFoundException("Authorized User Context not found!")
    }

    const team = await this.teamRepository.findOne({
          where: { id: team_id },
          relations: { members: { user: true } },
        })
    if (!team) {
      throw new NotFoundException("Team not found!")
    }

    const isMember = team.members.some((member) => member.user.id === user_id)
      
    if (!isMember) {
      throw new BadRequestException("You are not a member of this group.");
    }

    const basename = path.basename(fileName);
    // Reject path traversal (../) and names that are not a plain basename.
    if(!basename || basename.includes('..') || basename !== dto.fileName) {
      throw new BadRequestException("Invalid file name!")
    }

    const id = randomUUID();
    // Object key, not a URL. Browser PUTs here; ingest worker GetObject's the same key.
    const key = `users/${user_id}/documents/${id}/${basename}`;

    const savedDocument = await this.documentRepository.manager.transaction(async (manager) => {
      const documentRepo = manager.getRepository(Document);
      const teamDocumentRepo = manager.getRepository(TeamDocument);
      const newDocument = await documentRepo.save(documentRepo.create({
        id,
        fileName: basename,
        storageUrl: key,
        status: DocumentStatus.UPLOADING,
        user: user,
      }));
      const teamDocument = await teamDocumentRepo.save(teamDocumentRepo.create({
        team: team,
        document: newDocument,
      }));
      return newDocument;
    });

    // Short-lived PUT URL. Client must send the same Content-Type and byte length or S3 rejects.
    const uploadUrl = await getSignedUrl(client, new PutObjectCommand({
      Bucket: this.s3Service.bucket,
      Key: key,
      ContentType: contentType,
      ContentLength: contentLength,
    }), { expiresIn: 300 });


    return {
      id: savedDocument.id,
      uploadUrl: uploadUrl,
      bucket: this.s3Service.bucket,
      key: key,
      headers: {
        'Content-Type': contentType,
        'Content-Length': contentLength,
      },
    };
  }

  async completeDocument(documentId: string, user_id: string) {
    const client = this.s3Service.requireClient();
    const document = await this.documentRepository.findOneBy({id: documentId, user: {id: user_id}});
    if(!document) {
      throw new NotFoundException("Document not found!")
    }
    if(document.status !== DocumentStatus.UPLOADING) {
      throw new BadRequestException("Document is not uploading!")
    }
    if(!document.storageUrl?.startsWith(`users/${user_id}/documents/`)) {
      throw new BadRequestException("Invalid document storage URL!")
    }
    try{
      // Confirm the browser actually PUT the object before we enqueue ingest.
      const head = await client.send(new HeadObjectCommand({
        Bucket: this.s3Service.bucket,
        Key: document.storageUrl,
      }));
      const size = head.ContentLength ?? 0;
      if (size < 1 || size > 10 * 1024 * 1024) {
        throw new BadRequestException('Invalid object size');
      }
      const type = head.ContentType ?? '';
      if (type && type !== 'application/pdf' && type !== 'text/plain') {
        throw new BadRequestException('Invalid object type');
      }
      document.status = DocumentStatus.PENDING;
      await this.documentRepository.save(document);
    } catch(error) {
      // Missing object, wrong size, or wrong type all become this message.
      throw new BadRequestException("Document not found in S3!")
    }

    await this.documentProcessingQueue.add('document-processing', {
      documentId: documentId,
      bucket: this.s3Service.bucket,
      key: document.storageUrl,
    },
    {
      jobId: documentId, // must equal documentId; ingest worker rejects a mismatch
      removeOnComplete: true,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    });
    return { status: 'queued', id: documentId };
  }

  // async uploadDocument(file: any, user_id: string, team_id: string) {
  // Legacy disk upload. Kept commented; current path is presignDocument + completeDocument.

  //   if(!file) {
  //     throw new BadRequestException("File is required!")
  //   }

  //   const user = await this.userRepository.findOneBy({id: user_id});
  //   if(!user) {
  //     throw new NotFoundException("Authorized User Context not found!")
  //   }

  //   const team = await this.teamRepository.findOne({
  //         where: { id: team_id },
  //         relations: { members: { user: true } },
  //       })
  //   if (!team) {
  //     throw new NotFoundException("Team not found!")
  //   }

  //   const isMember = team.members.some((member) => member.user.id === user_id)
      
  //   if (!isMember) {
  //     throw new BadRequestException("You are not a member of this group.");
  //   }

  //   const newDocument = this.documentRepository.create({
  //     fileName: file.originalname,
  //     storageUrl: path.join(process.env.SHARED_UPLOAD || '', file.filename), // Maps to our local hot-reload file workspace path
  //     status: DocumentStatus.PENDING,
  //   });
  //   newDocument.user = user;
  //   const savedDocument = await this.documentRepository.manager.transaction(async (manager): Promise<Document> => {
  //     const documentRepo = manager.getRepository(Document);
  //     const teamDocumentRepo = manager.getRepository(TeamDocument);
  //     const savedDocument = await documentRepo.save(newDocument)
  //       const teamDocument = teamDocumentRepo.create({
  //         team: team,
  //         document: savedDocument,
  //       });
  //       await teamDocumentRepo.save(teamDocument);
  //       return savedDocument;
  // });

  // console.log("Adding document to queue", savedDocument.id);
  //   await this.documentProcessingQueue.add('document-processing', {
  //     documentId: savedDocument.id,
  //     path: savedDocument.storageUrl,
  //   },
  //   {
  //     jobId: savedDocument.id,
  //     removeOnComplete: true,
  //     attempts: 3,
  //     backoff: {
  //       type: 'exponential',
  //       delay: 5000,
  //     },
  //   });
  
  //   return savedDocument;
  // }


  async getUserDocuments(user_id: string) {
    const user = await this.userRepository.findOne({where: {id: user_id} , relations: {teams: {team: {documents: {document: true}}}}});
    if(!user) {
      throw new NotFoundException("User not found!")
    }

    const documents = [
      ...new Map(
        user.teams
          .flatMap((member) => member.team.documents.map((row) => row.document))
          .map((document) => [document.id, document]),
      ).values(),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    // Deduped: a file shared to several of the user's teams appears once.
    return documents;
  }

  async getTeamDocuments(team_id: string, user_id: string) {
    const team = await this.teamRepository.findOne({
      where: { id: team_id , members: {user: {id: user_id}} },
      relations: { documents: { document: { user: true } } },
    });
    if(!team) {
      throw new NotFoundException("Team not found!")
    }
    return team.documents.map(row => row.document);
  }

  async shareDocument(documentId: string, userId: string, teamIds: string[]) {
    const doc = await this.documentRepository.findOneBy({id: documentId, user: {id: userId}});
    if(!doc) {
      throw new NotFoundException("Document not found!")
    }
    const teams = await this.teamRepository.find({where: {id: In(teamIds), members: {user: {id: userId}}}});
    if(teams.length === 0){
      throw new BadRequestException("No teams found!")
    }
    if(teams.length !== teamIds.length) {
      throw new BadRequestException("Invalid team IDs!")
    }
    if(teams.some((team) => team.name === PRIVATE_TEAM_NAME)) {
      // Private is the owner's inbox, not a share target.
      throw new BadRequestException("Cannot Share Document with Private Team!")
    }
    let message: string = "Shared Document Status:";
    
    for(const team of teams) {
      const teamDocument = await this.teamDocumentRepository.findOne({where: {document: {id: documentId}, team: {id: team.id}}});
      if(teamDocument) {
        message += ` ${team.name} - Document already shared with this team!`;
        continue;
      }
      const teamDoc = this.teamDocumentRepository.create({
        team: team,
        document: doc,
      });
      await this.teamDocumentRepository.save(teamDoc);
      message += ` ${team.name} - Document shared successfully!`;
    }
    return { status: 'shared', id: documentId, message: message };
  }

  async unshareDocument(documentId: string, userId: string, teamIds: string[]) {
    const doc = await this.documentRepository.findOneBy({id: documentId, user: {id: userId}});
    if(!doc) {
      throw new NotFoundException("Document not found!")
    }
  
    const teams = await this.teamRepository.find({where: {id: In(teamIds), members: {user: {id: userId}}}});
    if(teams.length === 0){
      throw new BadRequestException("No teams found!")
    }
    if(teams.length !== teamIds.length) {
      throw new BadRequestException("Invalid team IDs!")
    }
    if(teams.some((team) => team.name === PRIVATE_TEAM_NAME)) {
      throw new BadRequestException("Private team cannot be unshared!")
    }
    let message: string = "Unshared Document Status:";
    for(const team of teams) {
      const teamDocument = await this.teamDocumentRepository.findOne({where: {document: {id: documentId}, team: {id: team.id}}, relations: {document: {teams: true}}});
      if(!teamDocument) {
        message += ` ${team.name} - Document not shared with this team!`;
        continue;
      }
      
      await this.documentRepository.manager.transaction(async (manager) => {
        const remaining = teamDocument.document.teams.length;
        const teamDocumentRepo = manager.getRepository(TeamDocument);
        if (remaining === 1) {
          // A file must stay on at least one team. Last share → owner's Private team.
          const privateTeam = await this.getOrCreatePrivateTeam(manager, userId);
          await teamDocumentRepo.save(teamDocumentRepo.create({team: privateTeam, document: teamDocument.document}));
        }
        await teamDocumentRepo.delete(teamDocument.id);
      });
      message += ` ${team.name} - Document unshared successfully!`;
    }
    return { status: 'unshared', id: documentId, message: message };
  }

  private async getOrCreatePrivateTeam(manager: EntityManager, userId: string) {
    const teamRepo = manager.getRepository(Team);
    const memberRepo = manager.getRepository(TeamMember);
    let privateTeam = await teamRepo.findOne({
      where: { name: PRIVATE_TEAM_NAME, owner: { id: userId } },
    });
    if (!privateTeam) {
      privateTeam = await teamRepo.save(
        teamRepo.create({ name: PRIVATE_TEAM_NAME, owner: { id: userId } }),
      );
      await memberRepo.save(
        memberRepo.create({ team: privateTeam, user: { id: userId } }),
      );
    }
    return privateTeam;
  }

  async pipeSearchDocuments(query: string, team_id: string, user_id: string, req: Request, res: Response) {
    const isMember = await this.teamRepository.findOne({where: {id: team_id, members: {user: {id: user_id}}}}).then(team => team ? true : false);
    if(!isMember) {
      throw new BadRequestException("You are not a member of this group!")
    } 

    // Worker never sees JWT. We send only completed document IDs this team is allowed to search.
    const documentIds = await this.teamDocumentRepository.find({where: {team: {id: team_id} , document: {status: DocumentStatus.COMPLETED}} , relations: {document: true}, select: {id: true, document: {id: true}}}).then(docs => docs.map(doc => doc.document.id));

    if(documentIds.length === 0) {
      throw new BadRequestException("No completed documents found!")
    }

    const response = await this.httpService.axiosRef.post(
      `${process.env.DOCUMENT_SERVICE_URL}/query`,
      { query, document_ids: documentIds },
      {
        headers: {
          'X-Internal-Api-Key': process.env.API_KEY,
          'Content-Type': 'application/json',
        },
        responseType: 'stream',
        timeout: 0, // SSE; do not abort while tokens are still arriving
      },
    );

    const stream = response.data as Readable;
    res.status(response.status);
    const contentType = response.headers['content-type'];
    res.setHeader('Content-Type', typeof contentType === 'string' ? contentType : 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // nginx/Caddy must not buffer this stream
    res.flushHeaders();

    await new Promise<void>((resolve, reject) => {
      const abort = () => {
        stream.destroy(); // client hung up → stop pulling from FastAPI
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

    const doc = await this.documentRepository.findOne({where: {id: documentId , user: {id: userId}, status: In([DocumentStatus.COMPLETED, DocumentStatus.FAILED, DocumentStatus.UPLOADING]) }})
    if(!doc){
      throw new NotFoundException("No such document found!")
    }
    await this.documentRepository.remove(doc); 
    await this.documentProcessingQueue.remove(doc.id).catch(() => undefined);
    await firstValueFrom(
    this.httpService.delete(
      `${process.env.DOCUMENT_SERVICE_URL}/chunks/document/${documentId}`,
      {
        headers: { 'X-Internal-Api-Key': process.env.API_KEY as string },
      },
    ),
  );
  // Row, queue job, worker vectors, then S3 object. Chunk/S3 deletes are best-effort if already gone.
  if (doc.storageUrl) {
    await this.s3Service.deleteObject(doc.storageUrl).catch(() => undefined);
  }
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
    // Same jobId as complete: BullMQ will not enqueue a duplicate while one is still active.
    await this.documentProcessingQueue.add('document-processing', { documentId: doc.id, key: doc.storageUrl, bucket: this.s3Service.bucket }, { jobId: doc.id, removeOnComplete: true, attempts: 3, backoff: { type: 'exponential', delay: 5000 } });
    return doc;
  }

}
