import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsNotEmpty, IsString } from "class-validator";

export class ShareDocumentDto {
  @ApiProperty({ type: 'array', description: 'The IDs of the teams to share the document with', required: true })
  @IsArray()
  @IsNotEmpty()
  @IsString({ each: true })
  team_ids: string[];
}