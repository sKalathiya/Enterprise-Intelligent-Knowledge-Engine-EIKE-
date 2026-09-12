import { HttpService } from "@nestjs/axios";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Document } from "./entities/document.entity.js";
import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Job, Queue } from "bullmq";
import { ConfigService } from "@nestjs/config";
import { Logger } from "@nestjs/common";
import { DocumentStatus } from "./entities/document.entity.js";
import { firstValueFrom } from "rxjs";

@Processor('document-processing', { concurrency: 5 })
export class DocumentProcessor extends WorkerHost {

    private readonly logger = new Logger(DocumentProcessor.name);

    constructor(
        private readonly httpService: HttpService,
        @InjectRepository(Document)
        private readonly documentRepository: Repository<Document>,
        private readonly configService: ConfigService,
        

    ) { super(); }

    
    async process(job: Job) {
        const { documentId, path } = job.data;
        const document = await this.documentRepository.findOneBy({ id: documentId });
        if (!document) {
            throw new Error('Document not found');
        }
        this.documentRepository.update(documentId, { status: DocumentStatus.PROCESSING });
        this.logger.log(`Processing document ${documentId} with path ${path}`);
        const documentServiceUrl = this.configService.get('DOCUMENT_SERVICE_URL');
        const documentServiceToken = this.configService.get('API_KEY')
        if (!documentServiceToken) {
            throw new Error('API_KEY is not set');
        }
        if (!documentServiceUrl) {
            throw new Error('DOCUMENT_SERVICE_URL is not set');
        }
        try{
            const response = this.httpService.post(documentServiceUrl, { documentId, path }, { headers: { 'Authorization': `Bearer ${documentServiceToken}` } });
            const axiosResponse = await firstValueFrom(response);
            this.logger.log(`Document ${documentId} processed successfully`);
            await this.documentRepository.update(documentId, { status: DocumentStatus.COMPLETED });
            return axiosResponse.data;
        }
        catch (error: any) {
            const errmsg = error.response?.data?.detail || error.message || 'An unknown error occurred';
            this.logger.error(`Error processing document ${documentId}`, errmsg);
            await this.documentRepository.update(documentId, { status: DocumentStatus.FAILED, errorMessage: errmsg });
            throw error;
        }
    }
}