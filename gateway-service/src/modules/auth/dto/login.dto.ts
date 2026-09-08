import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";


export class LoginDto {
    
    @ApiProperty({ example: 'ada@example.com' })
    @IsEmail()
    @MaxLength(255) 
    email:string

    @ApiProperty({ 
        example: 'Str0ngP@ssword',
        minLength: 8,
        maxLength: 255, })
    @IsString()
    @MinLength(8)
    @MaxLength(255)
    password: string
}