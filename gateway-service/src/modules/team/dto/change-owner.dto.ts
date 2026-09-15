import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsString } from "class-validator";

export class ChangeOwnerDto {
    @ApiProperty({ type: 'string', format: 'email', description: 'The email of the new owner', required: true })
    @IsEmail()
    @IsNotEmpty()
    email: string;
}   