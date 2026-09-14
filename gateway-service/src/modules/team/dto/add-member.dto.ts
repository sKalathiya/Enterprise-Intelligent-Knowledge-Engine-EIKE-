import { IsEmail, IsNotEmpty, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class AddMemberDto {
    @ApiProperty({ type: 'string', format: 'email', description: 'The email of the user to add to the team', required: true })
    @IsEmail()
    @IsNotEmpty()
    email: string;
}