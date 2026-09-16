import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, OneToMany, JoinColumn, Index, RelationId } from "typeorm";
import type { Relation } from "typeorm";
import { User } from "../../user/entities/user.entity.js";
import { Exclude } from "class-transformer";
import { TeamDocument } from "../../team/entities/team-document.entity.js";

export enum DocumentStatus {
    UPLOADING = "uploading",   // row exists; client has not finished the S3 PUT yet
    PENDING = "pending",       // S3 object confirmed; waiting in BullMQ
    PROCESSING = "processing", // ingest worker has the job
    COMPLETED = "completed",   // chunks written; searchable
    FAILED = "failed"
}

@Entity("documents")
export class Document{
    @PrimaryGeneratedColumn("uuid")
    id: string

    @Column({type: "varchar", length: 255, nullable: false})
    fileName: string

    @Column({type: "varchar", nullable: true})
    @Exclude() // S3 object key (not a public URL). Hidden from JSON responses.
    storageUrl: string

    @Column({type: "enum", enum: DocumentStatus, default: DocumentStatus.PENDING})
    status: DocumentStatus

    @Column({type: "varchar", nullable: true})
    @Exclude()
    errorMessage: string

    @OneToMany(() => TeamDocument, (teamDocument: TeamDocument) => teamDocument.document)
    teams: Relation<TeamDocument[]> // which teams can see this file (join table)

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