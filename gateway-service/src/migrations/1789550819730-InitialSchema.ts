import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1789550819730 implements MigrationInterface {
    name = 'InitialSchema1789550819730'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "team_members" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "joinedAt" TIMESTAMP NOT NULL DEFAULT now(), "teamId" uuid, "userId" uuid, CONSTRAINT "PK_ca3eae89dcf20c9fd95bf7460aa" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_0a72b849753a046462b4c5a8ec" ON "team_members"  ("userId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_b2f17b533905e0a94390c5e220" ON "team_members"  ("teamId", "userId") `);
        await queryRunner.query(`CREATE TABLE "teams" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(255) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "ownerId" uuid, CONSTRAINT "PK_7e5523774a38b08a6236d322403" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_7e5523774a38b08a6236d32240" ON "teams"  ("id") `);
        await queryRunner.query(`CREATE INDEX "IDX_b5ebe13256317503931ecabb55" ON "teams"  ("ownerId") `);
        await queryRunner.query(`CREATE TABLE "team_documents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "sharedAt" TIMESTAMP NOT NULL DEFAULT now(), "teamId" uuid, "documentId" uuid, CONSTRAINT "PK_74b5a514e903226910fe8919be8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_e21d923a8790f9af027c1c4363" ON "team_documents"  ("documentId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_f61e7f9c53bc28f19ed7553359" ON "team_documents"  ("teamId", "documentId") `);
        await queryRunner.query(`CREATE TYPE "public"."documents_status_enum" AS ENUM('uploading', 'pending', 'processing', 'completed', 'failed')`);
        await queryRunner.query(`CREATE TABLE "documents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "fileName" character varying(255) NOT NULL, "storageUrl" character varying, "status" "public"."documents_status_enum" NOT NULL DEFAULT 'pending', "errorMessage" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "userId" uuid, CONSTRAINT "PK_ac51aa5181ee2036f5ca482857c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_e300b5c2e3fefa9d6f8a3f2597" ON "documents"  ("userId") `);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "firstName" character varying(255), "lastName" character varying(255), "email" character varying(255) NOT NULL, "passwordHash" character varying(255) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isActive" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_0dcb31847ce0d52588d40228b75" UNIQUE ("passwordHash"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users"  ("email") `);
        await queryRunner.query(`ALTER TABLE "team_members" ADD CONSTRAINT "FK_6d1c8c7f705803f0711336a5c33" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "team_members" ADD CONSTRAINT "FK_0a72b849753a046462b4c5a8ec2" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "teams" ADD CONSTRAINT "FK_b5ebe13256317503931ecabb556" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "team_documents" ADD CONSTRAINT "FK_c6ffba41e131b0b102089cfd72e" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "team_documents" ADD CONSTRAINT "FK_e21d923a8790f9af027c1c4363b" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "documents" ADD CONSTRAINT "FK_e300b5c2e3fefa9d6f8a3f25975" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "documents" DROP CONSTRAINT "FK_e300b5c2e3fefa9d6f8a3f25975"`);
        await queryRunner.query(`ALTER TABLE "team_documents" DROP CONSTRAINT "FK_e21d923a8790f9af027c1c4363b"`);
        await queryRunner.query(`ALTER TABLE "team_documents" DROP CONSTRAINT "FK_c6ffba41e131b0b102089cfd72e"`);
        await queryRunner.query(`ALTER TABLE "teams" DROP CONSTRAINT "FK_b5ebe13256317503931ecabb556"`);
        await queryRunner.query(`ALTER TABLE "team_members" DROP CONSTRAINT "FK_0a72b849753a046462b4c5a8ec2"`);
        await queryRunner.query(`ALTER TABLE "team_members" DROP CONSTRAINT "FK_6d1c8c7f705803f0711336a5c33"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e300b5c2e3fefa9d6f8a3f2597"`);
        await queryRunner.query(`DROP TABLE "documents"`);
        await queryRunner.query(`DROP TYPE "public"."documents_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f61e7f9c53bc28f19ed7553359"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e21d923a8790f9af027c1c4363"`);
        await queryRunner.query(`DROP TABLE "team_documents"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b5ebe13256317503931ecabb55"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7e5523774a38b08a6236d32240"`);
        await queryRunner.query(`DROP TABLE "teams"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b2f17b533905e0a94390c5e220"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0a72b849753a046462b4c5a8ec"`);
        await queryRunner.query(`DROP TABLE "team_members"`);
    }

}
