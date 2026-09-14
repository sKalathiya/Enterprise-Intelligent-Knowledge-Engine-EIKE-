import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsNotEmpty, IsString } from "class-validator";

export class UnshareDocumentDto {
  @ApiProperty({ type: 'string', description: 'The ID of the team to unshare the document from', required: true })
  @IsArray()
  @IsNotEmpty()
  @IsString({ each: true })
  team_ids: string[];
}