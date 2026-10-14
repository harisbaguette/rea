export interface ImageAsset {
  file: File;
  url: string;
  width: number;
  height: number;
}

export const FILE_LIMIT = 8 * 1024 * 1024;
const PIXEL_LIMIT = 16_000_000;

function hasMagic(bytes: Uint8Array, type: string): boolean {
  if (type === 'image/png') return [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value);
  if (type === 'image/jpeg') return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (type === 'image/webp') {
    return String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
      && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  }
  return false;
}

export async function readImage(file: File): Promise<ImageAsset> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    throw new Error('PNG, JPG, WebP 사진만 선택할 수 있습니다.');
  }
  if (file.size === 0 || file.size > FILE_LIMIT) throw new Error('사진 한 장의 크기는 8MB 이하여야 합니다.');
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (!hasMagic(bytes, file.type)) throw new Error('사진 내용과 파일 형식이 다릅니다. 다른 사진을 선택해 주세요.');
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch { throw new Error('이 사진을 열 수 없습니다. 다른 사진을 선택해 주세요.'); }
  const { width, height } = bitmap;
  bitmap.close();
  if (width * height > PIXEL_LIMIT) throw new Error('사진은 1,600만 화소 이하여야 합니다. 크기를 줄여 주세요.');
  const clean = await reencode(file, width, height);
  return { file: clean, url: URL.createObjectURL(clean), width, height };
}

async function reencode(file: File, width: number, height: number): Promise<File> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
  bitmap.close();
  const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error('사진 변환에 실패했습니다.')), type, 0.92);
  });
  canvas.width = 0;
  canvas.height = 0;
  if (blob.size > FILE_LIMIT) throw new Error('사진 변환 후 크기가 8MB를 넘었습니다. 사진 크기를 줄여 주세요.');
  return new File([blob], type === 'image/png' ? 'photo.png' : 'photo.jpg', { type });
}

export function releaseAsset(asset: ImageAsset | null): void {
  if (asset) URL.revokeObjectURL(asset.url);
}

export async function snapshot(video: HTMLVideoElement): Promise<ImageAsset> {
  if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
    throw new Error('카메라 화면을 준비하고 있습니다. 잠시 뒤 촬영해 주세요.');
  }
  const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error('사진 촬영에 실패했습니다.')), 'image/png');
  });
  const width = canvas.width;
  const height = canvas.height;
  canvas.width = 0;
  canvas.height = 0;
  const file = new File([blob], 'camera.png', { type: 'image/png' });
  return { file, url: URL.createObjectURL(blob), width, height };
}

export function cameraError(error: unknown): string {
  if (error instanceof DOMException) {
    if (['NotAllowedError', 'PermissionDeniedError'].includes(error.name)) {
      return '카메라 권한이 꺼져 있습니다. 주소창의 사이트 권한에서 카메라를 허용하거나 사진을 선택해 주세요.';
    }
    if (['NotFoundError', 'DevicesNotFoundError'].includes(error.name)) return '연결된 카메라가 없습니다. 사진을 선택해 주세요.';
    if (['NotReadableError', 'TrackStartError'].includes(error.name)) return '다른 앱이 카메라를 사용 중입니다. 해당 앱을 닫고 다시 시도해 주세요.';
  }
  return error instanceof Error ? error.message : '카메라를 켤 수 없습니다. 사진을 선택해 주세요.';
}
