import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';

describe('ms-gestion (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('GET /health sin MONGO_URL responde DOWN', () => {
    delete process.env.MONGO_URL;
    return request(app.getHttpServer())
      .get('/health')
      .expect(503)
      .expect({ status: 'DOWN', servicio: 'ms-gestion', components: { mongodb: { status: 'DOWN', error: 'Falta MONGO_URL' } } });
  });

  it('query salud no exige token', () => {
    return request(app.getHttpServer())
      .post('/graphql')
      .send({ query: '{ salud }' })
      .expect(200)
      .expect({ data: { salud: 'ok' } });
  });

  it('query yo sin token responde no autenticado', async () => {
    const res = await request(app.getHttpServer()).post('/graphql').send({ query: '{ yo { usuario roles } }' });
    expect(res.body.data).toBeNull();
    expect(res.body.errors[0].message).toBe('Unauthorized');
  });

  it('query yo con token falso responde no autenticado', async () => {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', 'Bearer abc.def.ghi')
      .send({ query: '{ yo { usuario } }' });
    expect(res.body.errors[0].message).toBe('Unauthorized');
  });

  afterEach(async () => {
    await app.close();
  });
});
