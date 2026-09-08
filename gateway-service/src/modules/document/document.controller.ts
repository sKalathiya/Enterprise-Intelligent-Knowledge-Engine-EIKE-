import { Controller, Get, Post, UseInterceptors, Req, BadRequestException, UploadedFile, ClassSerializerInterceptor } from '@nestjs/common';
import { DocumentService } from './document.service.js';
import { CreateDocumentDto } from './dto/create-document.dto.js';
import { FileInterceptor } from '@nestjs/platform-express';
import { extname } from 'path';
import { diskStorage } from 'multer';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller('document')
@UseInterceptors(ClassSerializerInterceptor)
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Post('upload')
  @ApiBearerAuth()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads', // Creates an asset buffer directory locally
        filename: (req, file, cb) => {
          // Generate a highly clean filename timeline string to prevent duplicate state overwrite bugs
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `${file.fieldname}-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        // Strict boundary sanitization filter: Accept only text or PDF assets for our AI pipeline
        if (file.mimetype === 'application/pdf' || file.mimetype === 'text/plain') {
          cb(null, true);
        } else {
          cb(new BadRequestException('Invalid file type. Only standard .txt and .pdf formats are accepted.'), false);
        }
      },
      limits: { fileSize: 10 * 1024 * 1024 }, // Enforces a rigid 10MB memory barrier ceiling limit
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateDocumentDto })
  @ApiOperation({ summary: 'Securely upload a file asset and register a pending tracking record' })
  @ApiResponse({ status: 201, description: 'File accepted. Tracking record spawned successfully.' })
  @ApiResponse({ status: 400, description: 'File type constraints or size limitations violated.' })
  @ApiResponse({ status: 401, description: 'JWT signature pass missing or invalid.' })
  async uploadDocument(@UploadedFile() file: any, @Req() req: any) {
    return this.documentService.uploadDocument(file, req.user.id as string);
  }

  @Get('list')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retrieve processing state timelines for every document owned by the authenticated user' })
  @ApiResponse({ status: 200, description: 'Successfully retrieved document processing state timelines.' })
  @ApiResponse({ status: 401, description: 'JWT signature pass missing or invalid.' })
  async getUserDocuments(@Req() req: any) {
    return this.documentService.getUserDocuments(req.user.id as string);
  }

}
