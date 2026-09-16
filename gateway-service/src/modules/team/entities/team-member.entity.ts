import { CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import type { Relation } from "typeorm";
import { Team } from "./team.entity.js";
import { User } from "../../user/entities/user.entity.js";

@Entity('team_members')
@Index(['team', 'user'], { unique: true }) // one membership row per user per team
export class TeamMember {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => Team, (team: Team) => team.members, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'teamId' })
    team: Relation<Team>;

    @ManyToOne(() => User, (user: User) => user.teams, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    @Index()
    user: Relation<User>;

    @CreateDateColumn({type: "timestamp", nullable: false})
    joinedAt: Date
}
