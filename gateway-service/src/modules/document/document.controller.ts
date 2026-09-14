import { Controller, Get, Post, UseInterceptors, Req, Res, BadRequestException, UploadedFile, ClassSerializerInterceptor, Body, Delete, Param } from '@nestjs/common';
import type { Response } from 'express';
import { DocumentService } from './document.service.js';
import { CreateDocumentDto } from './dto/create-document.dto.js';
import { SearchQueryDto } from './dto/search-query.dto.js';
import { FileInterceptor } from '@nestjs/platform-express';
import { extname } from 'path';
import { diskStorage } from 'multer';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ShareDocumentDto } from './dto/share-document.dto.js';
import { UnshareDocumentDto } from './dto/unshare-document.dto.js';

@Controller('document')
@UseInterceptors(ClassSerializerInterceptor)
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Post('upload')
  @ApiBearerAuth()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const dir = process.env.SHARED_UPLOAD;
          if (!dir) {
            return cb(new Error('SHARED_UPLOAD is not set'), '');
          }
          cb(null, dir);
        }, // Creates an asset buffer directory locally
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
  async uploadDocument(@UploadedFile() file: any, @Req() req: any, @Body() body: CreateDocumentDto) {
    return this.documentService.uploadDocument(file, req.user.id as string, body.team_id);
  }

  @Get('list/me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retrieve processing state timelines for every document owned by the authenticated user' })
  @ApiResponse({ status: 200, description: 'Successfully retrieved document processing state timelines.' })
  @ApiResponse({ status: 401, description: 'JWT signature pass missing or invalid.' })
  async getUserDocuments(@Req() req: any) {
    return this.documentService.getUserDocuments(req.user.id as string);
  }

  @Get('list/team/:team_id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retrieve processing state timelines for every document owned by the authenticated user for this particular team' })
  @ApiResponse({ status: 200, description: 'Successfully retrieved document processing state timelines.' })
  @ApiResponse({ status: 401, description: 'JWT signature pass missing or invalid.' })
  async getTeamDocuments(@Param('team_id') team_id: string, @Req() req: any) {
    return this.documentService.getTeamDocuments(team_id, req.user.id as string);
  }

  @Post('share/:id')
  @ApiBearerAuth()
  @ApiBody({ type: ShareDocumentDto })
  @ApiOperation({ summary: 'Share a document with one or more teams' })
  @ApiResponse({ status: 200, description: 'Document shared successfully.' })
  @ApiResponse({ status: 401, description: 'JWT signature pass missing or invalid.' })
  @ApiResponse({ status: 404, description: 'Document not found.' })
  @ApiResponse({ status: 400, description: 'Invalid team IDs.' })
  async shareDocument(@Param('id') id: string, @Req() req: any, @Body() body: ShareDocumentDto) {
    return this.documentService.shareDocument(id, req.user.id as string, body.team_ids);
  }


  @Post('unshare/:id')
  @ApiBearerAuth()
  @ApiBody({ type: UnshareDocumentDto })
  @ApiOperation({ summary: 'Unshare a document from one or more teams' })
  @ApiResponse({ status: 200, description: 'Document unshared successfully.' })
  @ApiResponse({ status: 401, description: 'JWT signature pass missing or invalid.' })
  @ApiResponse({ status: 404, description: 'Document not found.' })
  @ApiResponse({ status: 400, description: 'Invalid team IDs.' })
  async unshareDocument(@Param('id') id: string, @Req() req: any, @Body() body: UnshareDocumentDto) {
    return this.documentService.unshareDocument(id, req.user.id as string, body.team_ids);
  }


  @Post('query')
  @ApiBearerAuth()
  @ApiBody({ type: SearchQueryDto })
  @ApiOperation({ summary: 'Search documents for query and stream the results' })
  @ApiResponse({ status: 200, description: 'Successfully retrieved results for the query.' })
  @ApiResponse({ status: 401, description: 'JWT signature pass missing or invalid.' })
  async searchDocuments(@Body() body: SearchQueryDto, @Req() req: any, @Res() res: Response) {
    return this.documentService.pipeSearchDocuments(body.query, body.team_id, req.user.id as string, req, res);
  }

  @Delete('delete/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a document by its ID' })
  @ApiResponse({ status: 200, description: 'Document deleted successfully.' })
  @ApiResponse({ status: 401, description: 'JWT signature pass missing or invalid.' })
  @ApiResponse({ status: 404, description: 'Document not found.' })
  async deleteDocument(@Param('id') id: string, @Req() req: any) {
    return this.documentService.deleteDocument(id, req.user.id as string);
  }

  @Post('retry/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retry a failed document parse by its ID' })
  @ApiResponse({ status: 200, description: 'Document parse retried successfully.' })
  @ApiResponse({ status: 401, description: 'JWT signature pass missing or invalid.' })
  @ApiResponse({ status: 404, description: 'Document not found.' })
  @ApiResponse({ status: 400, description: 'Only failed documents can be retried.' })
  async retryDocument(@Param('id') id: string, @Req() req: any) {
    return this.documentService.retryDocument(id, req.user.id as string);
  }

  
}
