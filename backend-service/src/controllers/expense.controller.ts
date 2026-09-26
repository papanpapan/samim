import { Request, Response } from 'express';
import { z } from 'zod';
import { ExpenseCategory } from '@prisma/client';
import { prisma } from '../config/database';
import { withNursery } from '../services/tenantContext';
import { writeAudit } from '../services/audit.service';

export const createExpenseSchema = z.object({
  category: z.nativeEnum(ExpenseCategory),
  amount: z.coerce.number().positive(),
  note: z.string().optional(),
  spentOn: z.coerce.date().optional(),
});

export async function listExpenses(_req: Request, res: Response): Promise<void> {
  const [items, total] = await Promise.all([
    prisma.expense.findMany({ orderBy: { spentOn: 'desc' }, take: 200 }),
    prisma.expense.aggregate({ _sum: { amount: true } }),
  ]);
  res.json({
    success: true,
    data: items,
    meta: { totalAmount: Number(total._sum.amount ?? 0) },
  });
}

export async function createExpense(req: Request, res: Response): Promise<void> {
  const body = req.body as z.infer<typeof createExpenseSchema>;
  const expense = await prisma.expense.create({
    data: withNursery({
      category: body.category,
      amount: body.amount,
      note: body.note,
      spentOn: body.spentOn ?? new Date(),
      recordedBy: req.user!.id,
    }),
  });
  await writeAudit(req.user!.id, 'CREATE', 'Expense', expense.id, {
    category: expense.category,
    amount: body.amount,
  });
  res.status(201).json({ success: true, data: expense });
}
