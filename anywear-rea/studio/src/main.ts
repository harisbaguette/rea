import './styles.css';
import { ApiError, StudioApi, explainError } from './api';
import type { Engine, Health, Job } from './api';
import { cameraError, readImage, releaseAsset, snapshot } from './media';
import type { ImageAsset } from './media';
import { template } from './ui';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = template;
function element<T extends HTMLElement = HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}
const button = (id: string) => element<HTMLButtonElement>(id);
const show = (id: string, visible: boolean) => { element(id).hidden = !visible; };
const text = (id: string, value: string) => { element(id).textContent = value; };
const video = element<HTMLVideoElement>('camera-video');
const api = new StudioApi();
type Mode = 'snapshot' | 'live';
type Slot = 'person' | 'garment';
let mode: Mode = 'snapshot';
let health: Health | null = null;
let connecting = false;
let healthEpoch = 0;
let healthController: AbortController | null = null;
let person: ImageAsset | null = null;
let garment: ImageAsset | null = null;
let personVersion = 0;
let garmentVersion = 0;
let stream: MediaStream | null = null;
let cameraPending = false;
let cameraEpoch = 0;
let capturePending = false;
let requestEpoch = 0;
let requestController: AbortController | null = null;
let activeId: string | null = null;
let busy = false;
let liveRunning = false;
let submitting = false;
let cancelling = false;
let resultUrl: string | null = null;
let resultOriginal: ImageAsset | null = null;
let resultBlob: Blob | null = null;
let comparingOriginal = false;
let progressTimer: number | undefined;

function currentEngine(): Engine { return mode === 'snapshot' ? 'fashn' : 'turbo'; }
function currentModel() {
  return health?.models.find((model) => model.id === currentEngine() && model.capability === mode);
}

function setMessage(value: string, error = false): void {
  text('status-message', value);
  element('status-message').classList.toggle('error', error);
  element('status-message').setAttribute('role', error ? 'alert' : 'status');
  show('status-message', Boolean(value));
}

function update(): void {
  const model = currentModel();
  const ready = Boolean(health && model?.ready);
  for (const next of ['snapshot', 'live']) {
    element(`mode-${next}`).classList.toggle('active', mode === next);
    button(`mode-${next}`).setAttribute('aria-pressed', String(mode === next));
  }
  text('mode-hint', mode === 'snapshot' ? '인물 사진 + 의상 사진' : '카메라 + 스타일 문장');
  text('garment-info', mode === 'snapshot' ? '의상 사진' : '라이브에서는 사용 안 함');
  element('garment-drop').classList.toggle('inactive-slot', mode === 'live');
  text('garment-note', mode === 'snapshot' ? '옷 전체가 보이는 사진이 좋아요.' : '라이브는 스타일 문장으로 변경해요.');
  show('snapshot-settings', mode === 'snapshot');
  show('live-settings', mode === 'live');
  show('person-empty', !person && !stream);
  show('person-preview', Boolean(person) && !stream);
  if (person) element<HTMLImageElement>('person-preview').src = person.url;
  show('person-edit', Boolean(person) && !stream);
  text('person-info', stream ? '카메라' : person ? `${person.width} × ${person.height}` : '인물 사진');
  show('camera-video', Boolean(stream));
  show('camera-indicator', Boolean(stream));
  show('camera-start', !stream);
  button('camera-start').disabled = cameraPending;
  text('camera-label', cameraPending ? '카메라 준비 중' : '카메라 켜기');
  show('camera-actions', Boolean(stream));
  button('camera-capture').disabled = capturePending || liveRunning;
  show('garment-empty', !garment);
  show('garment-preview', Boolean(garment));
  if (garment) element<HTMLImageElement>('garment-preview').src = garment.url;
  show('garment-edit', Boolean(garment));
  for (const id of ['garment-input', 'garment-choose', 'garment-replace', 'garment-remove']) {
    (element(id) as HTMLInputElement | HTMLButtonElement).disabled = mode === 'live';
  }
  const prompt = element<HTMLTextAreaElement>('prompt').value.trim();
  const validInputs = mode === 'snapshot'
    ? Boolean(person && garment && !stream)
    : Boolean(stream && prompt.length > 0 && prompt.length <= 500);
  const serverBusy = Boolean(health?.active_job_id && health.active_job_id !== activeId);
  button('generate').disabled = !ready || !validInputs || busy || submitting || cancelling || serverBusy;
  text('generate-label', mode === 'snapshot' ? '피팅 이미지 만들기' : '라이브 시작');
  show('cancel-job', busy);
  text('cancel-job', mode === 'live' ? '라이브 중지' : '작업 취소');
  button('reconnect').disabled = connecting || busy || submitting || cancelling;
  text('reconnect', connecting ? '확인 중' : '다시 연결');
  element('connection').classList.toggle('connected', Boolean(health));
  element('connection').classList.toggle('checking', connecting);
  text('connection-label', connecting ? '연결 확인 중' : health ? '로컬 서버 연결됨' : '엔진 미연결');
  text('engine-name', model?.name || (mode === 'snapshot' ? '사진 피팅 엔진' : '라이브 스타일 엔진'));
  element('engine-status').classList.toggle('ready', ready);
  text('engine-description', ready ? '사진을 준비하면 생성할 수 있어요.'
    : model?.reason || 'Windows 추론 엔진 연결 후 사용할 수 있어요.');
  show('runtime-label', Boolean(health));
  if (health) text('runtime-label', health.runtime.gpu_name || `실행 장치: ${health.runtime.device}`);
  text('footer-state', health ? ready ? '로컬 추론 서버 연결됨' : '서버 연결됨 · 모델 준비 필요' : '공통 작업 화면 · 엔진 미연결');
  const hint = cancelling || submitting && !busy ? '이전 요청을 정리하고 있어요.'
    : busy ? '입력은 그대로 유지됩니다.'
    : !health ? '엔진 연결을 기다리고 있어요.'
    : !ready ? '선택한 모드의 모델을 준비해 주세요.'
    : serverBusy ? '서버의 다른 작업이 끝나면 다시 연결해 주세요.'
    : mode === 'snapshot' && stream ? '카메라 화면을 사진으로 촬영해 주세요.'
    : !validInputs ? mode === 'snapshot' ? '내 모습과 입어볼 옷을 선택해 주세요.' : '카메라를 켜고 스타일을 적어 주세요.'
    : mode === 'snapshot' ? '선택한 사진으로 피팅 이미지를 만듭니다.' : '한 장씩 처리하며 결과를 갱신합니다.';
  text('action-hint', hint);
  element('result-panel').setAttribute('aria-busy', String(busy));
  show('progress-layer', busy && (mode === 'snapshot' || !resultUrl));
  show('result-empty', !resultUrl);
  show('result-image', Boolean(resultUrl));
  show('result-tools', Boolean(resultUrl));
  if (resultUrl) {
    const image = element<HTMLImageElement>('result-image');
    image.src = comparingOriginal && resultOriginal ? resultOriginal.url : resultUrl;
    image.alt = comparingOriginal ? '생성에 사용한 원본 인물 사진' : 'AI가 생성한 피팅 결과';
  }
  button('result-original').setAttribute('aria-pressed', String(comparingOriginal));
  button('result-generated').setAttribute('aria-pressed', String(!comparingOriginal));
  text('result-tag', busy ? liveRunning ? '라이브 처리 중' : '만드는 중' : resultUrl ? '생성 완료' : '아직 생성 전');
}

async function connect(): Promise<void> {
  if (busy || submitting || cancelling) return;
  const epoch = ++healthEpoch;
  healthController?.abort();
  const controller = new AbortController();
  healthController = controller;
  connecting = true;
  health = null;
  update();
  try {
    const nextHealth = await api.health(controller.signal);
    if (epoch !== healthEpoch) return;
    health = nextHealth;
    setMessage('');
  } catch (error) {
    if (epoch !== healthEpoch) return;
    health = null;
    setMessage(error instanceof ApiError && error.code === 'invalid_health'
      ? explainError(error)
      : '추론 서버에 연결되지 않았어요. Windows에서 서버를 켠 뒤 다시 연결해 주세요.', true);
  } finally {
    if (epoch === healthEpoch) { connecting = false; update(); }
  }
}

function clearResult(): void {
  if (resultUrl) URL.revokeObjectURL(resultUrl);
  releaseAsset(resultOriginal);
  resultUrl = null;
  resultBlob = null;
  resultOriginal = null;
  comparingOriginal = false;
  element<HTMLImageElement>('result-image').removeAttribute('src');
  show('result-meta', false);
}

function stopCamera(): void {
  ++cameraEpoch;
  stream?.getTracks().forEach((track) => track.stop());
  stream = null;
  video.srcObject = null;
  cameraPending = false;
  update();
}

async function cancelRemote(id: string, announce = false): Promise<void> {
  const epoch = requestEpoch;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 30_000);
  cancelling = true;
  if (health) health.active_job_id = id;
  update();
  try {
    let stopped = await api.cancel(id, controller.signal);
    while (!['cancelled', 'succeeded', 'failed'].includes(stopped.status)) {
      await delay(350, controller.signal);
      stopped = await api.get(id, controller.signal);
    }
    if (health?.active_job_id === id) health.active_job_id = null;
    if (announce && epoch === requestEpoch) {
      setMessage(stopped.status === 'cancelled'
        ? '서버에서 작업 중지를 확인했습니다. 선택한 사진과 마지막 결과는 그대로 있어요.'
        : '서버 작업이 끝났습니다. 선택한 사진으로 다시 시작할 수 있어요.');
    }
  } catch {
    setMessage('서버의 작업 종료를 확인하지 못했습니다. 다시 연결해 상태를 확인해 주세요.', true);
    if (health) health.active_job_id = id;
  } finally {
    window.clearTimeout(timeout);
    cancelling = false;
    update();
  }
}

function invalidateJob(announce = false): void {
  ++requestEpoch;
  const wasLive = liveRunning;
  liveRunning = false;
  busy = false;
  // A pending POST must return its job id so a late response can be cancelled.
  if (!submitting) requestController?.abort();
  const id = activeId;
  activeId = null;
  window.clearInterval(progressTimer);
  if (announce) setMessage('중지를 요청했습니다. 선택한 사진과 마지막 결과는 그대로 있어요.');
  if (wasLive) stopCamera();
  if (id) void cancelRemote(id, announce);
  update();
}

async function chooseFile(slot: Slot, file: File | undefined): Promise<void> {
  if (!file || (slot === 'garment' && mode === 'live')) return;
  const version = slot === 'person' ? ++personVersion : ++garmentVersion;
  text(`${slot}-error`, '');
  show(`${slot}-error`, false);
  element<HTMLInputElement>(`${slot}-input`).removeAttribute('aria-invalid');
  try {
    const asset = await readImage(file);
    if (version !== (slot === 'person' ? personVersion : garmentVersion)) { releaseAsset(asset); return; }
    invalidateJob();
    if (slot === 'person') { stopCamera(); releaseAsset(person); person = asset; }
    else { releaseAsset(garment); garment = asset; }
    clearResult();
    setMessage('');
    update();
  } catch (error) {
    if (version !== (slot === 'person' ? personVersion : garmentVersion)) return;
    text(`${slot}-error`, error instanceof Error ? error.message : '사진을 열 수 없습니다.');
    show(`${slot}-error`, true);
    element<HTMLInputElement>(`${slot}-input`).setAttribute('aria-invalid', 'true');
  } finally { element<HTMLInputElement>(`${slot}-input`).value = ''; }
}

async function startCamera(): Promise<void> {
  if (cameraPending || stream) return;
  if (!navigator.mediaDevices?.getUserMedia) {
    text('person-error', '이 환경에서는 카메라를 사용할 수 없습니다. localhost 또는 HTTPS에서 열거나 사진을 선택해 주세요.');
    show('person-error', true);
    return;
  }
  ++personVersion;
  const epoch = ++cameraEpoch;
  cameraPending = true;
  show('person-error', false);
  update();
  try {
    const acquired = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }, audio: false,
    });
    if (epoch !== cameraEpoch) { acquired.getTracks().forEach((track) => track.stop()); return; }
    invalidateJob();
    stream = acquired;
    video.srcObject = stream;
    await video.play();
    acquired.getVideoTracks().forEach((track) => track.addEventListener('ended', () => {
      if (stream === acquired) {
        invalidateJob(); stopCamera();
        setMessage('카메라 연결이 종료되었습니다. 다시 켜거나 사진을 선택해 주세요.', true);
      }
    }));
  } catch (error) {
    if (epoch !== cameraEpoch) return;
    stopCamera();
    text('person-error', cameraError(error));
    show('person-error', true);
  } finally { if (epoch === cameraEpoch) cameraPending = false; update(); }
}

async function capture(): Promise<void> {
  if (capturePending || liveRunning) return;
  const epoch = cameraEpoch;
  capturePending = true;
  update();
  try {
    const asset = await snapshot(video);
    if (epoch !== cameraEpoch) { releaseAsset(asset); return; }
    ++personVersion;
    invalidateJob();
    releaseAsset(person);
    person = asset;
    stopCamera();
    clearResult();
    setMessage('사진을 촬영했습니다.');
  } catch (error) {
    if (epoch !== cameraEpoch) return;
    text('person-error', cameraError(error));
    show('person-error', true);
  } finally { capturePending = false; update(); }
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('Aborted', 'AbortError')); return; }
    const abort = () => { window.clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
    const timer = window.setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
    signal.addEventListener('abort', abort, { once: true });
  });
}

function progress(job: Job): void {
  const stages: Record<string, string> = {
    queued: '작업 순서를 기다리고 있어요', loading: '모델을 준비하고 있어요', running: '스타일을 입히고 있어요',
    cancelling: '서버에서 작업을 취소하고 있어요', succeeded: '결과를 불러오고 있어요',
  };
  text('progress-stage', stages[job.status] || '작업을 처리하고 있어요');
}

async function runJob(input: ImageAsset, epoch: number, controller: AbortController): Promise<Job> {
  const data = new FormData();
  data.append('engine', currentEngine());
  data.append('person', input.file);
  data.append('seed', '42');
  if (mode === 'snapshot') {
    if (!garment) throw new ApiError('missing_garment', '의상 사진을 선택해 주세요.');
    data.append('garment', garment.file);
    data.append('category', document.querySelector<HTMLInputElement>('input[name="category"]:checked')!.value);
    data.append('garment_photo_type', document.querySelector<HTMLInputElement>('input[name="garment_photo_type"]:checked')!.value);
    data.append('steps', '30');
  } else {
    data.append('prompt', element<HTMLTextAreaElement>('prompt').value.trim());
    data.append('steps', '2');
    data.append('strength', '0.5');
  }
  submitting = true;
  let job: Job;
  try { job = await api.create(data, controller.signal); }
  finally { submitting = false; update(); }
  if (epoch !== requestEpoch) { void cancelRemote(job.id); throw new DOMException('Aborted', 'AbortError'); }
  activeId = job.id;
  const started = performance.now();
  let inferenceStarted: number | null = null;
  while (!['succeeded', 'failed', 'cancelled'].includes(job.status)) {
    if (epoch !== requestEpoch) throw new DOMException('Aborted', 'AbortError');
    progress(job);
    if (job.status === 'running' && inferenceStarted === null) inferenceStarted = performance.now();
    const timedOut = inferenceStarted === null
      ? performance.now() - started > 120_000
      : performance.now() - inferenceStarted > 300_000;
    if (timedOut) throw new ApiError('inference_timeout', inferenceStarted === null
      ? '모델 준비가 2분을 넘겨 작업을 중지했습니다. 엔진 상태를 확인한 뒤 다시 시도해 주세요.'
      : '생성이 5분을 넘겨 작업을 중지했습니다. 사진 크기와 GPU 상태를 확인해 주세요.');
    await delay(650, controller.signal);
    job = await api.get(job.id, controller.signal);
  }
  activeId = null;
  if (health) health.active_job_id = null;
  if (job.status === 'failed') throw new ApiError(job.error?.code || 'inference_failed',
    job.error?.message ? `생성하지 못했습니다. ${job.error.message.slice(0, 240)}` : '생성하지 못했습니다. 입력은 그대로 있으니 다시 시도해 주세요.');
  if (job.status === 'cancelled') throw new ApiError('cancelled', '서버에서 작업을 취소했습니다. 입력은 그대로 있어요.');
  progress(job);
  const blob = await api.image(job, controller.signal);
  if (epoch !== requestEpoch) throw new DOMException('Aborted', 'AbortError');
  const original = { ...input, url: URL.createObjectURL(input.file) };
  clearResult();
  resultBlob = blob;
  resultUrl = URL.createObjectURL(blob);
  resultOriginal = original;
  text('result-meta', job.inference_ms === null ? '추론 서버가 생성한 이미지' : `추론 시간 ${(job.inference_ms / 1000).toFixed(1)}초`);
  show('result-meta', true);
  update();
  return job;
}

async function generate(): Promise<void> {
  if (button('generate').disabled) return;
  const epoch = ++requestEpoch;
  const controller = new AbortController();
  requestController = controller;
  busy = true;
  liveRunning = mode === 'live';
  const started = performance.now();
  text('progress-stage', '작업 요청 중');
  text('progress-time', '0초');
  setMessage('');
  progressTimer = window.setInterval(() => text('progress-time', `${Math.floor((performance.now() - started) / 1000)}초`), 1000);
  update();
  try {
    if (mode === 'snapshot') {
      if (!person) return;
      await runJob(person, epoch, controller);
      if (epoch === requestEpoch) setMessage('피팅 이미지가 완성됐어요. 원본과 비교하거나 저장할 수 있습니다.');
    } else {
      while (liveRunning && epoch === requestEpoch && stream) {
        const frame = await snapshot(video);
        try { await runJob(frame, epoch, controller); }
        finally { releaseAsset(frame); }
        if (epoch === requestEpoch) await delay(100, controller.signal);
      }
    }
  } catch (error) {
    if (epoch === requestEpoch) {
      if (activeId) { const id = activeId; activeId = null; void cancelRemote(id); }
      if (!(error instanceof ApiError) || ['timeout', 'invalid_job', 'invalid_status'].includes(error.code)
        || [403, 429, 503].includes(error.status)) health = null;
      setMessage(explainError(error), true);
      if (mode === 'live') stopCamera();
    }
  } finally {
    if (epoch === requestEpoch) {
      busy = false;
      liveRunning = false;
      window.clearInterval(progressTimer);
      update();
    }
  }
}

function changeMode(next: Mode): void {
  if (next === mode) return;
  ++garmentVersion;
  invalidateJob();
  mode = next;
  setMessage('');
  update();
}

for (const slot of ['person', 'garment'] as const) {
  const input = element<HTMLInputElement>(`${slot}-input`);
  for (const action of ['choose', 'replace']) button(`${slot}-${action}`).addEventListener('click', () => input.click());
  input.addEventListener('change', () => void chooseFile(slot, input.files?.[0]));
  button(`${slot}-remove`).addEventListener('click', () => {
    if (slot === 'person') { ++personVersion; releaseAsset(person); person = null; }
    else { ++garmentVersion; releaseAsset(garment); garment = null; }
    invalidateJob(); clearResult(); show(`${slot}-error`, false); setMessage(''); update();
    button(`${slot}-choose`).focus();
  });
  const drop = element(`${slot}-drop`);
  for (const name of ['dragenter', 'dragover']) drop.addEventListener(name, (event) => {
    event.preventDefault();
    if (!(slot === 'garment' && mode === 'live')) drop.classList.add('drag-over');
  });
  for (const name of ['dragleave', 'drop']) drop.addEventListener(name, () => drop.classList.remove('drag-over'));
  drop.addEventListener('drop', (event) => {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (files && files.length > 1) { text(`${slot}-error`, '사진은 한 장씩 선택해 주세요.'); show(`${slot}-error`, true); return; }
    void chooseFile(slot, files?.[0]);
  });
}
button('camera-start').addEventListener('click', () => void startCamera());
button('camera-capture').addEventListener('click', () => void capture());
button('camera-stop').addEventListener('click', () => {
  if (liveRunning) invalidateJob(true);
  stopCamera(); button('camera-start').focus();
});
button('reconnect').addEventListener('click', () => void connect());
button('mode-snapshot').addEventListener('click', () => changeMode('snapshot'));
button('mode-live').addEventListener('click', () => changeMode('live'));
button('generate').addEventListener('click', () => void generate());
button('cancel-job').addEventListener('click', () => invalidateJob(true));
const prompts: Record<string, string> = {
  denim: '클래식 데님 재킷을 입은 사람, 자연광, 사실적인 사진',
  hair: '짧은 단발머리로 바꾸기, 얼굴 특징 유지, 자연광, 사실적인 사진',
  background: '평온한 바닷가 배경으로 바꾸기, 인물 유지, 자연광, 사실적인 사진',
};
document.querySelectorAll<HTMLButtonElement>('[data-prompt]').forEach((example) => {
  example.addEventListener('click', () => {
    invalidateJob(); element<HTMLTextAreaElement>('prompt').value = prompts[example.dataset.prompt!]!;
    setMessage(''); update();
  });
});
element('prompt').addEventListener('input', () => { if (busy) invalidateJob(); update(); });
for (const name of ['category', 'garment_photo_type']) {
  document.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`).forEach((input) => {
    input.addEventListener('change', () => { invalidateJob(); clearResult(); setMessage(''); update(); });
  });
}
button('result-original').addEventListener('click', () => { comparingOriginal = true; update(); });
button('result-generated').addEventListener('click', () => { comparingOriginal = false; update(); });
button('result-download').addEventListener('click', () => {
  if (!resultBlob) return;
  const url = URL.createObjectURL(resultBlob);
  const link = document.createElement('a');
  link.href = url; link.download = 'ibeobom-fitting.png';
  document.body.append(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
});
button('reset').addEventListener('click', () => {
  ++personVersion; ++garmentVersion;
  invalidateJob(); stopCamera(); releaseAsset(person); releaseAsset(garment);
  person = null; garment = null; clearResult();
  for (const slot of ['person', 'garment']) {
    element<HTMLImageElement>(`${slot}-preview`).removeAttribute('src');
    show(`${slot}-error`, false);
    element<HTMLInputElement>(`${slot}-input`).removeAttribute('aria-invalid');
  }
  setMessage('새 작업을 시작합니다. 사진과 결과를 비웠어요.'); update();
  button('person-choose').focus();
});
window.addEventListener('pagehide', () => {
  invalidateJob(); stopCamera(); healthController?.abort();
  releaseAsset(person); releaseAsset(garment); clearResult();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && (busy || stream || cameraPending)) { invalidateJob(true); stopCamera(); }
});
update();
void connect();
