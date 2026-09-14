import { CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import type { Relation } from "typeorm";
import { Team } from "./team.entity.js";
import { Document } from "../../document/entities/document.entity.js";

@Entity('team_documents')
@Index(['team', 'document'], { unique: true })
export class TeamDocument {
    @PrimaryGeneratedColumn('uuid')
    id: string;
    
    @ManyToOne(() => Team, (team: Team) => team.documents, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'teamId' })
    team: Relation<Team>;

    @ManyToOne(() => Document, (document: Document) => document.teams, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'documentId' })
    @Index()
    document: Relation<Document>;

    @CreateDateColumn({type: "timestamp", nullable: false})
    sharedAt: Date
}
