import { PartialType } from '@nestjs/swagger';
import { CreateTeamDto } from './create-team.dto.js';

export class UpdateTeamDto extends PartialType(CreateTeamDto) {}
