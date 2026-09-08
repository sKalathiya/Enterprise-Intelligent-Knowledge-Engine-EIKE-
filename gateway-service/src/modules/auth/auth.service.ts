import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user/entities/user.entity.js';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import bcrypt from 'bcrypt';


@Injectable()
export class AuthService {
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly jwtService: JwtService
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
        return {msg: "Registration is successfull!"}
    }


    async login(loginDto: LoginDto) : Promise<{accessToken: string}>{

        const { email , password} = loginDto;

        const user = await this.userRepository.findOne({where: {email}});
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



