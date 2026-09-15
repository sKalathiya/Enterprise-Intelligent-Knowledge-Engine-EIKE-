import { Controller, Get, Post, Body, Patch, Param, Delete, Req, ClassSerializerInterceptor, UseInterceptors } from '@nestjs/common';
import { TeamService } from './team.service.js';
import { CreateTeamDto } from './dto/create-team.dto.js';
import { UpdateTeamDto } from './dto/update-team.dto.js';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AddMemberDto } from './dto/add-member.dto.js';
import { RemoveMemberDto } from './dto/remove-member.dto.js';
import { ChangeOwnerDto } from './dto/change-owner.dto.js';

@Controller('team')
@UseInterceptors(ClassSerializerInterceptor)
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Get('user')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all teams' })
  @ApiResponse({ status: 200, description: 'Teams fetched successfully.' })
  @ApiResponse({ status: 401, description: 'JWT signature pass missing or invalid.' })
  @ApiResponse({ status: 404, description: 'No teams found.' })
  async getAllTeams(@Req() req: any) {
    return this.teamService.getTeamsByUser(req.user.id as string);
  }

  @Post('')
  @ApiBearerAuth()
  @ApiBody({ type: CreateTeamDto })
  @ApiOperation({ summary: 'Create a new team' })
  @ApiResponse({ status: 201, description: 'Team created successfully.' })
  @ApiResponse({ status: 401, description: 'JWT signature pass missing or invalid.' })
  @ApiResponse({ status: 400, description: 'Invalid team name.' })
  async createTeam(@Body() createTeamDto: CreateTeamDto, @Req() req: any) {
    return this.teamService.create(createTeamDto, req.user.id as string);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @ApiBody({ type: UpdateTeamDto })
  @ApiOperation({ summary: 'Update a team' })
  @ApiResponse({ status: 200, description: 'Team updated successfully.' })
  @ApiResponse({ status: 401, description: 'JWT signature pass missing or invalid.' })
  @ApiResponse({ status: 404, description: 'Team not found.' })
  @ApiResponse({ status: 400, description: 'Invalid team name.' })
  async updateTeam(@Param('id') id: string, @Body() updateTeamDto: UpdateTeamDto, @Req() req: any) {
    return this.teamService.update(id, updateTeamDto, req.user.id as string);
  }


  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a team' })
  @ApiResponse({ status: 200, description: 'Team deleted successfully.' })
  @ApiResponse({ status: 401, description: 'JWT signature pass missing or invalid.' })
  @ApiResponse({ status: 404, description: 'Team not found.' })
  @ApiResponse({ status: 400, description: 'Private team cannot be deleted.' })
  async deleteTeam(@Param('id') id: string, @Req() req: any) {
    return this.teamService.delete(id, req.user.id as string);
  }

  @Post(':id/add-member')
  @ApiBearerAuth()
  @ApiBody({ type: AddMemberDto })
  @ApiOperation({ summary: 'Add a member to a team' })
  @ApiResponse({ status: 200, description: 'Member added to team successfully.' })
  @ApiResponse({ status: 401, description: 'JWT signature pass missing or invalid.' })
  @ApiResponse({ status: 404, description: 'Team not found.' })
  @ApiResponse({ status: 400, description: 'Invalid member email.' })
  async addMemberToTeam(@Param('id') id: string, @Body() addMemberDto: AddMemberDto, @Req() req: any) {
    return this.teamService.addMember(id, addMemberDto, req.user.id as string);
  }

  @Post(':id/remove-member')
  @ApiBearerAuth()
  @ApiBody({ type: RemoveMemberDto })
  @ApiOperation({ summary: 'Remove a member from a team' })
  @ApiResponse({ status: 200, description: 'Member removed from team successfully.' })
  @ApiResponse({ status: 401, description: 'JWT signature pass missing or invalid.' })
  @ApiResponse({ status: 404, description: 'Team not found.' })
  @ApiResponse({ status: 400, description: 'Invalid member email.' })
  async removeMemberFromTeam(@Param('id') id: string, @Body() removeMemberDto: RemoveMemberDto, @Req() req: any) {
    return this.teamService.removeMember(id, removeMemberDto, req.user.id as string);
  }

  @Post(':id/change-owner')
  @ApiBearerAuth()
  @ApiBody({ type: ChangeOwnerDto })
  @ApiOperation({ summary: 'Change the owner of a team' })
  @ApiResponse({ status: 200, description: 'Owner changed successfully.' })
  @ApiResponse({ status: 401, description: 'JWT signature pass missing or invalid.' })
  @ApiResponse({ status: 404, description: 'Team not found.' })
  @ApiResponse({ status: 400, description: 'Invalid owner email.' })
  async changeOwnerOfTeam(@Param('id') id: string, @Body() changeOwnerDto: ChangeOwnerDto, @Req() req: any) {
    return this.teamService.changeOwner(id, changeOwnerDto, req.user.id as string);
  }
}
