import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateDocumentDto {
  // @ApiProperty({ type: 'string', format: 'binary', description: 'The text or PDF asset to be processed by the GenAI pipeline' })
  // file: any;

  @ApiProperty({ type: 'string', description: 'The ID of the team the document belongs to', required: true })
  @IsString()
  team_id: string;
}
