import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class CreateTeamDto {
    @ApiProperty({ type: 'string', description: 'The name of the team', required: true })
    @IsString()
    @IsNotEmpty()
    name: string;  
}
