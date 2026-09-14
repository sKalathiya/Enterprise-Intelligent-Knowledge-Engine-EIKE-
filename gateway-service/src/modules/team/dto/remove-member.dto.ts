import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsString } from "class-validator";



export class RemoveMemberDto {
    @ApiProperty({ type: 'string', format: 'email', description: 'The email of the member to remove from the team', required: true })
    @IsEmail()
    @IsNotEmpty()
    email: string;
}