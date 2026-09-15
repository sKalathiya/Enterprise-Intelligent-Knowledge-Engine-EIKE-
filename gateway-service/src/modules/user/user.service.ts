import { BadRequestException, Inject, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity.js';
import { InjectRepository } from '@nestjs/typeorm';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { Document } from '../document/entities/document.entity.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { Team } from '../team/entities/team.entity.js';
import { PRIVATE_TEAM_NAME } from '../team/entities/team.entity.js'
import * as fs from 'fs/promises';
import { S3Service } from '../document/s3Service.js';

@Injectable()
export class UserService {
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly httpService: HttpService,
        @InjectQueue('document-processing-queue')
        private readonly documentProcessingQueue: Queue,
        @InjectRepository(Document)
        private readonly documentRepository: Repository<Document>,
        @InjectRepository(Team)
        private readonly teamRepository: Repository<Team>,
        private readonly s3Service: S3Service,
    ) {}

    async deleteUser(userId: string) {

        const user = await this.userRepository.findOne({where: {id: userId}, relations: {documents: true , ownedTeams: true}})
        if(!user){
            throw new NotFoundException("User not found")
        }
        if(user.ownedTeams.length > 1){
            throw new BadRequestException("User has teams, please delete or change owner of the teams first")
        }
        await this.userRepository.manager.transaction(async (manager) => {
            const teamRepo = manager.getRepository(Team);
            const documentRepo = manager.getRepository(Document);
            const userRepo = manager.getRepository(User);
            if(user.ownedTeams[0] && user.ownedTeams[0].name === PRIVATE_TEAM_NAME ){
                await teamRepo.remove(user.ownedTeams[0]);
            }else{
                throw new BadRequestException("User has teams, please delete or change owner of the teams first")
            }
            for (const document of user.documents){
                await documentRepo.remove(document);
            }
            await userRepo.delete(userId);
        });
        
        for (const document of user.documents){
            await this.documentProcessingQueue.remove(document.id).catch((error) => undefined);
            if (document.storageUrl) {
                await this.s3Service.deleteObject(document.storageUrl).catch(() => undefined);
              }
            await firstValueFrom(this.httpService.delete(`${process.env.DOCUMENT_SERVICE_URL}/chunks/document/${document.id}`, {
                headers: { 'X-Internal-Api-Key': process.env.API_KEY as string },
            })).catch((error: any) => {
                console.error("Failed to delete documents realted to the user: " + error.message)
            });
        }
    
        return { status: 'deleted', id: userId }
    }

    async getUser(userId: string) {
        const user = await this.userRepository.findOne({where: {id: userId}})
        if(!user){
            throw new NotFoundException("User not found")
        }
        return user
    }

    async updateUser(userId: string, updateUserDto: UpdateUserDto) {
        const user = await this.userRepository.findOne({where: {id: userId}})
        if(!user){
            throw new NotFoundException("User not found")
        }
        await this.userRepository.update(userId, updateUserDto)
        return { status: 'updated', id: userId }
    }
}
