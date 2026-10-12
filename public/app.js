document.addEventListener('DOMContentLoaded', () => {
  // DOM 요소 참조
  const checkForm = document.getElementById('checkForm');
  const textOrUrlInput = document.getElementById('textOrUrlInput');
  const submitBtn = document.getElementById('submitBtn');
  const apiKeyStatusBadge = document.getElementById('apiKeyStatusBadge');

  const loadingSection = document.getElementById('loadingSection');
  const loadingStatusText = document.getElementById('loadingStatusText');
  const errorSection = document.getElementById('errorSection');
  const errorMessageTitle = document.getElementById('errorMessageTitle');
  const errorMessageDesc = document.getElementById('errorMessageDesc');
  const errorRetryBtn = document.getElementById('errorRetryBtn');

  const resultSection = document.getElementById('resultSection');
  const resultArticleTitle = document.getElementById('resultArticleTitle');
  const resultArticleLink = document.getElementById('resultArticleLink');
  const resultArticleLinkWrapper = document.getElementById('resultArticleLinkWrapper');
  const resultArticleSummary = document.getElementById('resultArticleSummary');
  const claimsCountBadge = document.getElementById('claimsCountBadge');
  const claimsListContainer = document.getElementById('claimsListContainer');

  // 빠른 테스트 예시 텍스트
  const SAMPLE_TEXTS = {
    covid: '코로나19 백신에는 사람을 원격 추적하기 위한 극미세 마이크로칩이 주입되어 있어 5G 기지국과 통신한다는 내용이 SNS를 통해 빠르게 확산되고 있습니다.',
    climate: '지난 10년간 지구 기온이 지속적으로 상승했음에도 불구하고 북극의 해빙 면적은 사상 최대치로 증가하여 지구 온난화는 거짓이라는 주장이 제기되었습니다.',
    korea: '2024년 대한민국 정부가 모든 국민에게 1인당 조건 없이 250만 원의 민생회복 지원금을 전액 현금으로 일괄 지급하기로 법안을 최종 공포했습니다.'
  };

  // 1. 서버 헬스체크 및 API 키 설정 상태 확인
  async function checkServerHealth() {
    try {
      const res = await fetch('/api/health');
      if (!res.ok) throw new Error('서버 응답 오류');
      const data = await res.json();

      const { gemini, factCheck } = data.apiKeysConfigured || {};

      if (gemini && factCheck) {
        apiKeyStatusBadge.textContent = 'API 연동 준비 완료 🟢';
        apiKeyStatusBadge.className = 'badge api-badge ready';
      } else {
        apiKeyStatusBadge.textContent = 'API 키 설정 필요 ⚠️';
        apiKeyStatusBadge.className = 'badge api-badge warning';
        apiKeyStatusBadge.title = '.env 파일에 GEMINI_API_KEY와 FACT_CHECK_API_KEY를 등록해 주세요.';
      }
    } catch (e) {
      apiKeyStatusBadge.textContent = '서버 연결 실패 🔴';
      apiKeyStatusBadge.className = 'badge api-badge warning';
    }
  }

  checkServerHealth();

  // 2. 예시 버튼 클릭 이벤트
  document.querySelectorAll('.btn-sample').forEach(btn => {
    btn.addEventListener('click', () => {
      const sampleKey = btn.getAttribute('data-sample');
      if (SAMPLE_TEXTS[sampleKey]) {
        textOrUrlInput.value = SAMPLE_TEXTS[sampleKey];
        textOrUrlInput.focus();
      }
    });
  });

  // 3. 로딩 단계 시뮬레이션
  let stepTimer = null;
  function startLoadingSteps() {
    const steps = [
      { id: 'step1', text: '1. 기사 본문을 분석 및 정제하고 있습니다...' },
      { id: 'step2', text: '2. Gemini가 검증 가능한 핵심 주장을 추출하고 있습니다...' },
      { id: 'step3', text: '3. Google Fact Check Tools API로 공인 근거를 수집 중입니다...' },
      { id: 'step4', text: '4. 수집된 근거와 주장을 엄격히 대조 분석 중입니다...' }
    ];

    let currentStep = 0;
    const updateStep = () => {
      steps.forEach((s, i) => {
        const el = document.getElementById(s.id);
        if (!el) return;
        if (i < currentStep) {
          el.className = 'step-item done';
        } else if (i === currentStep) {
          el.className = 'step-item active';
        } else {
          el.className = 'step-item';
        }
      });

      if (currentStep < steps.length) {
        loadingStatusText.textContent = steps[currentStep].text;
        currentStep++;
      }
    };

    updateStep();
    stepTimer = setInterval(updateStep, 2500);
  }

  function stopLoadingSteps() {
    if (stepTimer) {
      clearInterval(stepTimer);
      stepTimer = null;
    }
  }

  // 4. 폼 제출 (팩트체크 요청)
  checkForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const textOrUrl = textOrUrlInput.value.trim();
    if (!textOrUrl) {
      alert('기사 URL 또는 검증할 문장을 입력해 주세요.');
      return;
    }

    // UI 상태 전환: 로딩 활성화
    errorSection.classList.add('hidden');
    resultSection.classList.add('hidden');
    loadingSection.classList.remove('hidden');
    submitBtn.disabled = true;

    startLoadingSteps();

    try {
      const response = await fetch('/api/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ textOrUrl })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || '사실 확인 처리 중 오류가 발생했습니다.');
      }

      // 결과 렌더링
      renderResults(data);
    } catch (err) {
      showError('검증 실패', err.message);
    } finally {
      stopLoadingSteps();
      loadingSection.classList.add('hidden');
      submitBtn.disabled = false;
    }
  });

  // 에러 재시도 버튼
  errorRetryBtn.addEventListener('click', () => {
    errorSection.classList.add('hidden');
    textOrUrlInput.focus();
  });

  function showError(title, message) {
    errorMessageTitle.textContent = title;
    errorMessageDesc.textContent = message;
    errorSection.classList.remove('hidden');
    errorSection.scrollIntoView({ behavior: 'smooth' });
  }

  // 5. 검증 결과 렌더링
  function renderResults(data) {
    const { article, results, message } = data;

    // 기사 정보 렌더링
    resultArticleTitle.textContent = article.title || '입력된 뉴스/문장';
    resultArticleSummary.textContent = article.summary || '요약 정보 없음';

    if (article.isUrl && article.sourceUrl) {
      resultArticleLink.href = article.sourceUrl;
      resultArticleLinkWrapper.classList.remove('hidden');
    } else {
      resultArticleLinkWrapper.classList.add('hidden');
    }

    claimsCountBadge.textContent = `총 ${results.length}개 주장 분석`;
    claimsListContainer.innerHTML = '';

    if (results.length === 0) {
      claimsListContainer.innerHTML = `
        <div class="card" style="text-align: center; color: #64748b; padding: 30px;">
          <p>⚠️ ${message || '검증 가능한 핵심 주장을 찾지 못했습니다.'}</p>
        </div>
      `;
    } else {
      results.forEach((item, index) => {
        const card = createClaimCard(item, index + 1);
        claimsListContainer.appendChild(card);
      });
    }

    resultSection.classList.remove('hidden');
    resultSection.scrollIntoView({ behavior: 'smooth' });
  }

  // 판정 뱃지 스타일 매핑 (3가지 핵심 라벨)
  function getVerdictMeta(verdict) {
    switch (verdict) {
      case '근거와 일치':
        return {
          cssClass: 'verdict-match',
          icon: '✅',
          label: '근거와 일치'
        };
      case '근거와 상충':
        return {
          cssClass: 'verdict-conflict',
          icon: '❌',
          label: '근거와 상충'
        };
      case '근거 부족(확인 불가)':
      default:
        return {
          cssClass: 'verdict-lack',
          icon: '❓',
          label: '근거 부족(확인 불가)'
        };
    }
  }

  // 안전한 텍스트 이스케이프
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  // 개별 주장 카드 DOM 생성
  function createClaimCard(item, num) {
    const card = document.createElement('div');
    card.className = 'claim-card';

    const verdictMeta = getVerdictMeta(item.verdict);

    // 출처 목록 HTML 생성 (필수 요건: 모든 판정에 출처 링크 제공)
    let sourcesHtml = '';
    if (item.sources && item.sources.length > 0) {
      const sourceItems = item.sources.map(src => {
        const publisher = escapeHtml(src.publisher || '검증 기관');
        const title = escapeHtml(src.title || src.claimText);
        const url = src.url ? escapeHtml(src.url) : '#';
        const rating = escapeHtml(src.rating || '검증 보도');

        return `
          <a href="${url}" target="_blank" rel="noopener noreferrer" class="source-item" title="원문 팩트체크 기사 보기">
            <div class="source-info">
              <span class="publisher-tag">${publisher}</span>
              <span class="source-article-title">${title}</span>
            </div>
            <span class="source-rating-badge">판정: ${rating} ↗</span>
          </a>
        `;
      }).join('');

      sourcesHtml = `
        <div class="sources-list">
          ${sourceItems}
        </div>
      `;
    } else {
      sourcesHtml = `
        <div class="no-sources">
          ⚠️ Google Fact Check Tools API 검색 결과 관련된 공인 검증 보도를 찾지 못했습니다. (외부 근거 없음)
        </div>
      `;
    }

    card.innerHTML = `
      <div class="claim-top">
        <div class="claim-num-title">
          <span class="claim-num">주장 ${num}</span>
          <h4 class="claim-title-text">${escapeHtml(item.claimText)}</h4>
        </div>
        <div class="verdict-badge ${verdictMeta.cssClass}">
          <span>${verdictMeta.icon}</span>
          <span>${verdictMeta.label}</span>
        </div>
      </div>

      <div class="reason-box">
        <div class="reason-title">💡 판정 이유 및 근거 대조 분석</div>
        <p>${escapeHtml(item.reason)}</p>
      </div>

      <div class="sources-section">
        <div class="sources-title">
          <span>🔗 실제 수집된 근거 출처 (${item.sources ? item.sources.length : 0}건)</span>
        </div>
        ${sourcesHtml}
      </div>
    `;

    return card;
  }
});
