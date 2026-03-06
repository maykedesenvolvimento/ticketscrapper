import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from './../src/app.module';

/**
 * E2E bootstrap test — verifies the NestJS app starts without errors.
 * Full scraper flow tests live in src/scraper/scraper.service.spec.ts.
 */
describe('App bootstrap (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should initialise the application without errors', () => {
    expect(app).toBeDefined();
  });
});
