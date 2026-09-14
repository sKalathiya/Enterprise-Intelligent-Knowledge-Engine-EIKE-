import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity.js';
import { InjectRepository } from '@nestjs/typeorm';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { Document } from '../document/entities/document.entity.js';
import { UpdateUserDto } from './dto/update-user.dto.js';

@Injectable()
export class UserService {
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly httpService: HttpService,
        @InjectQueue('document-processing-queue')
        private readonly documentProcessingQueue: Queue,
    ) {}

    async deleteUser(userId: string) {
        const user = await this.userRepository.findOne({where: {id: userId}, relations: {documents: true}})
        if(!user){
            throw new NotFoundException("User not found")
        }
        for (const document of user.documents){
            await this.documentProcessingQueue.remove(document.id).catch((error) => undefined);
        }
        await firstValueFrom(this.httpService.delete(`${process.env.DOCUMENT_SERVICE_URL}/chunks/user/${userId}`, {
            headers: { 'X-Internal-Api-Key': process.env.API_KEY as string },
        })).catch((error: any) => {
            throw new InternalServerErrorException("Failed to delete documents realted to the user: " + error.message)
        });
        await this.userRepository.delete(userId)
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
