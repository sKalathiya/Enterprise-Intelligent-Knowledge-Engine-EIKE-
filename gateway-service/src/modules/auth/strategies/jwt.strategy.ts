import { Repository } from "typeorm";
import { User } from "../../user/entities/user.entity.js";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-jwt";
import { ExtractJwt } from "passport-jwt";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy){
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
    ){
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: process.env.JWT_SECRET as string,
        });
    }

    // Signature/expiry already checked. Reload the user so controllers get req.user (not just the token payload).
    async validate(payload: any){
        const user = await this.userRepository.findOne({where: {id: payload.id}});
        if(!user){
            throw new UnauthorizedException("Invalid token");
        }
        return user;
    }
}   