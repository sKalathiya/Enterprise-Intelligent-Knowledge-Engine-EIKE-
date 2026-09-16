import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, UpdateDateColumn, PrimaryGeneratedColumn, OneToMany, RelationId } from "typeorm";
import type { Relation } from "typeorm";
import { User } from "../../user/entities/user.entity.js";
import { TeamMember } from "./team-member.entity.js";
import { TeamDocument } from "./team-document.entity.js";

export const PRIVATE_TEAM_NAME = "Private"; // reserved; created on register; cannot rename/share/delete/reown

@Entity("teams")
export class Team {

    @PrimaryGeneratedColumn("uuid")
    @Index({ unique: true })
    id: string;

    @Column({type: "varchar" , length: 255 , nullable: false})
    name: string

    @ManyToOne(() => User, (user: User) => user.ownedTeams, { onDelete: 'RESTRICT' }) // cannot drop a user who still owns teams
    @JoinColumn({ name: 'ownerId' })
    @Index()
    owner: Relation<User>;

    @RelationId((team: Team) => team.owner)
    ownerId: string;

    @OneToMany(() => TeamMember, (member: TeamMember) => member.team)
    members: Relation<TeamMember[]>

    @OneToMany(() => TeamDocument, (document: TeamDocument) => document.team)
    documents: Relation<TeamDocument[]>

    @CreateDateColumn({type: "timestamp", nullable: false})
    createdAt: Date

    @UpdateDateColumn({type: "timestamp", nullable: false})
    updatedAt: Date
}
