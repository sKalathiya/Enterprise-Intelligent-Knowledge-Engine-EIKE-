import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn } from "typeorm";
import type { Relation } from "typeorm";
import { User } from "../../users/entities/user.entity.js";

export enum DocumentStatus {
    PENDING = "pending",
    PROCESSING = "processing",
    COMPLETED = "completed",
    FAILED = "failed"
}

@Entity("documents")
export class Document{
    @PrimaryGeneratedColumn("uuid")
    id: number

    @Column({type: "varchar", length: 255, nullable: false})
    fileName: string

    @Column({type: "varchar", nullable: true})
    storageUrl: string

    @Column({type: "enum", enum: DocumentStatus, default: DocumentStatus.PENDING})
    status: DocumentStatus

    @Column({type: "varchar", nullable: true})
    errorMessage: string

    @ManyToOne(() => User, (user: User) => user.documents , {onDelete: "CASCADE"})
    user: Relation<User>

    @CreateDateColumn({type: "timestamp", nullable: false})
    createdAt: Date

    @UpdateDateColumn({type: "timestamp", nullable: false})
    updatedAt: Date
}