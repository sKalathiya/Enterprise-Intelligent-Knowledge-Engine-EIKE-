import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document, DocumentStatus } from './entities/document.entity.js';
import { User } from '../user/entities/user.entity.js';

@Injectable()
export class DocumentService {

  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>
  ) {}


  async uploadDocument(file: any, user_id: string) {

    const user = await this.userRepository.findOneBy({id: user_id});
    if(!user) {
      throw new NotFoundException("Authorized User Context not found!")
    }

    const newDocument = this.documentRepository.create({
      fileName: file.originalname,
      storageUrl: `./uploads/${file.filename}`, // Maps to our local hot-reload file workspace path
      status: DocumentStatus.PENDING,
    });

    newDocument.user = user;
    return await this.documentRepository.save(newDocument)


  }


  async getUserDocuments(user_id: string) {
    const documents = await this.documentRepository.find({where: {user: {id: user_id}} , order: {createdAt: 'DESC'}})

    return documents;
  }

}
