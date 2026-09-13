import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class SearchQueryDto {
  @ApiProperty({ description: 'Natural-language question to run against the user document index' })
  @IsString()
  @IsNotEmpty()
  query: string;
}
