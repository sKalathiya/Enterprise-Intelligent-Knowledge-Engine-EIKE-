// Public HTTP edge. Browsers talk only to this process; FastAPI is reached from here on the private network.
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { ValidationPipe } from '@nestjs/common';
import { TimeoutInterceptor } from './utils/interceptors/timeout.interceptor.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security headers (hides X-Powered-By, clickjacking, etc.). CSP is off in non-prod so Swagger UI can load.
  app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
  }));

  // Browser origin allowed to call this API. Set GATEWAY_SERVICE_CORS_ORIGIN to the frontend URL in production.
  app.enableCors({
    origin: process.env.GATEWAY_SERVICE_CORS_ORIGIN ?? '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Reject oversized JSON so a client cannot fill Node memory. File bytes never come through this path (S3 presign).
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ limit: '10mb', extended: true }));

  // Drop unknown DTO fields; convert types (e.g. "5" → 5) before controllers run.
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // 15s cap on most routes. /document/query is excluded because SSE can run longer (see TimeoutInterceptor).
  app.useGlobalInterceptors(new TimeoutInterceptor());

  app.setGlobalPrefix('api/v1'); 
  const config = new DocumentBuilder()
    .setTitle('Gateway Service')
    .setDescription('Gateway Service API handling distributed AI operations, file token lines, and queue workers.')
    .setVersion('1.0')
    .addTag('Core Engine')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  // URL is /api/v1/docs even though global prefix is already api/v1.
  SwaggerModule.setup('api/v1/docs', app, document);
  
  await app.listen(process.env.GATEWAY_SERVICE_PORT ?? 3000);
  console.log(`Gateway Service is running on port ${process.env.GATEWAY_SERVICE_PORT ?? 3000}`);
  console.log(`Gateway Service API documentation is available at http://localhost:${process.env.GATEWAY_SERVICE_PORT ?? 3000}/api/v1/docs`);
}
await bootstrap();
