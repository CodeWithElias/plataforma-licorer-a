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

  it('GET /health', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'UP', servicio: 'ms-gestion' });
  });

  it('query salud', () => {
    return request(app.getHttpServer())
      .post('/graphql')
      .send({ query: '{ salud }' })
      .expect(200)
      .expect({ data: { salud: 'ok' } });
  });

  afterEach(async () => {
    await app.close();
  });
});
