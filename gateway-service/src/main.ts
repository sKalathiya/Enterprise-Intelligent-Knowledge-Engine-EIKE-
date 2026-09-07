import { NestFactory } from '@nestjs/core';
import { AppModule, ObserveInstrument } from './app.module.js';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });

  app.setGlobalPrefix('api'); 
  const config = new DocumentBuilder()
    .setTitle('Gateway Service')
    .setDescription('Gateway Service API handling distributed AI operations, file token lines, and queue workers.')
    .setVersion('1.0')
    .addTag('Core Engine')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
  
  await app.listen(process.env.GATEWAY_SERVICE_PORT ?? 3000);
  console.log(`Gateway Service is running on port ${process.env.GATEWAY_SERVICE_PORT ?? 3000}`);
  console.log(`Gateway Service API documentation is available at http://localhost:${process.env.GATEWAY_SERVICE_PORT ?? 3000}/api/docs`);
}
await bootstrap();
