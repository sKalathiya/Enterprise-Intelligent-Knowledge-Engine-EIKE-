import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateTeamDto } from './dto/create-team.dto.js';
import { UpdateTeamDto } from './dto/update-team.dto.js';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { PRIVATE_TEAM_NAME, Team } from './entities/team.entity.js';
import { TeamMember } from './entities/team-member.entity.js';
import { TeamDocument } from './entities/team-document.entity.js';
import { AddMemberDto } from './dto/add-member.dto.js';
import { User } from '../user/entities/user.entity.js';
import { RemoveMemberDto } from './dto/remove-member.dto.js';

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
    const teams = await this.teamMemberRepository.find({where: {user: {id: userId}} , relations: {team: true}});
    return teams.map(tm => tm.team);
  }

  async create(createTeamDto: CreateTeamDto, userId: string) {
    if (createTeamDto.name === PRIVATE_TEAM_NAME) {
      throw new BadRequestException('Private is a reserved team name');
    }
    const team = this.teamRepository.create({name: createTeamDto.name, owner: {id: userId}});
    await this.teamRepository.save(team);
    const teamMember = this.teamMemberRepository.create({team: team, user: {id: userId}});
    await this.teamMemberRepository.save(teamMember);
    return team;
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

    await this.teamRepository.manager.transaction(async (manager) => {
      await this.moveOrphansToPrivate(manager, team);
      await manager.getRepository(Team).delete(id);
    });

    return { status: 'deleted', id };
  }

  private async moveOrphansToPrivate(manager: EntityManager, team: Team) {
    const teamDocumentRepo = manager.getRepository(TeamDocument);
    const privateTeams = new Map<string, Team>();

    for (const row of team.documents) {
      const document = row.document;
      const isOrphan = document.teams.length === 1;
      if (!isOrphan) {
        continue;
      }

      const ownerId = document.user.id;
      let privateTeam = privateTeams.get(ownerId);
      if (!privateTeam) {
        privateTeam = await this.getOrCreatePrivateTeam(manager, ownerId);
        privateTeams.set(ownerId, privateTeam);
      }

      const alreadyPrivate = await teamDocumentRepo.findOne({
        where: { team: { id: privateTeam.id }, document: { id: document.id } },
      });
      if (!alreadyPrivate) {
        await teamDocumentRepo.save(
          teamDocumentRepo.create({ team: privateTeam, document }),
        );
      }
    }
  }

  private async getOrCreatePrivateTeam(manager: EntityManager, userId: string) {
    const teamRepo = manager.getRepository(Team);
    const memberRepo = manager.getRepository(TeamMember);
    let privateTeam = await teamRepo.findOne({
      where: { name: PRIVATE_TEAM_NAME, owner: { id: userId } },
    });
    if (!privateTeam) {
      privateTeam = await teamRepo.save(
        teamRepo.create({ name: PRIVATE_TEAM_NAME, owner: { id: userId } }),
      );
      await memberRepo.save(
        memberRepo.create({ team: privateTeam, user: { id: userId } }),
      );
    }
    return privateTeam;
  }

  async addMember(id: string, addMemberDto: AddMemberDto, userId: string) {
    const team = await this.teamRepository.findOne({where: {id: id, owner: {id: userId}}});
    if(!team) {
      throw new NotFoundException('Team not found');
    }
    const member = await this.userRepository.findOne({where: {email: addMemberDto.email}});
    if(!member) {
      throw new NotFoundException('Member not found');
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
    await this.teamMemberRepository.delete({user:{ id: member.user.id},team:{id: team.id}});
    return {status: 'removed', email: member.user.email};
  }
}
