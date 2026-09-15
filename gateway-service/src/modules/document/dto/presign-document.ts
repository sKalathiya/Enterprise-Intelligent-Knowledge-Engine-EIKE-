import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsNotEmpty, IsInt, Min, Max } from "class-validator";
import { IsString } from "class-validator"; 


export class PresignDocumentDto {
    @IsString()
    @IsNotEmpty()
    @ApiProperty({
        description: 'The team ID',
        example: '123',
    })
    team_id: string;

    @IsString()
    @IsNotEmpty()
    @ApiProperty({
        description: 'The file name',
        example: 'example.pdf',
    })
    fileName: string;

    @IsIn(['application/pdf', 'text/plain'])
    @ApiProperty({
        description: 'The content type',
        example: 'application/pdf',
    })
    contentType : string;

    @IsInt()
    @IsNotEmpty()
    @ApiProperty({
        description: 'The content length',
        example: 1000,
    })
    @Min(1)
    @Max(10 * 1024 * 1024)
    contentLength : number;
}
