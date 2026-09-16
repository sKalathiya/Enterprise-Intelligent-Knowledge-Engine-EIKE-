import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { CreateTeamDto } from './dto/create-team.dto.js';
import { UpdateTeamDto } from './dto/update-team.dto.js';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Not, Repository } from 'typeorm';
import { PRIVATE_TEAM_NAME, Team } from './entities/team.entity.js';
import { TeamMember } from './entities/team-member.entity.js';
import { TeamDocument } from './entities/team-document.entity.js';
import { AddMemberDto } from './dto/add-member.dto.js';
import { User } from '../user/entities/user.entity.js';
import { RemoveMemberDto } from './dto/remove-member.dto.js';
import { ChangeOwnerDto } from './dto/change-owner.dto.js';
import { Document } from '../document/entities/document.entity.js';
@Injectable()
export class TeamService {
  constructor(
    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>,
    @InjectRepository(TeamMember)
    private readonly teamMemberRepository: Repository<TeamMember>,
    @InjectRepository(TeamDocument)
    private readonly teamDocumentRepository: Repository<TeamDocument>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}


  async getTeamsByUser(userId: string) {
    const memberships = await this.teamMemberRepository.find({
      where: { user: { id: userId } },
      relations: { team: { members: { user: true }, owner: true } },
    });
    return memberships.map(row => row.team)
  }

  async create(createTeamDto: CreateTeamDto, userId: string) {
    if (createTeamDto.name === PRIVATE_TEAM_NAME) {
      throw new BadRequestException('Private is a reserved team name');
    }
    // Caller becomes owner and first member in one transaction.
    const savedTeam = await this.teamRepository.manager.transaction(async (manager): Promise<Team> => {
      const teamRepo = manager.getRepository(Team);
      const teamMemberRepo = manager.getRepository(TeamMember);
      const team = teamRepo.create({name: createTeamDto.name, owner: {id: userId}});
      await teamRepo.save(team);
      const teamMember = teamMemberRepo.create({team: team, user: {id: userId}});
      await teamMemberRepo.save(teamMember);
      return team;
    });
    return savedTeam;
  }


  async update(id: string, updateTeamDto: UpdateTeamDto, userId: string) {
    const team = await this.teamRepository.findOne({where: {id: id, owner: {id: userId}}});
    if(!team) {
      throw new NotFoundException('Team not found');
    }
    if(team.name === PRIVATE_TEAM_NAME) {
      throw new BadRequestException('Private team cannot be renamed');
    }
    if (updateTeamDto.name === PRIVATE_TEAM_NAME) {
      throw new BadRequestException('Private is a reserved team name');
    }
    team.name = updateTeamDto.name || team.name;
    await this.teamRepository.save(team);
    return team;
  }

  async delete(id: string, userId: string) {
    const team = await this.teamRepository.findOne({
      where: { id, owner: { id: userId } },
      relations: { documents: { document: { teams: true, user: true } } },
    });
    if (!team) {
      throw new NotFoundException('Team not found');
    }
    if (team.name === PRIVATE_TEAM_NAME) {
      throw new BadRequestException('Private team cannot be deleted');
    }

    await this.teamDocumentRepository.manager.transaction(async (manager) => {
      // Move last-share files to each file owner's Private team, then drop this team.
      await this.removeDocumentsFromTeam(manager, id)
      await manager.getRepository(Team).delete(id); 
    })
    return { status: 'deleted', id };
  }
  
  async changeOwner(id: string, changeOwnerDto: ChangeOwnerDto, userId: string) {
    const team = await this.teamRepository.findOne({where : {id: id , owner: {id: userId}}})
    const oldOwner = await this.userRepository.findOne({where: {id: userId}})
    if( !oldOwner ){
      throw new NotFoundException('Old Owner not found');
    }
    if( !team ){
      throw new NotFoundException('Team not found');
    }
    if( team.name == PRIVATE_TEAM_NAME){
      throw new BadRequestException("Private team ownership cannot be changed!")
    }

    const newOwner = await this.userRepository.findOne({where: {email : changeOwnerDto.email}})
    if( !newOwner ){
      throw new NotFoundException("New Owner not found!")
    }
    if( !newOwner.isActive){
      throw new BadRequestException("New Owner is not Active!")
    }
    if( newOwner.id === userId ){
      throw new BadRequestException("You cannot change ownership to yourself!")
    }
    if( !await this.teamMemberRepository.findOne({where: {team: {id: team.id}, user: {id: newOwner.id}}}) ){
      throw new BadRequestException("New Owner is not a member of the team!")
    }

    // Old owner stays a member, so their files stay on this team.
    team.owner = newOwner;
    await this.teamRepository.save(team);

    return {status: 'owner changed successfully', id: team.id};
  }

  // If a file would have zero teams left, attach it to the file owner's Private team so it is not orphaned.
  private async removeDocumentsFromTeam(manager: EntityManager, team_id: string, user_id?: string | null){
    let documents: TeamDocument[] = []
    const teamDocumentRepo = manager.getRepository(TeamDocument)
    if(user_id){
       documents = await teamDocumentRepo.find({where: {team: {id: team_id } , document: { user: {id: user_id}}}, relations: {document: {user: true, teams: true}}})
    }else{
     documents = await teamDocumentRepo.find({where: {team: {id: team_id } }, relations: {document: {user: true, teams: true}}})
    }
    
    if(documents.length > 0){
      for( const row  of documents){
        
        const sharedTeams = row.document.teams.length
        if(sharedTeams === 1){
          const privateTeam = await this.getOrCreatePrivateTeam(manager, row.document.user.id);
        await teamDocumentRepo.save(teamDocumentRepo.create({team: privateTeam, document: row.document}));
        }
        await teamDocumentRepo.delete(row.id);
      }
    }
  }

  private async getOrCreatePrivateTeam(manager: EntityManager, user_id: string){
    const teamRepo = manager.getRepository(Team);
    const memberRepo = manager.getRepository(TeamMember);
    let privateTeam = await teamRepo.findOne({
      where: { name: PRIVATE_TEAM_NAME, owner: { id: user_id } },
    });
    if (!privateTeam) {
      privateTeam = await teamRepo.save(
        teamRepo.create({ name: PRIVATE_TEAM_NAME, owner: { id: user_id } }),
      );
      await memberRepo.save(
        memberRepo.create({ team: privateTeam, user: { id: user_id } }),
      );
    }
    return privateTeam;
  }

  async addMember(id: string, addMemberDto: AddMemberDto, userId: string) {
    const team = await this.teamRepository.findOne({where: {id: id, owner: {id: userId}}});
    if(!team) {
      throw new NotFoundException('Team not found');
    }
    if(team.name === PRIVATE_TEAM_NAME) {
      throw new BadRequestException('Private team cannot have members');
    }
    const member = await this.userRepository.findOne({where: {email: addMemberDto.email}});
    if(!member) {
      throw new NotFoundException('Member not found');
    }
    if(!member.isActive) {
      throw new BadRequestException('Member is not active');
    }
    if(
      await this.teamMemberRepository.findOne({where: {team : {id: team.id} , user : {id : member.id}}})
    ){
      throw new BadRequestException('Member already in team');
    }
    
    await this.teamMemberRepository.save(
      this.teamMemberRepository.create({team: team , user: member})
    )
    return {status: 'added', id: member.id};
    
  }

  async removeMember(id: string, removeMemberDto: RemoveMemberDto, userId: string) {
    
    const team = await this.teamRepository.findOne({where: {id: id, owner: {id: userId}} , relations: {members: {user: true}}});
    if(!team) {
      throw new NotFoundException('Team not found');
    }
    const member = team.members.find(m => m.user.email === removeMemberDto.email);
    if(!member) {
      throw new NotFoundException('Member not found in team');
    }
    if(member.user.id === userId) {
      throw new BadRequestException('You cannot remove yourself from the team');
    }
    if(team.name === PRIVATE_TEAM_NAME) {
      throw new BadRequestException('Private team cannot have members removed');
    }

    await this.teamDocumentRepository.manager.transaction(async (manager) => {
      // Removed member's files that would otherwise be left only on this team go to their Private team.
      await this.removeDocumentsFromTeam(manager, id, member.user.id)
      await manager.getRepository(TeamMember).delete({user:{ id: member.user.id},team:{id: team.id}});
    });

    return {status: 'removed', email: member.user.email};
  }

  async leaveTeam(id: string, user_id: string)
  {
    const team = await this.teamRepository.findOne({
      where: {id: id, members: {user: {id: user_id}}},
      relations: { owner: true },
    });
    if(!team) {
      throw new NotFoundException('Team not found');
    }
    if(team.name === PRIVATE_TEAM_NAME) {
      throw new BadRequestException('Private team cannot have members removed');
    }
    if(team.ownerId === user_id) {
      // Ownership must move first so the team is never ownerless.
      throw new BadRequestException('You cannot leave a team you own. Transfer ownership first.');
    }
    await this.teamRepository.manager.transaction(async (manager) => {
      await this.removeDocumentsFromTeam(manager, id, user_id)
      await manager.getRepository(TeamMember).delete({user:{ id: user_id},team:{id: team.id}});
    });
    return {status: 'left', id: team.id};
  }
}
