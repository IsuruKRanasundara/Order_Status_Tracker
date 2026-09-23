import { Router } from 'express';
import { createOrderController } from '../controllers/order.controller.js';
import type { OrderService } from '../services/order.service.js';

export function createOrderRouter(service: OrderService) {
  const router = Router();
  const controller = createOrderController(service);
  router.post('/webhooks/orders', controller.receiveEvent);
  router.get('/orders', controller.listOrders);
  router.get('/orders/:id', controller.getOrder);
  return router;
}
