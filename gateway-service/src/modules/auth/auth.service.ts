import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user/entities/user.entity.js';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import bcrypt from 'bcrypt';
import { PRIVATE_TEAM_NAME, Team } from '../team/entities/team.entity.js';
import { TeamMember } from '../team/entities/team-member.entity.js';


@Injectable()
export class AuthService {
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly jwtService: JwtService,
        @InjectRepository(Team)
        private readonly teamRepository: Repository<Team>,
        @InjectRepository(TeamMember)
        private readonly teamMemberRepository: Repository<TeamMember>,
    ) {}


    async register(registerDto: RegisterDto) : Promise<{msg: string}>{
        const {firstName, lastName, email, password} = registerDto;

        const existingUser = await this.userRepository.findOne({where: {email}});
        if (existingUser) {
            throw new ConflictException('User with this email already exists');
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const user = this.userRepository.create({firstName, lastName, email, passwordHash});
        await this.userRepository.save(user);
        // Every user gets a personal "Private" team (owner + membership). Files always have a home team.
        const team = this.teamRepository.create({name: PRIVATE_TEAM_NAME, owner: user});
        await this.teamRepository.save(team);
        const teamMember = this.teamMemberRepository.create({team: team, user: user});
        await this.teamMemberRepository.save(teamMember);
        return {msg: "Registration is successfull!"}
    }


    async login(loginDto: LoginDto) : Promise<{accessToken: string}>{

        const { email , password} = loginDto;

        const user = await this.userRepository.findOne({where: {email}});
        // Same error for missing user, bad password, or inactive account so we do not leak which emails exist.
        if(!user || !user.isActive){
            throw new UnauthorizedException("Invalid login credentials provided!");
        }

        const isPasswordValid = await bcrypt.compare(password, user?.passwordHash);
        if(!isPasswordValid){
            throw new UnauthorizedException("Invalid login credentials provided!");
        }
        const payload = { id: user.id, email: user.email};
        const accessToken = this.jwtService.sign(payload);
        return {accessToken: accessToken}
    }
}



