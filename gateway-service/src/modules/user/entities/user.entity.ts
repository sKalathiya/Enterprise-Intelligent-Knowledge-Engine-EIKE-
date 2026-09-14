import { Column, CreateDateColumn, Entity, Index, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import type { Relation } from "typeorm";
import { Document } from "../../document/entities/document.entity.js";
import { Exclude } from "class-transformer";
import { Team } from "../../team/entities/team.entity.js";
import { TeamMember } from "../../team/entities/team-member.entity.js";


@Entity("users")
export class User{
    @PrimaryGeneratedColumn("uuid")
    @Exclude()
    id: string

    @Column({type: "varchar", length: 255, nullable: true})
    firstName: string

    @Column({type: "varchar", length: 255, nullable: true})
    lastName: string

    @Column({type: "varchar", length: 255, nullable: false})
    @Index({unique: true})
    email: string

    @Column({type: "varchar", length: 255, unique: true, nullable: false})
    @Exclude()
    passwordHash: string

    @OneToMany(()=> TeamMember, (member: TeamMember) => member.user)
    teams: TeamMember[]

    @OneToMany(() => Document, (document: Document) => document.user)
    documents: Document[]

    @OneToMany(() => Team, (team: Team) => team.owner)
    ownedTeams: Team[]

    @CreateDateColumn({type: "timestamp", nullable: false})
    createdAt: Date

    @UpdateDateColumn({type: "timestamp", nullable: false})
    updatedAt: Date

    @Column({ type: 'boolean', default: true })
    isActive: boolean;
}