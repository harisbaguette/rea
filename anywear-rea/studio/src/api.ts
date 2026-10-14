export type Engine = 'fashn' | 'turbo';
export type JobStatus = 'queued' | 'loading' | 'running' | 'cancelling' | 'cancelled' | 'succeeded' | 'failed';

export interface Model {
  id: Engine;
  name: string;
  ready: boolean;
  reason: string | null;
  capability: 'snapshot' | 'live';
}

export interface Health {
  status: 'ok';
  api_version: '1';
  csrf_token: string;
  runtime: {
    device: 'cuda' | 'mps' | 'cpu' | 'none';
    gpu_name: string | null;
    vram_gb: number | null;
  };
  models: Model[];
  active_job_id: string | null;
}

export interface Job {
  id: string;
  status: JobStatus;
  stage: string;
  elapsed_ms: number;
  inference_ms: number | null;
  result_url: string | null;
  error: { code: string; message: string } | null;
}

const jobStatuses: readonly string[] = ['queued', 'loading', 'running', 'cancelling', 'cancelled', 'succeeded', 'failed'];
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const isTextOrNull = (value: unknown): value is string | null => value === null || typeof value === 'string';
const isNonnegative = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const isNumberOrNull = (value: unknown): value is number | null => value === null || isNonnegative(value);

function validModel(value: unknown): value is Model {
  return isRecord(value)
    && (value.id === 'fashn' || value.id === 'turbo')
    && typeof value.name === 'string'
    && typeof value.ready === 'boolean'
    && isTextOrNull(value.reason)
    && (value.capability === 'snapshot' || value.capability === 'live');
}

export function validHealth(value: unknown): value is Health {
  if (!isRecord(value) || !isRecord(value.runtime)) return false;
  return value.status === 'ok' && value.api_version === '1'
    && typeof value.csrf_token === 'string' && value.csrf_token.length > 0
    && ['cuda', 'mps', 'cpu', 'none'].includes(String(value.runtime.device))
    && isTextOrNull(value.runtime.gpu_name) && isNumberOrNull(value.runtime.vram_gb)
    && Array.isArray(value.models) && value.models.length > 0 && value.models.every(validModel)
    && new Set(value.models.map((model) => model.id)).size === value.models.length
    && isTextOrNull(value.active_job_id);
}

export function validJob(value: unknown): value is Job {
  return isRecord(value) && typeof value.id === 'string'
    && /^[a-zA-Z0-9_-]{1,128}$/.test(value.id)
    && typeof value.status === 'string' && jobStatuses.includes(value.status)
    && typeof value.stage === 'string'
    && isNonnegative(value.elapsed_ms) && isNumberOrNull(value.inference_ms)
    && isTextOrNull(value.result_url)
    && (value.error === null || (isRecord(value.error)
      && typeof value.error.code === 'string' && typeof value.error.message === 'string'));
}

export class ApiError extends Error {
  constructor(public code: string, message: string, public status = 0) {
    super(message);
    this.name = 'ApiError';
  }
}

export function explainError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof DOMException && error.name === 'AbortError') return '작업을 취소했습니다.';
  return '연결이 끊겼습니다. 입력은 그대로 있으니 연결을 확인한 뒤 다시 시도해 주세요.';
}

async function timedRequest<T>(
  path: string, init: RequestInit, timeoutMs: number, consume: (response: Response) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort(init.signal?.reason);
  if (init.signal?.aborted) abort();
  else init.signal?.addEventListener('abort', abort, { once: true });
  let timedOut = false;
  const timer = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    const response = await fetch(path, {
      ...init, signal: controller.signal, credentials: 'same-origin', cache: 'no-store', redirect: 'error',
    });
    const result = await consume(response);
    if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
    return result;
  } catch (error) {
    if (timedOut) throw new ApiError('timeout', '서버 응답 시간이 초과되었습니다. 연결을 확인한 뒤 다시 시도해 주세요.');
    throw error;
  } finally {
    window.clearTimeout(timer);
    init.signal?.removeEventListener('abort', abort);
  }
}

async function jsonResponse(response: Response): Promise<unknown> {
  let data: unknown;
  try { data = await response.json(); }
  catch { throw new ApiError('invalid_response', '서버 응답 형식이 맞지 않습니다. API 버전을 확인해 주세요.', response.status); }
  if (!response.ok) {
    const code = isRecord(data) && isRecord(data.error) && typeof data.error.code === 'string'
      ? data.error.code : 'request_failed';
    const messages: Record<number, string> = {
      403: '연결 인증이 만료되었습니다. 다시 연결한 뒤 시도해 주세요.',
      404: '작업을 찾을 수 없습니다. 새 작업으로 다시 시작해 주세요.',
      422: '사진이나 설정을 처리할 수 없습니다. 입력 조건을 확인해 주세요.',
      429: '다른 작업이 진행 중입니다. 잠시 뒤 다시 시도해 주세요.',
      503: '추론 엔진이 아직 준비되지 않았습니다. Windows에서 엔진을 실행한 뒤 다시 연결해 주세요.',
    };
    const detail = isRecord(data) && isRecord(data.error) && typeof data.error.message === 'string'
      ? data.error.message.slice(0, 240) : '';
    const message = messages[response.status] || '요청을 처리하지 못했습니다. 입력을 유지했으니 다시 시도해 주세요.';
    throw new ApiError(code, detail && response.status === 422 ? `${message} ${detail}` : message, response.status);
  }
  return data;
}

export function safeResultPath(job: Job): string {
  const expected = `/api/jobs/${encodeURIComponent(job.id)}/image`;
  if (job.result_url !== expected) {
    throw new ApiError('unsafe_result', '안전한 결과 이미지 주소가 아닙니다. 추론 서버 설정을 확인해 주세요.');
  }
  return expected;
}

export class StudioApi {
  private csrfToken: string | null = null;

  async health(signal?: AbortSignal): Promise<Health> {
    this.csrfToken = null;
    const value = await timedRequest('/api/health', { signal }, 5_000, jsonResponse);
    if (!validHealth(value)) throw new ApiError('invalid_health', '연결할 API의 버전이나 응답 형식이 맞지 않습니다.');
    this.csrfToken = value.csrf_token;
    return value;
  }

  private headers(): HeadersInit {
    if (!this.csrfToken) throw new ApiError('not_connected', '추론 서버에 먼저 연결해 주세요.');
    return { 'X-Local-Token': this.csrfToken };
  }

  async create(data: FormData, signal: AbortSignal): Promise<Job> {
    return timedRequest('/api/jobs', {
      method: 'POST', body: data, headers: this.headers(), signal,
    }, 15_000, async (response) => {
      if (response.ok && response.status !== 202) throw new ApiError('invalid_status', '작업 접수 응답이 API 규격과 다릅니다.');
      return this.jobResponse(response);
    });
  }

  async get(id: string, signal: AbortSignal): Promise<Job> {
    return timedRequest(`/api/jobs/${encodeURIComponent(id)}`, { signal }, 10_000,
      (response) => this.jobResponse(response, id));
  }

  async cancel(id: string, signal?: AbortSignal): Promise<Job> {
    return timedRequest(`/api/jobs/${encodeURIComponent(id)}`, {
      method: 'DELETE', headers: this.headers(), signal,
    }, 10_000, (response) => this.jobResponse(response, id));
  }

  async image(job: Job, signal: AbortSignal): Promise<Blob> {
    return timedRequest(safeResultPath(job), { signal }, 15_000, async (response) => {
      if (!response.ok) {
        await jsonResponse(response);
        throw new ApiError('missing_result', '결과 이미지를 불러오지 못했습니다. 다시 시도해 주세요.');
      }
      const contentType = response.headers.get('content-type')?.split(';')[0]?.trim();
      if (contentType !== 'image/png') throw new ApiError('invalid_image', '결과 이미지가 PNG 형식이 아닙니다.');
      const blob = await response.blob();
      if (blob.size === 0 || blob.size > 32 * 1024 * 1024) throw new ApiError('invalid_image', '결과 이미지 크기가 올바르지 않습니다.');
    const signature = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
    const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
    if (signature.length !== pngSignature.length || !pngSignature.every((byte, index) => signature[index] === byte)) {
      throw new ApiError('invalid_image', '결과 이미지가 올바른 PNG 파일이 아닙니다.');
    }
      let bitmap: ImageBitmap;
      try { bitmap = await createImageBitmap(blob); }
      catch { throw new ApiError('invalid_image', '결과 이미지가 손상되어 열 수 없습니다.'); }
      const valid = bitmap.width * bitmap.height <= 16_000_000;
      bitmap.close();
      if (!valid) throw new ApiError('invalid_image', '결과 이미지 해상도가 허용 범위를 넘었습니다.');
      return blob;
    });
  }

  private async jobResponse(response: Response, expectedId?: string): Promise<Job> {
    const value = await jsonResponse(response);
    if (!validJob(value) || (expectedId !== undefined && value.id !== expectedId)) {
      throw new ApiError('invalid_job', '작업 응답 형식이 맞지 않습니다. API 버전을 확인해 주세요.');
    }
    return value;
  }
}
