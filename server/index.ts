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
    featureSummary: (rest as any).featureSummary ?? '',
    featureEmbedding: (rest as any).featureEmbedding ?? undefined,
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

// ---- AI embedding helpers ----
type EmbeddingVector = number[];
const embeddingCache = new Map<string, EmbeddingVector>();

const cosineSim = (a: EmbeddingVector, b: EmbeddingVector) => {
  if (!a.length || !b.length || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
};

const getEmbedding = async (text: string) => {
  const key = text;
  const cached = embeddingCache.get(key);
  if (cached) return cached;
  const res = await openai?.embeddings.create({
    model: process.env.OPENAI_EMBED_MODEL ?? 'text-embedding-3-small',
    input: text,
  });
  const vector = (res?.data?.[0]?.embedding as number[] | undefined) ?? [];
  embeddingCache.set(key, vector);
  return vector;
};

const buildFeatureText = (p: any) => {
  return [
    p.featureSummary,
    p.name,
    p.productCd,
    p.supplierName,
    p.spec,
    p.storageType,
    (p.departments ?? []).join(' '),
  ]
    .filter(Boolean)
    .join(' ');
};

const buildPhotoFeatureText = (p: any) => {
  return [
    p.featureSummary,
    p.productName,
    p.productCd,
    p.productSupplierName,
    p.productStorageType,
    p.department,
    p.inventoryDate,
  ]
    .filter(Boolean)
    .join(' ');
};

const generateFeatureSummary = async (product: any) => {
  // 画像があれば1枚だけ添付して短い特徴文を生成
  const img = Array.isArray(product.imageUrls) ? product.imageUrls[0] : product.imageUrl;
  if (img && typeof img === 'string' && img.startsWith('http')) {
    const completion = await openai?.chat.completions.create({
      model: openaiModel,
      messages: [
        { role: 'system', content: '商品画像から特徴を20〜40文字程度で要約してください。ラベル上の文字、容量、色形状を含め簡潔に。' },
        {
          role: 'user',
          content: [{ type: 'image_url', image_url: { url: img, detail: 'low' } }],
        },
      ],
      max_tokens: 80,
      temperature: 0.2,
    });
    const text = completion?.choices?.[0]?.message?.content ?? '';
    if (text) return truncate(text, 120);
  }
  // フォールバック: テキストのみ
  return truncate(
    [product.name, product.productCd, product.supplierName, product.spec, product.storageType].filter(Boolean).join(' '),
    120,
  );
};

const generateSummaryFromImage = async (img: string, fallbackText = '') => {
  if (img && typeof img === 'string' && img.startsWith('http')) {
    const completion = await openai?.chat.completions.create({
      model: openaiModel,
      messages: [
        { role: 'system', content: '写真から商品・荷姿を20〜40文字で要約してください。ラベルの文字、容量、ブランド、色形状を簡潔に。' },
        {
          role: 'user',
          content: [{ type: 'image_url', image_url: { url: img, detail: 'low' } }],
        },
      ],
      max_tokens: 80,
      temperature: 0.2,
    });
    const text = completion?.choices?.[0]?.message?.content ?? '';
    if (text) return truncate(text, 120);
  }
  return fallbackText;
};

const ensureProductFeature = async (product: any) => {
  if (product.featureSummary && Array.isArray(product.featureEmbedding) && product.featureEmbedding.length) {
    return product;
  }
  const summary = product.featureSummary || (await generateFeatureSummary(product));
  const emb = await getEmbedding(summary || buildFeatureText(product));
  await prisma.product.update({
    where: { id: product.id },
    data: { featureSummary: summary, featureEmbedding: emb },
  });
  return { ...product, featureSummary: summary, featureEmbedding: emb };
};

const ensurePhotoFeature = async (photo: any) => {
  if (photo.featureSummary && Array.isArray(photo.featureEmbedding) && photo.featureEmbedding.length) {
    return photo;
  }
  // 画像1枚だけで特徴生成を試行
  const urls = uniq([photo.imageUrl, ...(Array.isArray(photo.imageUrls) ? photo.imageUrls : [])]).filter(Boolean);
  let summary = photo.featureSummary as string | undefined;
  if (!summary && urls.length && typeof urls[0] === 'string' && urls[0].startsWith('http')) {
    const completion = await openai?.chat.completions.create({
      model: openaiModel,
      messages: [
        {
          role: 'system',
          content:
            '写真から商品・荷姿を20〜40文字で要約してください。ラベルの文字、容量、ブランド、色形状を簡潔に。',
        },
        {
          role: 'user',
          content: [{ type: 'image_url', image_url: { url: urls[0], detail: 'low' } }],
        },
      ],
      max_tokens: 80,
      temperature: 0.2,
    });
    summary = completion?.choices?.[0]?.message?.content ?? '';
  }
  if (!summary) {
    summary = truncate(
      [photo.productName, photo.productCd, photo.productSupplierName, photo.productStorageType, photo.department]
        .filter(Boolean)
        .join(' '),
      120,
    );
  }
  const emb = await getEmbedding(summary || buildPhotoFeatureText(photo));
  await prisma.photoRecord.update({
    where: { id: photo.id },
    data: { featureSummary: summary, featureEmbedding: emb },
  });
  return { ...photo, featureSummary: summary, featureEmbedding: emb };
};

const processPhotoFeatures = async (ids: string[]) => {
  if (!openai || !ids.length) return;
  const records = await prisma.photoRecord.findMany({ where: { id: { in: ids } } });
  for (const r of records) {
    try {
      await ensurePhotoFeature(r);
    } catch (e) {
      console.warn('auto photo feature failed', r.id, e);
    }
  }
};

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
    let userQuery = (query ?? '').toString().slice(0, 500);

    const [products, photoRecords] = await Promise.all([
      prisma.product.findMany(),
      prisma.photoRecord.findMany({
        where: department ? { department } : undefined,
        orderBy: { takenAt: 'desc' },
        take: 200, // トークン削減のため最新のみ
      }),
    ]);
    if (!products.length) return res.json({ suggestions: [], message: 'no-products' });

    // Embeddingで直接スコアリング（ChatGPTは使わない）
    try {
      let queryText = [userQuery, department].filter(Boolean).join(' ').trim();
      if (photoUrl && typeof photoUrl === 'string' && photoUrl.startsWith('http')) {
        const imgSummary = await generateSummaryFromImage(photoUrl, userQuery);
        queryText = [queryText, imgSummary].filter(Boolean).join(' ').trim() || '写真から商品を推定';
      }
      const queryEmbedding = await getEmbedding(queryText || '商品を推定');
      if (!queryEmbedding.length) return res.json({ suggestions: [], message: 'embed_failed' });

      // Products
      const productCandidates = await Promise.all(
        products
          .filter((p) => {
            const depts = toStringArray(p.departments);
            return department ? depts.includes(department) : true;
          })
          .map(async (p) => {
            const feature = await ensureProductFeature(p);
            const emb = Array.isArray((feature as any).featureEmbedding)
              ? ((feature as any).featureEmbedding as number[])
              : await getEmbedding(buildFeatureText(feature));
            return {
              source: 'product' as const,
              id: feature.id,
              productId: feature.id,
              name: feature.name,
              featureSummary: feature.featureSummary ?? '',
              featureEmbedding: emb,
            };
          }),
      );

      // PhotoRecords
      const photoCandidates = await Promise.all(
        photoRecords.map(async (p) => {
          const feature = await ensurePhotoFeature(p);
          const emb = Array.isArray((feature as any).featureEmbedding)
            ? ((feature as any).featureEmbedding as number[])
            : await getEmbedding(buildPhotoFeatureText(feature));
          return {
            source: 'photo' as const,
            id: feature.id,
            productId: feature.productId ?? feature.id,
            photoRecordId: feature.id,
            name: feature.productName ?? 'PhotoRecord',
            featureSummary: feature.featureSummary ?? '',
            featureEmbedding: emb,
          };
        }),
      );

      const withScore = [...productCandidates, ...photoCandidates].map((c) => ({
        ...c,
        confidence: cosineSim(queryEmbedding, c.featureEmbedding ?? []),
      }));

      const sorted = withScore
        .filter((c) => c.confidence > 0)
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 3);

      res.json({
        suggestions: sorted.map((s) => ({
          productId: s.productId,
          photoRecordId: s.source === 'photo' ? s.photoRecordId : undefined,
          source: s.source,
          reason: s.featureSummary,
          confidence: s.confidence,
        })),
        model: openaiModel,
      });
    } catch (e) {
      console.error('ai-search embedding skip', e);
      res.status(500).json({ error: 'AI検索でエラーが発生しました' });
    }
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
    suppliers: suppliers.map((s) => ({ code: s.code, name: s.name })),
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
    prisma.supplier.createMany({
      data: (suppliers as any[]).map((s) => ({
        code: typeof s === 'string' ? s : s.code,
        name: typeof s === 'string' ? s : s.name,
      })),
    }),
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
  // 特徴を自動付与（新規で受け取ったIDのみ）
  const newPhotoIds = sanitizedPhotos.map((p: any) => p.id).filter(Boolean);
  if (newPhotoIds.length) {
    processPhotoFeatures(newPhotoIds);
  }
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
        const newPhotoIds = sanitizedPhotos.map((p: any) => p.id).filter(Boolean);
        if (newPhotoIds.length) {
          processPhotoFeatures(newPhotoIds);
        }
      }
    }
  });
  res.json({ ok: true });
});

// 既存商品の特徴を生成して保存するバッチ
app.post('/api/products/ingest-features', async (_req, res) => {
  try {
    const products = await prisma.product.findMany();
    let updated = 0;
    for (const p of products) {
      if (p.featureSummary && Array.isArray(p.featureEmbedding) && p.featureEmbedding.length) continue;
      try {
        await ensureProductFeature(p);
        updated += 1;
      } catch (e) {
        console.warn('ingest feature failed', p.id, e);
      }
    }
    res.json({ ok: true, updated });
  } catch (e) {
    console.error('ingest features error', e);
    res.status(500).json({ error: 'ingest_failed' });
  }
});

// PhotoRecord の特徴を生成して保存するバッチ
app.post('/api/photo-records/ingest-features', async (_req, res) => {
  try {
    const records = await prisma.photoRecord.findMany();
    let updated = 0;
    for (const r of records) {
      if (r.featureSummary && Array.isArray(r.featureEmbedding) && (r.featureEmbedding as any)?.length) continue;
      try {
        await ensurePhotoFeature(r);
        updated += 1;
      } catch (e) {
        console.warn('ingest photo feature failed', r.id, e);
      }
    }
    res.json({ ok: true, updated });
  } catch (e) {
    console.error('ingest photo features error', e);
    res.status(500).json({ error: 'ingest_failed' });
  }
});

// CSVアップロードで仕入先を登録/更新（キーはcode）
app.post(
  '/api/suppliers/upload',
  express.text({ type: ['text/csv', 'text/plain', 'application/octet-stream'], limit: '5mb' }),
  async (req, res) => {
    const csv = (req.body ?? '').toString();
    if (!csv.trim()) return res.status(400).json({ error: 'empty_csv' });
    const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    // 先頭行がヘッダーの場合を想定: code,name
    const records: { code: string; name: string }[] = [];
    const stripQuotes = (s: string) => s.replace(/^["']+|["']+$/g, '');
    for (const line of lines) {
      const [a, b] = line.split(',').map((s) => s.trim());
      if (!a || !b) continue;
      // ヘッダーをスキップ
      if (records.length === 0 && a.toLowerCase() === 'code' && b.toLowerCase() === 'name') continue;
      records.push({ code: stripQuotes(a), name: stripQuotes(b) });
    }
    if (!records.length) return res.status(400).json({ error: 'no_records' });
    try {
      for (const r of records) {
        await prisma.supplier.upsert({
          where: { code: r.code },
          update: { name: r.name },
          create: { code: r.code, name: r.name },
        });
      }
      res.json({ ok: true, upserted: records.length });
    } catch (e) {
      console.error('supplier upload error', e);
      res.status(500).json({ error: 'upload_failed' });
    }
  },
);

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
