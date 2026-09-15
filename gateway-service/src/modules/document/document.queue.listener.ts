import { InjectQueue, OnQueueEvent, QueueEventsHost, QueueEventsListener } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Document, DocumentStatus } from "./entities/document.entity.js";
import { Queue } from "bullmq";

export interface DocumentJob{
    jobId: string
    failedReason?: string
}

@QueueEventsListener('document-processing-queue')
@Injectable()
export class DocumentQueueListener extends QueueEventsHost {
    constructor(
        @InjectRepository(Document)
        private readonly documentRepository: Repository<Document>,
        @InjectQueue('document-processing-queue')
        private readonly documentProcessingQueue: Queue,
    ){ 
        super()
    }

    @OnQueueEvent('active')
    async onActive({jobId}: DocumentJob){
        await this.documentRepository.update(jobId, {status: DocumentStatus.PROCESSING})
    }
    @OnQueueEvent('completed')
    async onCompleted({jobId}: DocumentJob){
        await this.documentRepository.update(jobId, {status: DocumentStatus.COMPLETED, errorMessage: ''})
    }
    @OnQueueEvent('failed')
    async onFailed({jobId, failedReason}: DocumentJob){
        const job = await this.documentProcessingQueue.getJob(jobId);
        if( job && await job.getState() === "failed"){
            await this.documentRepository.update(jobId, {status: DocumentStatus.FAILED , errorMessage: failedReason})
        }
    }
}