// Client-side image resize/compress before upload.
// Loading a file into <img> lets the browser decode it first — iPhone photos picked
// via <input type="file" accept="image/*"> arrive as JPEG (Safari converts HEIC),
// so the canvas re-encode below handles them. Output is always JPEG.

export async function resizeImageToJpeg(
  file: File | Blob,
  maxW = 1280,
  quality = 0.82
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxW / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('no canvas ctx'));
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('resize failed'))),
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('ไม่สามารถอ่านไฟล์รูปได้ (ไฟล์อาจไม่ใช่รูปภาพ)'));
    };
    img.src = url;
  });
}
