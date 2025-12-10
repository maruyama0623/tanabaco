import express from 'express';
import cors from 'cors';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();
const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));

const mapProduct = (p: Prisma.ProductUncheckedCreateInput) => {
  const { imageUrl: _legacy, ...rest } = p as any;
  return {
    ...rest,
    unit: (rest as any).unit ?? 'P',
    imageUrls: Array.isArray(rest.imageUrls) ? rest.imageUrls : rest.imageUrls ? (rest.imageUrls as any) : [],
    departments: Array.isArray(rest.departments) ? rest.departments : rest.departments ? (rest.departments as any) : [],
  };
};

const monthKey = (d: string) => (d ?? '').slice(0, 7);

app.get('/api/products', async (_req, res) => {
  const products = await prisma.product.findMany();
  res.json(products);
});

app.post('/api/products/bulk', async (req, res) => {
  const products = (req.body?.products as Prisma.ProductUncheckedCreateInput[]) ?? [];
  await prisma.$transaction([
    prisma.photoRecord.updateMany({ data: { productId: null } }),
    prisma.product.deleteMany(),
    prisma.product.createMany({ data: products.map(mapProduct) }),
  ]);
  res.json({ ok: true });
});

app.get('/api/masters', async (_req, res) => {
  const [departments, staff, suppliers] = await Promise.all([
    prisma.department.findMany(),
    prisma.staffMember.findMany(),
    prisma.supplier.findMany(),
  ]);
  res.json({
    departments: departments.map((d) => d.name),
    staffMembers: staff.map((s) => s.name),
    suppliers: suppliers.map((s) => s.name),
  });
});

app.post('/api/masters', async (req, res) => {
  const { departments = [], staffMembers = [], suppliers = [] } = req.body ?? {};
  await prisma.$transaction([
    prisma.department.deleteMany(),
    prisma.staffMember.deleteMany(),
    prisma.supplier.deleteMany(),
    prisma.department.createMany({ data: (departments as string[]).map((name) => ({ name })) }),
    prisma.staffMember.createMany({ data: (staffMembers as string[]).map((name) => ({ name })) }),
    prisma.supplier.createMany({ data: (suppliers as string[]).map((name) => ({ name })) }),
  ]);
  res.json({ ok: true });
});

const includePhotos = {
  include: { photoRecords: { orderBy: { takenAt: 'desc' } } },
};

app.get('/api/session', async (_req, res) => {
  const session = await prisma.inventorySession.findFirst({
    where: { isCurrent: true },
    ...includePhotos,
  });
  res.json(session);
});

app.post('/api/session', async (req, res) => {
  const session = req.body ?? null;
  if (!session) {
    await prisma.inventorySession.updateMany({ data: { isCurrent: false }, where: { isCurrent: true } });
    return res.json({ ok: true });
  }
  const { photoRecords = [], ...rest } = session;
  const mk = monthKey(rest.inventoryDate);
  const existingLock = await prisma.inventorySession.findUnique({
    where: { department_monthKey: { department: rest.department, monthKey: mk } },
  });
  if (existingLock?.isLocked) {
    return res.status(400).json({ error: 'locked' });
  }
  await prisma.$transaction(async (tx) => {
    await tx.inventorySession.updateMany({ data: { isCurrent: false } });
    const existing = await tx.inventorySession.findUnique({
      where: { department_monthKey: { department: rest.department, monthKey: mk } },
    });
    const targetId = existing?.id ?? rest.id;
    const sessionData = {
      ...rest,
      id: targetId,
      monthKey: mk,
      isCurrent: true,
      isLocked: rest.isLocked ?? false,
    };
    await tx.inventorySession.upsert({
      where: { id: targetId },
      update: sessionData,
      create: sessionData,
    });
    await tx.photoRecord.deleteMany({ where: { sessionId: targetId } });
    if (photoRecords.length) {
      await tx.photoRecord.createMany({
        data: photoRecords.map((p: any) => ({
          ...p,
          sessionId: targetId,
          department: rest.department,
          inventoryDate: rest.inventoryDate,
          quantity: p.quantity === null ? null : Number(p.quantity),
        })),
      });
    }
  });
  res.json({ ok: true });
});

app.get('/api/history', async (_req, res) => {
  const history = await prisma.inventorySession.findMany({
    where: { isCurrent: false },
    ...includePhotos,
  });
  res.json(history);
});

app.post('/api/history', async (req, res) => {
  const history = (req.body ?? []) as any[];
  await prisma.$transaction(async (tx) => {
    const oldSessions = await tx.inventorySession.findMany({
      where: { isCurrent: false },
      select: { id: true, isLocked: true },
    });
    const lockedIds = oldSessions.filter((s) => s.isLocked).map((s) => s.id);
    const deletableIds = oldSessions.filter((s) => !s.isLocked).map((s) => s.id);
    if (deletableIds.length) {
      await tx.photoRecord.deleteMany({ where: { sessionId: { in: deletableIds } } });
      await tx.inventorySession.deleteMany({ where: { id: { in: deletableIds } } });
    }
    for (const s of history) {
      const { photoRecords = [], ...rest } = s;
      const mk = monthKey(rest.inventoryDate);
      const targetId = rest.id ?? `${rest.department}-${mk}`;
      if (lockedIds.includes(targetId)) {
        continue;
      }
      await tx.inventorySession.upsert({
        where: { department_monthKey: { department: rest.department, monthKey: mk } },
        update: {
          ...rest,
          id: targetId,
          monthKey: mk,
          isCurrent: false,
          isLocked: rest.isLocked ?? false,
        },
        create: {
          ...rest,
          id: targetId,
          monthKey: mk,
          isCurrent: false,
          isLocked: rest.isLocked ?? false,
        },
      });
      await tx.photoRecord.deleteMany({ where: { sessionId: targetId } });
      if (photoRecords.length) {
        await tx.photoRecord.createMany({
          data: photoRecords.map((p: any) => ({
            ...p,
            department: rest.department,
            inventoryDate: rest.inventoryDate,
            sessionId: targetId,
            quantity: p.quantity === null ? null : Number(p.quantity),
          })),
        });
      }
    }
  });
  res.json({ ok: true });
});

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.post('/api/session/lock', async (req, res) => {
  const { sessionId, session: payload } = req.body ?? {};
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

  const existing = await prisma.inventorySession.findUnique({ where: { id: sessionId } });
  if (!existing && !payload) return res.status(404).json({ error: 'not found' });

  if (existing?.isLocked) return res.json({ ok: true, locked: true });

  const data =
    payload && !existing
      ? {
          ...payload,
          id: sessionId,
          monthKey: monthKey(payload.inventoryDate),
          isLocked: true,
          isCurrent: payload.isCurrent ?? false,
        }
      : null;

  if (data) {
    await prisma.inventorySession.upsert({
      where: { id: sessionId },
      update: data,
      create: data,
    });
  } else {
    await prisma.inventorySession.update({ where: { id: sessionId }, data: { isLocked: true } });
  }

  res.json({ ok: true, locked: true });
});

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`API server running on http://localhost:${port}`);
});
