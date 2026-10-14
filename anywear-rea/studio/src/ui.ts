export const template = `
  <a class="skip-link" href="#workspace">작업실로 건너뛰기</a>
  <header class="site-header">
    <a class="brand" href="./" aria-label="입어봄 작업실 처음으로">
      <span class="brand-symbol" aria-hidden="true">입</span>
      <span class="brand-name">입어봄<span class="brand-caption">LOCAL STUDIO</span></span>
    </a>
    <div class="connection-group">
      <span class="connection" data-testid="connection-status" id="connection" role="status">
        <span class="status-dot" aria-hidden="true"></span><span id="connection-label">연결 확인 중</span>
      </span>
      <button class="text-button" id="reconnect" data-testid="reconnect">다시 연결</button>
    </div>
  </header>
  <main id="workspace" tabindex="-1">
    <div class="page-heading">
      <div><p class="eyebrow">나만의 피팅 작업실</p><h1>다음 스타일을<br class="mobile-break" /> 입어보세요.</h1></div>
      <button class="text-button reset-button" id="reset" data-testid="reset">새 작업</button>
    </div>
    <div class="mode-bar">
      <div class="mode-switch" role="group" aria-label="작업 모드">
        <button class="mode active" id="mode-snapshot" data-testid="mode-snapshot" aria-pressed="true">사진 피팅</button>
        <button class="mode" id="mode-live" data-testid="mode-live" aria-pressed="false">라이브 스타일 <span class="experiment">실험</span></button>
      </div>
      <p class="mode-hint" id="mode-hint">인물 사진 + 의상 사진</p>
    </div>
    <div class="workbench">
      <section class="canvas" aria-label="피팅 이미지 작업 영역">
        <div class="input-row">
          <section class="input-panel" aria-labelledby="person-title">
            <div class="panel-heading"><h2 id="person-title">내 모습</h2><span class="panel-caption" id="person-info">인물 사진</span></div>
            <div class="drop-zone person-zone" id="person-drop" data-testid="person-drop">
              <div class="upload-empty" id="person-empty">
                <div class="person-outline" aria-hidden="true"><span class="person-head"></span><span class="person-shoulders"></span></div>
                <p>어떤 모습에 입어볼까요?</p>
                <button class="secondary-button" id="person-choose">인물 사진 선택</button>
                <span class="drop-hint">또는 사진을 여기로 끌어놓기</span>
              </div>
              <img id="person-preview" data-testid="person-preview" class="input-preview" alt="선택한 인물 사진" hidden />
              <video id="camera-video" class="input-preview camera-video" autoplay playsinline muted aria-label="내 카메라 미리보기" hidden></video>
              <span class="camera-indicator" id="camera-indicator" hidden><span class="status-dot" aria-hidden="true"></span>카메라 사용 중</span>
            </div>
            <input id="person-input" data-testid="person-input" class="file-input" type="file" tabindex="-1" accept="image/png,image/jpeg,image/webp" aria-label="인물 사진 선택" aria-describedby="file-rules person-error" />
            <div class="input-actions">
              <div id="person-edit" class="edit-actions" hidden>
                <button class="text-button" id="person-replace">사진 교체</button>
                <button class="text-button" id="person-remove">사진 제거</button>
              </div>
              <button class="camera-button" id="camera-start" data-testid="camera-start"><img src="/assets/camera.svg" alt="" /><span id="camera-label">카메라 켜기</span></button>
              <div class="camera-actions" id="camera-actions" hidden>
                <button class="secondary-button" id="camera-capture" data-testid="camera-capture">사진 촬영</button>
                <button class="text-button" id="camera-stop" data-testid="camera-stop">카메라 끄기</button>
              </div>
            </div>
            <p id="person-error" data-testid="person-error" class="field-error" role="alert" hidden></p>
          </section>
          <div class="combine-sign" aria-hidden="true">+</div>
          <section class="input-panel" aria-labelledby="garment-title">
            <div class="panel-heading"><h2 id="garment-title">입어볼 옷</h2><span class="panel-caption" id="garment-info">의상 사진</span></div>
            <div class="drop-zone garment-zone" id="garment-drop" data-testid="garment-drop">
              <div class="upload-empty" id="garment-empty">
                <img class="garment-icon" src="/assets/shirt.svg" alt="" />
                <p>마음에 드는 옷 한 벌</p>
                <button class="secondary-button" id="garment-choose">의상 사진 선택</button>
                <span class="drop-hint">또는 사진을 여기로 끌어놓기</span>
              </div>
              <img id="garment-preview" data-testid="garment-preview" class="input-preview" alt="선택한 의상 사진" hidden />
            </div>
            <input id="garment-input" data-testid="garment-input" class="file-input" type="file" tabindex="-1" accept="image/png,image/jpeg,image/webp" aria-label="의상 사진 선택" aria-describedby="file-rules garment-error" />
            <div class="input-actions">
              <div id="garment-edit" class="edit-actions" hidden>
                <button class="text-button" id="garment-replace">사진 교체</button>
                <button class="text-button" id="garment-remove">사진 제거</button>
              </div>
              <span class="garment-note" id="garment-note">옷 전체가 보이는 사진이 좋아요.</span>
            </div>
            <p id="garment-error" data-testid="garment-error" class="field-error" role="alert" hidden></p>
          </section>
        </div>
        <section class="result-panel" aria-labelledby="result-title" aria-busy="false" id="result-panel">
          <div class="result-heading">
            <div class="result-title-group"><h2 id="result-title">피팅 결과</h2><span class="result-tag" id="result-tag">아직 생성 전</span></div>
            <div class="result-tools" id="result-tools" hidden>
              <div class="compare-switch" role="group" aria-label="결과 비교">
                <button id="result-original" data-testid="result-original" aria-pressed="false">원본</button>
                <button id="result-generated" data-testid="result-generated" aria-pressed="true">결과</button>
              </div>
              <button class="text-button" id="result-download" data-testid="result-download">이미지 저장 ↓</button>
            </div>
          </div>
          <div class="result-stage" id="result-stage">
            <div class="result-empty" id="result-empty">
              <div class="result-mark" aria-hidden="true"><span></span><span></span><span></span><span></span><img src="/assets/shirt.svg" alt="" /></div>
              <h3>이곳에서 새로운 나를 만나요.</h3>
              <p id="result-empty-hint">사진을 준비한 뒤 피팅 이미지를 만들어 보세요.</p>
            </div>
            <img class="result-image" id="result-image" data-testid="result-image" alt="AI가 생성한 피팅 결과" hidden />
            <div class="progress-layer" id="progress-layer" hidden>
              <span class="progress-spinner" aria-hidden="true"></span>
              <strong id="progress-stage">작업 요청 중</strong>
              <span id="progress-time">0초</span>
            </div>
          </div>
          <p class="result-meta" id="result-meta" hidden></p>
        </section>
        <div class="canvas-footnote"><span id="file-rules">PNG · JPG · WebP / 최대 8MB · 1,600만 화소</span><span>사진은 새로고침하면 사라집니다.</span></div>
      </section>
      <aside class="settings" aria-labelledby="settings-title">
        <div class="settings-heading"><h2 id="settings-title">피팅 설정</h2><span class="settings-line" aria-hidden="true"></span></div>
        <div id="snapshot-settings">
          <fieldset class="setting-field"><legend>의상 종류</legend>
            <div class="segmented-options" id="category" data-testid="category">
              <label><input type="radio" name="category" value="tops" checked /><span>상의</span></label>
              <label><input type="radio" name="category" value="bottoms" /><span>하의</span></label>
              <label><input type="radio" name="category" value="one-pieces" /><span>원피스</span></label>
            </div>
          </fieldset>
          <fieldset class="setting-field"><legend>의상 사진 형태</legend>
            <div class="photo-type-options" id="garment-photo-type" data-testid="garment-photo-type">
              <label><input type="radio" name="garment_photo_type" value="flat-lay" checked /><span><img src="/assets/shirt.svg" alt="" /><strong>옷만 있는 사진</strong></span></label>
              <label><input type="radio" name="garment_photo_type" value="model" /><span><span class="small-person" aria-hidden="true"></span><strong>사람이 입은 사진</strong></span></label>
            </div>
          </fieldset>
        </div>
        <div id="live-settings" hidden>
          <div class="live-notice">프레임마다 스타일을 바꾸는 실험 모드예요. 움직일 때 얼굴이나 옷이 달라질 수 있습니다.</div>
          <div class="setting-field"><label class="field-label" for="prompt">어떤 스타일로 바꿀까요?</label>
            <textarea id="prompt" data-testid="prompt" rows="4" maxlength="500" spellcheck="false">클래식 데님 재킷을 입은 사람, 자연광, 사실적인 사진</textarea>
            <div class="prompt-examples" role="group" aria-label="스타일 예시">
              <button class="example-button" data-prompt="denim">데님 재킷</button>
              <button class="example-button" data-prompt="hair">짧은 머리</button>
              <button class="example-button" data-prompt="background">바닷가 배경</button>
            </div>
          </div>
        </div>
        <div class="engine-status" id="engine-status">
          <div class="engine-heading"><span class="engine-dot" aria-hidden="true"></span><strong id="engine-name">사진 피팅 엔진</strong></div>
          <p id="engine-description">Windows 추론 엔진 연결 후 사용할 수 있어요.</p>
          <span id="runtime-label" hidden></span>
        </div>
        <div class="action-area">
          <button class="primary-button" id="generate" data-testid="generate" disabled><span id="generate-label">피팅 이미지 만들기</span><span aria-hidden="true">↗</span></button>
          <button class="cancel-button" id="cancel-job" data-testid="cancel-job" hidden>작업 취소</button>
          <p class="action-hint" id="action-hint">엔진 연결을 기다리고 있어요.</p>
          <p class="status-message" id="status-message" data-testid="status-message" role="status" aria-live="polite" hidden></p>
        </div>
        <div class="privacy-note"><span aria-hidden="true">⌑</span><p>사진은 이 작업에서만 사용합니다.<br />생성할 때 연결된 추론 서버로 전송합니다.</p></div>
      </aside>
    </div>
  </main>
  <footer class="site-footer"><span>입어봄 · 내 기기에서, 나만의 스타일</span><span id="footer-state">공통 작업 화면 · 엔진 미연결</span></footer>
`;
