import { NestFactory } from '@nestjs/core';
import { AppModule, ObserveInstrument } from './app.module.js';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { ValidationPipe } from '@nestjs/common';
import { TimeoutInterceptor } from './utils/interceptors/timeout.interceptor.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });

  // --- SECURITY LAYER 2: HELMET HEADERS ---
  // Hides engineering headers (like X-Powered-By) and mitigates XSS/Clickjacking vulnerabilities
  app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false, // Keeps local Swagger rendering cleanly
  }));

  // --- SECURITY LAYER 3: CORS POLICY ---
  // Controls who can access the API from different domains (frontend apps, bots, etc.)
  app.enableCors({
    origin: process.env.GATEWAY_SERVICE_CORS_ORIGIN ?? '*', // Allows all origins in development, restrict in production
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Allow common HTTP methods
    allowedHeaders: ['Content-Type', 'Authorization'], // Allow common headers
  });

  // --- SECURITY LAYER 4: INCOMING PAYLOAD CAPS ---
  // Standardizes memory buffers to drop huge rogue JSON files (prevents memory exhaustion DoS)
  app.use(json({ limit: '10mb' })); 
  app.use(urlencoded({ limit: '10mb', extended: true }));

  // --- SECURITY LAYER 5: RUNTIME OBJECT SANITIZATION ---
  // Intercepts network payloads and drops unauthorized properties before hitting controllers
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,          // Strips out any unmapped properties sent by malicious users
    forbidNonWhitelisted: true, // Rejects requests entirely if illegal structural keys are found
    transform: true,          // Explicitly converts incoming strings to designated types (e.g. string "5" to number 5)
  }));

   // --- SECURITY LAYER 6: API REQUEST TIMEOUT ---
  // Cleanly flushes the system request queue when downstream networks lag
  app.useGlobalInterceptors(new TimeoutInterceptor());

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
