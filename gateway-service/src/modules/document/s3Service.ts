import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';

@Injectable()
export class S3Service {
    s3: S3Client | null;
    bucket: string;
    constructor(
        @Inject(ConfigService)
        private readonly configService: ConfigService){
        this.bucket = this.configService.get('S3_BUCKET') ?? '';
        const region = this.configService.get('S3_REGION') ?? '';
        const accessKeyId = this.configService.get('S3_ACCESS_KEY_ID') ?? '';
        const secretAccessKey = this.configService.get('S3_SECRET_ACCESS_KEY') ?? '';
        const endpoint = this.configService.get('S3_ENDPOINT') ?? '';

    if(this.bucket && region && accessKeyId && secretAccessKey){
            this.s3 = new S3Client({
                region,
                credentials: {
                    accessKeyId,
                    secretAccessKey,
                },
                ...(endpoint ? {endpoint , forcePathStyle: false} : {}),
            });
        }
    }

    requireClient(){
        if(!this.s3){
            throw new Error('S3 client not initialized');
        }
        return this.s3;
    }

    async deleteObject(key: string){
        if(!this.s3 || !this.bucket || !key || !key.startsWith('users/')){
            throw new Error('S3 client not initialized');
        }
        await this.s3.send(new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: key,
        }));
    }
}