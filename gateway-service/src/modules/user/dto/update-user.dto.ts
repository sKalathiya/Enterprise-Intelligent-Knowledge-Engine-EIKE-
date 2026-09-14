import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateUserDto {
    @ApiPropertyOptional({ type: "string", description: "The first name of the user" })
    @IsOptional()
    @IsString()
    @MaxLength(255)
    firstName?: string;

    @ApiPropertyOptional({ type: "string", description: "The last name of the user" })
    @IsOptional()
    @IsString()
    @MaxLength(255)
    lastName?: string;

    @ApiPropertyOptional({ type: "string", description: "The email of the user" })
    @IsOptional()
    @IsEmail()
    @MaxLength(255)
    email?: string;
}
