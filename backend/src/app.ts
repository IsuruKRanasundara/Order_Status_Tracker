import express from 'express';
import cors from 'cors';
import { AppError } from './domain/app-error.js';
import { errorHandler } from './middleware/error-handler.js';
import { InMemoryOrderRepository } from './repositories/order.repository.js';
import { createOrderRouter } from './routes/order.routes.js';
import { OrderService } from './services/order.service.js';

export function createApp(service = new OrderService(new InMemoryOrderRepository())) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173' }));
  app.use(express.json({ limit: '16kb' }));
  app.use(createOrderRouter(service));
  app.use((_req, _res, next) => next(new AppError(404, 'NOT_FOUND', 'Route not found.')));
  app.use(errorHandler);
  return app;
}
