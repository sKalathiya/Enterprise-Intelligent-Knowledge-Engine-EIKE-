import 'dotenv/config';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { User } from '../modules/user/entities/user.entity.js';
import { Team } from '../modules/team/entities/team.entity.js';
import { TeamDocument } from '../modules/team/entities/team-document.entity.js';
import { TeamMember } from '../modules/team/entities/team-member.entity.js';
import { Document } from '../modules/document/entities/document.entity.js';

config({ path: '../.env' });

export default new DataSource({
  type: 'postgres',
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT),
  username: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB, // still `eike` for now; we will change this in step 3
  entities: [User, Document, Team, TeamMember, TeamDocument],
  migrations: ['src/migrations/*.ts'],
  synchronize: false, // CLI must never auto-create tables
});
