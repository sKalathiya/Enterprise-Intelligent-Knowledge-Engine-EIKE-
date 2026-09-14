import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SearchQueryDto {
  @ApiProperty({ description: 'Natural-language question to run against the user document index' })
  @IsString()
  @IsNotEmpty()
  query: string;

  @ApiProperty({ type: 'string', description: 'The ID of the team to search in', required: true })
  @IsString()
  team_id: string;
}
