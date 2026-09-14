import { BadRequestException, HttpException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
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
import { Team } from '../team/entities/team.entity.js';
import { TeamDocument } from '../team/entities/team-document.entity.js';
import { SearchQueryDto } from './dto/search-query.dto.js';


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
  ) {}


  async uploadDocument(file: any, user_id: string, team_id: string) {

    if(!file) {
      throw new BadRequestException("File is required!")
    }

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
      
    const newDocument = this.documentRepository.create({
      fileName: file.originalname,
      storageUrl: path.join(process.env.SHARED_UPLOAD || '', file.filename), // Maps to our local hot-reload file workspace path
      status: DocumentStatus.PENDING,
    });

    newDocument.user = user;
    const savedDocument = await this.documentRepository.save(newDocument)
      const teamDocument = this.teamDocumentRepository.create({
        team: team,
        document: savedDocument,
      });
      await this.teamDocumentRepository.save(teamDocument);
    
    console.log("Adding document to queue", savedDocument.id);
    await this.documentProcessingQueue.add('document-processing', {
      documentId: savedDocument.id,
      path: savedDocument.storageUrl,
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
    const user = await this.userRepository.findOne({where: {id: user_id} , relations: {teams: {team: {documents: {document: true}}}}});
    if(!user) {
      throw new NotFoundException("User not found!")
    }

    const documents = user.teams.flatMap(member => member.team.documents.map(row => row.document)).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return documents;
  }

  async getTeamDocuments(team_id: string, user_id: string) {
    const user = await this.userRepository.findOneBy({id: user_id});
    if(!user) {
      throw new NotFoundException("User not found!")
    }
    const team = await this.teamRepository.findOne({where: {id: team_id}, relations: {documents: {document: true} , members: {user: true}}});
    if(!team) {
      throw new NotFoundException("Team not found!")
    }
    const isMember = team.members.some((member) => member.user.id === user_id)
    if(!isMember) {
      throw new BadRequestException("You are not a member of this group!")
    } 

    return team.documents.map(row => row.document);
  }

  async shareDocument(documentId: string, userId: string, teamIds: string[]) {
    const doc = await this.documentRepository.findOneBy({id: documentId, user: {id: userId}});
    if(!doc) {
      throw new NotFoundException("Document not found!")
    }
    const teams = await this.teamRepository.find({where: {id: In(teamIds)}, relations: {members: {user: true}}});
    if(teams.length === 0){
      throw new BadRequestException("No teams found!")
    }
    if(teams.length !== teamIds.length) {
      throw new BadRequestException("Invalid team IDs!")
    }
    let message: string = "Shared Document Status:";

    
    for(const team of teams) {
      const isMember = team.members.some((member) => member.user.id === userId)
      if(!isMember) {
        message += ` ${team.name} - You are not a member of this group!`;
        continue;
      }
      const teamDocuments = await this.teamDocumentRepository.find({where: {document: {id: documentId}, team: {id: team.id}}});
      if(teamDocuments.length > 0) {
        message += ` ${team.name} - Document already shared with this team!`;
        continue;
      }
      const teamDocument = this.teamDocumentRepository.create({
        team: team,
        document: doc,
      });
      await this.teamDocumentRepository.save(teamDocument);
      message += ` ${team.name} - Document shared successfully!`;
    }
    return { status: 'shared', id: documentId, message: message };
  }

  async unshareDocument(documentId: string, userId: string, teamIds: string[]) {
    const doc = await this.documentRepository.findOneBy({id: documentId, user: {id: userId}});
    if(!doc) {
      throw new NotFoundException("Document not found!")
    }
  
    const teams = await this.teamRepository.find({where: {id: In(teamIds)}, relations: {members: {user: true}}});
    if(teams.length === 0){
      throw new BadRequestException("No teams found!")
    }
    if(teams.length !== teamIds.length) {
      throw new BadRequestException("Invalid team IDs!")
    }
    let message: string = "Unshared Document Status:";
    for(const team of teams) {
      const isMember = team.members.some((member) => member.user.id === userId)
      if(!isMember) {
        message += ` ${team.name} - You are not a member of this group!`;
        continue;
      }
      const teamDocuments = await this.teamDocumentRepository.find({where: {document: {id: documentId}, team: {id: team.id}}});
      if(teamDocuments.length === 0) {
        message += ` ${team.name} - Document not shared with this team!`;
        continue;
      }
      await this.teamDocumentRepository.delete(teamDocuments[0].id).catch((error) => undefined);
      message += ` ${team.name} - Document unshared successfully!`;
    }
    return { status: 'unshared', id: documentId, message: message };
  }

  async pipeSearchDocuments(query: string, team_id: string, user_id: string, req: Request, res: Response) {
    const user = await this.userRepository.findOneBy({id: user_id});
    if(!user) {
      throw new NotFoundException("User not found!") 
    }
    const isMember = await this.teamRepository.findOne({where: {id: team_id, members: {user: {id: user_id}}}}).then(team => team ? true : false);
    if(!isMember) {
      throw new BadRequestException("You are not a member of this group!")
    } 

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

    const doc = await this.documentRepository.findOne({where: {id: documentId , user: {id: userId} } , relations: {teams: true}})
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
      { documentId: doc.id, path: doc.storageUrl },
      { jobId: doc.id, removeOnComplete: true, attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
    );
    return doc;
  }

}
