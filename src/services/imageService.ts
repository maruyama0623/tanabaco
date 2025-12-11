type ImageProcessOptions = {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0-1 for JPEG/WebP
};

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });

export async function fileToDataUrl(
  file: File,
  { maxWidth = 1280, maxHeight = 1280, quality = 0.8 }: ImageProcessOptions = {},
): Promise<string> {
  const original = await readFileAsDataUrl(file);

  // 画像をロード
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = (e) => reject(e);
    image.src = original;
  });

  // リサイズ不要なら元データを返す
  if (img.width <= maxWidth && img.height <= maxHeight) {
    return original;
  }

  const scale = Math.min(maxWidth / img.width, maxHeight / img.height);
  const targetW = Math.round(img.width * scale);
  const targetH = Math.round(img.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return original;
  ctx.drawImage(img, 0, 0, targetW, targetH);

  // JPEGで圧縮（透明を扱う必要があれば image/png に変更）
  return canvas.toDataURL('image/jpeg', quality);
}
