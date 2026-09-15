import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, OneToMany, JoinColumn, Index, RelationId } from "typeorm";
import type { Relation } from "typeorm";
import { User } from "../../user/entities/user.entity.js";
import { Exclude } from "class-transformer";
import { TeamDocument } from "../../team/entities/team-document.entity.js";

export enum DocumentStatus {
    UPLOADING = "uploading",
    PENDING = "pending",
    PROCESSING = "processing",
    COMPLETED = "completed",
    FAILED = "failed"
}

@Entity("documents")
export class Document{
    @PrimaryGeneratedColumn("uuid")
    id: string

    @Column({type: "varchar", length: 255, nullable: false})
    fileName: string

    @Column({type: "varchar", nullable: true})
    @Exclude()
    storageUrl: string

    @Column({type: "enum", enum: DocumentStatus, default: DocumentStatus.PENDING})
    status: DocumentStatus

    @Column({type: "varchar", nullable: true})
    @Exclude()
    errorMessage: string

    @OneToMany(() => TeamDocument, (teamDocument: TeamDocument) => teamDocument.document)
    teams: Relation<TeamDocument[]>

    @ManyToOne(() => User, (user: User) => user.documents, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    @Index()
    user: Relation<User>;

    @RelationId((document: Document) => document.user)
    userId: string;

    @CreateDateColumn({type: "timestamp", nullable: false})
    createdAt: Date

    @UpdateDateColumn({type: "timestamp", nullable: false})
    updatedAt: Date
}