import { ApiProperty } from '@nestjs/swagger';

export class CreateDocumentDto {
  @ApiProperty({ type: 'string', format: 'binary', description: 'The text or PDF asset to be processed by the GenAI pipeline' })
  file: any;
}
