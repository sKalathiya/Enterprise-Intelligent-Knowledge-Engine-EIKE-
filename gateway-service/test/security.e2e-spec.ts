import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import superTest from 'supertest';
import { DataSource, In } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { User } from '../src/modules/user/entities/user.entity.js';
import { Team } from '../src/modules/team/entities/team.entity.js';
import { TeamDocument } from '../src/modules/team/entities/team-document.entity.js';
import { Document, DocumentStatus } from '../src/modules/document/entities/document.entity.js';

const PASSWORD = 'Passw0rd!';

function createHttp(app: INestApplication) {
  return superTest(app.getHttpServer());
}

describe('minimum deploy security (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof createHttp>;
  let dataSource: DataSource;
  const createdEmails = new Set<string>();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.setGlobalPrefix('api/v1');
    await app.init();
    http = createHttp(app);
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    await app?.close();
  });

  function uniqueEmail(prefix: string) {
    return `${prefix}-${randomUUID()}@example.com`;
  }

  async function register(email: string) {
    createdEmails.add(email);
    return http.post('/api/v1/auth/register').send({
      firstName: 'Test',
      lastName: 'User',
      email,
      password: 'passworD1',
    });
  }

  async function login(email: string) {
    return http.post('/api/v1/auth/login').send({ email, password: 'passworD1' });
  }

  async function registerAndLogin(prefix: string) {
    const email = uniqueEmail(prefix);
    const registered = await register(email);
    expect(registered.status).toBe(201);
    const session = await login(email);
    expect(session.status).toBe(200);
    expect(session.body.accessToken).toEqual(expect.any(String));
    return { email, token: session.body.accessToken as string };
  }

  function authHeader(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  async function privateTeamId(token: string) {
    const teams = await http.get('/api/v1/team/user').set(authHeader(token));
    expect(teams.status).toBe(200);
    const privateTeam = teams.body.find((team: { name: string }) => team.name === 'Private');
    expect(privateTeam?.id).toEqual(expect.any(String));
    return privateTeam.id as string;
  }

  async function seedDocument(email: string, teamId: string, status = DocumentStatus.COMPLETED) {
    const user = await dataSource.getRepository(User).findOneByOrFail({ email });
    const team = await dataSource.getRepository(Team).findOneByOrFail({ id: teamId });
    const document = await dataSource.getRepository(Document).save(
      dataSource.getRepository(Document).create({
        fileName: 'policy.pdf',
        storageUrl: `users/${user.id}/documents/${randomUUID()}/policy.pdf`,
        status,
        user,
      }),
    );
    await dataSource
      .getRepository(TeamDocument)
      .save(dataSource.getRepository(TeamDocument).create({ team, document }));
    return document;
  }

  describe('auth', () => {
    it('rejects unauthenticated profile reads', async () => {
      const res = await http.get('/api/v1/user/me');
      expect(res.status).toBe(401);
    });

    it('registers a user and creates a session', async () => {
      const email = uniqueEmail('register');
      const registered = await register(email);
      expect(registered.status).toBe(201);
      expect(registered.body.msg).toBe('Registration is successfull!');

      const session = await login(email);
      expect(session.status).toBe(200);
      expect(session.body.accessToken).toEqual(expect.any(String));
    });

    it('rejects a duplicate email with 409', async () => {
      const email = uniqueEmail('dup');
      expect((await register(email)).status).toBe(201);
      const again = await register(email);
      expect(again.status).toBe(409);
      expect(again.body.message).toBe('User with this email already exists');
    });

    it('uses the same 401 for a bad password and a missing email', async () => {
      const email = uniqueEmail('login');
      expect((await register(email)).status).toBe(201);

      const badPassword = await http.post('/api/v1/auth/login').send({
        email,
        password: 'WrongPass1',
      });
      const missing = await http.post('/api/v1/auth/login').send({
        email: uniqueEmail('missing'),
        password: PASSWORD,
      });

      expect(badPassword.status).toBe(401);
      expect(missing.status).toBe(401);
      expect(badPassword.body.message).toBe(missing.body.message);
    });

    it('returns the profile without passwordHash', async () => {
      const { email, token } = await registerAndLogin('me');
      const res = await http.get('/api/v1/user/me').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.email).toBe(email);
      expect(res.body).not.toHaveProperty('passwordHash');
    });

    it('rejects a weak password', async () => {
      const res = await http.post('/api/v1/auth/register').send({
        firstName: 'Test',
        lastName: 'User',
        email: uniqueEmail('weak'),
        password: 'password',
      });
      expect(res.status).toBe(400);
    });

    it('rejects unknown DTO fields', async () => {
      const res = await http.post('/api/v1/auth/register').send({
        firstName: 'Test',
        lastName: 'User',
        email: uniqueEmail('extra'),
        password: PASSWORD,
        role: 'admin',
      });
      expect(res.status).toBe(400);
    });
  });

  describe('team ACL and query gate', () => {
    it('creates Private on register and blocks reserved Private mutations', async () => {
      const { token } = await registerAndLogin('alice');
      const auth = { Authorization: `Bearer ${token}` };

      const teams = await http.get('/api/v1/team/user').set(auth);
      expect(teams.status).toBe(200);
      const privateTeam = teams.body.find((team: { name: string }) => team.name === 'Private');
      expect(privateTeam?.id).toEqual(expect.any(String));

      const recreate = await http.post('/api/v1/team').set(auth).send({ name: 'Private' });
      expect(recreate.status).toBe(400);

      const remove = await http.delete(`/api/v1/team/${privateTeam.id}`).set(auth);
      expect(remove.status).toBe(400);

      const shared = await http.post('/api/v1/team').set(auth).send({ name: 'Engineering' });
      expect(shared.status).toBe(201);
    });

    it('hides another user team list and query from non-members', async () => {
      const alice = await registerAndLogin('alice-acl');
      const bob = await registerAndLogin('bob-acl');

      const aliceTeams = await http
        .get('/api/v1/team/user')
        .set('Authorization', `Bearer ${alice.token}`);
      const alicePrivate = aliceTeams.body.find(
        (team: { name: string }) => team.name === 'Private',
      );
      expect(alicePrivate?.id).toBeDefined();

      const bobList = await http
        .get(`/api/v1/document/list/team/${alicePrivate.id}`)
        .set('Authorization', `Bearer ${bob.token}`);
      expect(bobList.status).toBe(404);

      const bobQuery = await http
        .post('/api/v1/document/query')
        .set('Authorization', `Bearer ${bob.token}`)
        .send({ query: 'what is in the docs?', team_id: alicePrivate.id });
      expect(bobQuery.status).toBe(400);
      expect(bobQuery.body.message).toBe('You are not a member of this group!');
    });

    it('lets the owner add a member and blocks Private membership and owner leave', async () => {
      const owner = await registerAndLogin('team-owner');
      const member = await registerAndLogin('team-member');
      const ownerAuth = authHeader(owner.token);

      const created = await http.post('/api/v1/team').set(ownerAuth).send({ name: 'Engineering' });
      expect(created.status).toBe(201);
      const teamId = created.body.id as string;

      const added = await http
        .post(`/api/v1/team/${teamId}/add-member`)
        .set(ownerAuth)
        .send({ email: member.email });
      expect(added.status).toBe(201);

      const asMember = await http
        .post(`/api/v1/team/${teamId}/add-member`)
        .set(authHeader(member.token))
        .send({ email: owner.email });
      expect(asMember.status).toBe(404);

      const privateId = await privateTeamId(owner.token);
      const privateAdd = await http
        .post(`/api/v1/team/${privateId}/add-member`)
        .set(ownerAuth)
        .send({ email: member.email });
      expect(privateAdd.status).toBe(400);

      const ownerLeave = await http.post(`/api/v1/team/${teamId}/leave`).set(ownerAuth);
      expect(ownerLeave.status).toBe(400);

      const memberLeave = await http
        .post(`/api/v1/team/${teamId}/leave`)
        .set(authHeader(member.token));
      expect(memberLeave.status).toBe(201);
    });
  });

  describe('user module', () => {
    it('updates the profile and rejects unknown fields', async () => {
      const { email, token } = await registerAndLogin('user-update');
      const auth = authHeader(token);

      const updated = await http.put('/api/v1/user').set(auth).send({ firstName: 'Ada' });
      expect(updated.status).toBe(200);

      const me = await http.get('/api/v1/user/me').set(auth);
      expect(me.status).toBe(200);
      expect(me.body.email).toBe(email);
      expect(me.body.firstName).toBe('Ada');

      const extra = await http
        .put('/api/v1/user')
        .set(auth)
        .send({ firstName: 'Ada', role: 'admin' });
      expect(extra.status).toBe(400);
    });

    it('blocks account deletion while the user still owns a shared team', async () => {
      const { token } = await registerAndLogin('user-delete');
      const auth = authHeader(token);

      const created = await http.post('/api/v1/team').set(auth).send({ name: 'Ops' });
      expect(created.status).toBe(201);

      const blocked = await http.delete('/api/v1/user').set(auth);
      expect(blocked.status).toBe(400);

      const removedTeam = await http.delete(`/api/v1/team/${created.body.id}`).set(auth);
      expect(removedTeam.status).toBe(200);

      const deleted = await http.delete('/api/v1/user').set(auth);
      expect(deleted.status).toBe(200);
    });
  });

  describe('document module', () => {
    it('lists only documents the caller can see', async () => {
      const alice = await registerAndLogin('doc-alice');
      const bob = await registerAndLogin('doc-bob');
      const alicePrivate = await privateTeamId(alice.token);
      const doc = await seedDocument(alice.email, alicePrivate);

      const aliceList = await http.get('/api/v1/document/list/me').set(authHeader(alice.token));
      expect(aliceList.status).toBe(200);
      expect(aliceList.body.some((row: { id: string }) => row.id === doc.id)).toBe(true);
      expect(aliceList.body[0]).not.toHaveProperty('storageUrl');

      const bobTeamList = await http
        .get(`/api/v1/document/list/team/${alicePrivate}`)
        .set(authHeader(bob.token));
      expect(bobTeamList.status).toBe(404);

      const bobMe = await http.get('/api/v1/document/list/me').set(authHeader(bob.token));
      expect(bobMe.status).toBe(200);
      expect(bobMe.body.some((row: { id: string }) => row.id === doc.id)).toBe(false);
    });

    it('lets only the owner share, and never onto Private', async () => {
      const alice = await registerAndLogin('share-alice');
      const bob = await registerAndLogin('share-bob');
      const aliceAuth = authHeader(alice.token);
      const alicePrivate = await privateTeamId(alice.token);
      const doc = await seedDocument(alice.email, alicePrivate);

      const engineering = await http.post('/api/v1/team').set(aliceAuth).send({ name: 'Legal' });
      expect(engineering.status).toBe(201);
      expect(
        (
          await http
            .post(`/api/v1/team/${engineering.body.id}/add-member`)
            .set(aliceAuth)
            .send({ email: bob.email })
        ).status,
      ).toBe(201);

      const ontoPrivate = await http
        .post(`/api/v1/document/share/${doc.id}`)
        .set(aliceAuth)
        .send({ team_ids: [alicePrivate] });
      expect(ontoPrivate.status).toBe(400);

      const asBob = await http
        .post(`/api/v1/document/share/${doc.id}`)
        .set(authHeader(bob.token))
        .send({ team_ids: [engineering.body.id] });
      expect(asBob.status).toBe(404);

      const shared = await http
        .post(`/api/v1/document/share/${doc.id}`)
        .set(aliceAuth)
        .send({ team_ids: [engineering.body.id] });
      expect(shared.status).toBe(201);

      const bobSees = await http
        .get(`/api/v1/document/list/team/${engineering.body.id}`)
        .set(authHeader(bob.token));
      expect(bobSees.status).toBe(200);
      expect(bobSees.body.some((row: { id: string }) => row.id === doc.id)).toBe(true);

      const unsharePrivate = await http
        .post(`/api/v1/document/unshare/${doc.id}`)
        .set(aliceAuth)
        .send({ team_ids: [alicePrivate] });
      expect(unsharePrivate.status).toBe(400);
    });

    it('rejects retry unless the document failed, and query unless a completed file exists', async () => {
      const { email, token } = await registerAndLogin('doc-query');
      const auth = authHeader(token);
      const privateId = await privateTeamId(token);
      const pending = await seedDocument(email, privateId, DocumentStatus.PENDING);

      const emptyQuery = await http
        .post('/api/v1/document/query')
        .set(auth)
        .send({ query: 'summarize the policy', team_id: privateId });
      expect(emptyQuery.status).toBe(400);
      expect(emptyQuery.body.message).toBe('No completed documents found!');

      const retry = await http.post(`/api/v1/document/retry/${pending.id}`).set(auth);
      expect(retry.status).toBe(400);

      const asOther = await registerAndLogin('doc-other');
      const stolen = await http
        .post(`/api/v1/document/retry/${pending.id}`)
        .set(authHeader(asOther.token));
      expect(stolen.status).toBe(404);
    });
  });
});
