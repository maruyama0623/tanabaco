import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();
const app = express();
const openaiApiKey = process.env.OPENAI_API_KEY;
const openaiModel = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
const openai =
  openaiApiKey && openaiApiKey !== 'undefined' ? new OpenAI({ apiKey: openaiApiKey }) : null;

// CORS 設定
// Render 経由で Netlify やローカルからのアクセスを許可。Origin を限定すると環境ごとに弾かれやすいためワイルドカードで許可。
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);
app.options('*', cors());

// 画像(Base64)を含むリクエストが大きくなるため余裕を持たせる
app.use(express.json({ limit: '100mb' }));

const mapProduct = (p: Prisma.ProductUncheckedCreateInput) => {
  const { imageUrl: _legacy, ...rest } = p as any;
  return {
    ...rest,
    unit: (rest as any).unit ?? 'P',
    imageUrls: Array.isArray(rest.imageUrls) ? rest.imageUrls : rest.imageUrls ? (rest.imageUrls as any) : [],
    departments: Array.isArray(rest.departments) ? rest.departments : rest.departments ? (rest.departments as any) : [],
  };
};

const toStringArray = (value: Prisma.JsonValue | null | undefined): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((v) => String(v));
  return [];
};

const uniq = <T,>(arr: T[]) => Array.from(new Set(arr));

const truncate = (text: string | null | undefined, max = 140) => {
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max)}…` : text;
};

const monthKey = (d: string) => (d ?? '').slice(0, 7);

const getValidProductIdSet = async () => {
  const ids = await prisma.product.findMany({ select: { id: true } });
  return new Set(ids.map((p) => p.id));
};

const sanitizeProductId = (photoRecords: any[], validProductIds: Set<string>) =>
  photoRecords.map((p) => ({
    ...p,
    productId: p.productId && validProductIds.has(p.productId) ? p.productId : null,
  }));

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

app.post('/api/ai-search', async (req, res) => {
  try {
    if (!openai) {
      return res.status(500).json({ error: 'OPENAI_API_KEYが未設定です' });
    }

    const { query, photoUrl, department } = req.body ?? {};
    const userQuery = (query ?? '').toString().slice(0, 500);

    const [products, assignedPhotos] = await Promise.all([
      prisma.product.findMany(),
      prisma.photoRecord.findMany({
        where: { productId: { not: null } },
        select: { productId: true, imageUrl: true, imageUrls: true },
        orderBy: { takenAt: 'desc' },
      }),
    ]);
    if (!products.length) return res.json({ suggestions: [], message: 'no-products' });

    const productPhotoMap = assignedPhotos.reduce<Record<string, string[]>>((acc, p) => {
      const urls = uniq([p.imageUrl, ...toStringArray(p.imageUrls as any)]).filter(Boolean);
      if (!urls.length || !p.productId) return acc;
      const current = acc[p.productId] ?? [];
      acc[p.productId] = uniq([...current, ...urls]).slice(0, 3);
      return acc;
    }, {});

    const catalog = products
      .filter((p) => {
        const depts = toStringArray(p.departments);
        return department ? depts.includes(department) : true;
      })
      .map((p) => ({
        id: p.id,
        name: truncate(p.name, 120),
        productCd: truncate(p.productCd, 120),
        supplierName: truncate(p.supplierName, 80),
        spec: truncate((p as any).spec ?? '', 160),
        storageType: truncate((p as any).storageType ?? '', 32),
        unit: (p as any).unit ?? 'P',
        departments: toStringArray(p.departments),
        imageUrls: uniq(toStringArray(p.imageUrls as any)).slice(0, 3),
        samplePhotos: productPhotoMap[p.id] ?? [],
      }));
    if (!catalog.length) return res.json({ suggestions: [], message: 'no-products' });

    const userContent: Array<
      { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' } }
    > = [
      {
        type: 'text',
        text: [
          'ユーザー写真とメモ、カタログ商品(画像付き)をもとに、最も近い商品を信頼度順に上位3件だけ返してください。',
          '画像内の文字（ラベル、商品名、容量、メーカー名）一致を重視し、形状・色も参考にしてください。',
          '必ずJSONオブジェクトで回答: { "suggestions": [ { "productId": string, "reason": string, "confidence": 0-1 } ] } 。confidenceの高い順に並べてください。',
          `ユーザー入力: ${userQuery || '写真から商品を推定してください。'}`,
          `カタログ: ${JSON.stringify(catalog)}`,
        ].join('\n'),
      },
    ];

    if (photoUrl) {
      userContent.push({
        type: 'image_url',
        image_url: { url: photoUrl, detail: 'low' },
      });
    }

    const completion = await openai.chat.completions.create({
      model: openaiModel,
      messages: [
        {
          role: 'system',
          content:
            'You are an inventory assistant. Choose the best matching products from the catalog and respond with JSON only. If nothing matches, return an empty suggestions array.',
        },
        { role: 'user', content: userContent },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    });

    const content = completion.choices[0]?.message?.content ?? '{}';
    let parsed: any = {};
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      console.warn('ai-search JSON parse failed', e, content);
    }
    const suggestions = Array.isArray(parsed?.suggestions)
      ? parsed.suggestions
          .map((s: any) => ({
            productId: String(s.productId ?? s.id ?? ''),
            reason: s.reason ?? s.explanation ?? '',
            confidence:
              typeof s.confidence === 'number'
                ? Math.max(0, Math.min(1, s.confidence))
                : typeof s.score === 'number'
                  ? Math.max(0, Math.min(1, s.score))
                  : 0,
          }))
          .filter((s: any) => catalog.some((c) => c.id === s.productId))
      : [];

    const sorted = suggestions.sort(
      (a, b) => (b.confidence ?? 0) - (a.confidence ?? 0),
    );

    res.json({
      suggestions: sorted.slice(0, 3),
      model: openaiModel,
      totalTokens: completion.usage?.total_tokens ?? undefined,
    });
  } catch (error) {
    console.error('ai-search error', error);
    res.status(500).json({ error: 'AI検索でエラーが発生しました' });
  }
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
  const validProductIds = await getValidProductIdSet();
  const sanitizedPhotos = sanitizeProductId(photoRecords, validProductIds);
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
    if (sanitizedPhotos.length) {
      await tx.photoRecord.createMany({
        data: sanitizedPhotos.map((p: any) => ({
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
  const validProductIds = await getValidProductIdSet();
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
      const sanitizedPhotos = sanitizeProductId(photoRecords, validProductIds);
      if (sanitizedPhotos.length) {
        await tx.photoRecord.createMany({
          data: sanitizedPhotos.map((p: any) => ({
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
