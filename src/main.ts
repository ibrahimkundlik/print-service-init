import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { JsonLogger } from './Modules/Logger/json.logger';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  app.useLogger(new JsonLogger());
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  app.useBodyParser('json');
  app.useBodyParser('urlencoded', { extended: true });

  const port = process.env.PORT ? Number(process.env.PORT) : 6000;
  await app.listen(port);
}

bootstrap();
