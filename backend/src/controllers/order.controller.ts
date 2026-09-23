import type { Request, Response } from 'express';
import { AppError } from '../domain/app-error.js';
import { OrderService, orderStatusSchema } from '../services/order.service.js';

export function createOrderController(service: OrderService) {
  return {
    receiveEvent(req: Request, res: Response) {
      const result = service.receiveEvent(req.body);
      res.status(result.event.outcome === 'pending' ? 202 : 200).json(result);
    },
    listOrders(req: Request, res: Response) {
      const status = orderStatusSchema.optional().safeParse(req.query.status);
      if (!status.success) throw new AppError(400, 'INVALID_STATUS', 'Provide one valid status filter.');
      res.json(service.listOrders(status.data));
    },
    getOrder(req: Request<{ id: string }>, res: Response) {
      res.json(service.getOrder(req.params.id));
    },
  };
}
