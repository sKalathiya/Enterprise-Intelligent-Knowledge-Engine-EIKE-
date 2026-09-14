import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, UpdateDateColumn, PrimaryGeneratedColumn, OneToMany } from "typeorm";
import { Exclude } from "class-transformer";
import { User } from "../../user/entities/user.entity.js";
import { TeamMember } from "./team-member.entity.js";
import { TeamDocument } from "./team-document.entity.js";

export const PRIVATE_TEAM_NAME = "Private";

@Entity("teams")
export class Team {

    @PrimaryGeneratedColumn("uuid")
    @Index({ unique: true })
    id: string;

    @Column({type: "varchar" , length: 255 , nullable: false})
    name: string

    @ManyToOne(() => User, (user: User) => user.ownedTeams, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'ownerId' })
    @Index()
    owner: User;

    @OneToMany(() => TeamMember, (member: TeamMember) => member.team)
    members: TeamMember[]

    @OneToMany(() => TeamDocument, (document: TeamDocument) => document.team)
    documents: TeamDocument[]

    @CreateDateColumn({type: "timestamp", nullable: false})
    createdAt: Date

    @UpdateDateColumn({type: "timestamp", nullable: false})
    updatedAt: Date
}
