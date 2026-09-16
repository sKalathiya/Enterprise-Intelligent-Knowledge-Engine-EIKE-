import { config as loadEnv } from 'dotenv';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DataSource } from 'typeorm';
import { User } from '../modules/user/entities/user.entity.js';
import { Team } from '../modules/team/entities/team.entity.js';
import { TeamDocument } from '../modules/team/entities/team-document.entity.js';
import { TeamMember } from '../modules/team/entities/team-member.entity.js';
import { Document } from '../modules/document/entities/document.entity.js';

// Existing env (Compose / CI) wins. Files only fill keys that are missing.
loadEnv();
loadEnv({ path: '../.env' });

const here = dirname(fileURLToPath(import.meta.url)).replaceAll('\\', '/');
const migrationsDir = join(here, '..', 'migrations').replaceAll('\\', '/');

export default new DataSource({
  type: 'postgres',
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT),
  username: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  entities: [User, Document, Team, TeamMember, TeamDocument],
  // tsx CLI uses *.ts; the image uses compiled *.js next to this file.
  migrations: [`${migrationsDir}/*.js`, `${migrationsDir}/*.ts`],
  synchronize: false,
});
