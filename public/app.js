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

  // 2단계 신규: 낚시성 제목 DOM 요소
  const clickbaitCard = document.getElementById('clickbaitCard');
  const clickbaitToneBadge = document.getElementById('clickbaitToneBadge');
  const clickbaitRiskBadge = document.getElementById('clickbaitRiskBadge');
  const clickbaitScoreText = document.getElementById('clickbaitScoreText');
  const clickbaitMeterFill = document.getElementById('clickbaitMeterFill');
  const clickbaitSummaryText = document.getElementById('clickbaitSummaryText');
  const clickbaitReasonsWrapper = document.getElementById('clickbaitReasonsWrapper');
  const clickbaitReasonsList = document.getElementById('clickbaitReasonsList');

  const claimsCountBadge = document.getElementById('claimsCountBadge');
  const claimsListContainer = document.getElementById('claimsListContainer');

  // 빠른 테스트 예시 텍스트
  const SAMPLE_TEXTS = {
    covid: '코로나19 백신에는 사람을 원격 추적하기 위한 극미세 마이크로칩이 주입되어 있어 5G 기지국과 통신한다는 내용이 SNS를 통해 빠르게 확산되고 있습니다.',
    climate: '지난 10년간 지구 기온이 지속적으로 상승했음에도 불구하고 북극의 해빙 면적은 사상 최대치로 증가하여 지구 온난화는 거짓이라는 주장이 제기되었습니다.',
    clickbait: `[기사 제목] 충격! 정부가 내일부터 전 국민 통장을 전격 동결한다는 긴급 발표?!

[기사 본문]
정부는 최근 급증하는 보이스피싱 금융 사기 피해를 예방하기 위해, 이상 거래 징후가 포착된 일부 의심 계좌에 한하여 금융기관이 임시 지급정지를 적용할 수 있도록 금융위원회와 경찰청이 실무 가이드라인을 검토하고 있다고 12일 밝혔다. 일반 국민의 정상적인 계좌 거래와는 무관하다는 설명이다.`
  };

  // 1. 서버 헬스체크 및 API 키 설정 상태 확인
  async function checkServerHealth() {
    try {
      const res = await fetch('/api/health');
      if (!res.ok) throw new Error('서버 응답 오류');
      const data = await res.json();

      const { gemini, factCheck, naver } = data.apiKeysConfigured || {};

      if (gemini && factCheck) {
        if (naver) {
          apiKeyStatusBadge.textContent = '모든 API 준비 완료 🟢 (Gemini, FactCheck, Naver)';
          apiKeyStatusBadge.className = 'badge api-badge ready';
        } else {
          apiKeyStatusBadge.textContent = '핵심 API 준비 완료 🟢 (네이버 키는 선택 사항)';
          apiKeyStatusBadge.className = 'badge api-badge ready';
          apiKeyStatusBadge.title = '네이버 API 키가 없어도 팩트체크와 낚시성 제목 탐지는 정상 작동합니다.';
        }
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
      { id: 'step2', text: '2. Gemini가 낚시성 제목을 탐지하고 핵심 주장을 추출하고 있습니다...' },
      { id: 'step3', text: '3. Google Fact Check와 네이버 뉴스로 공인 근거를 교차 수집 중입니다...' },
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
    const { article, clickbait, results, message } = data;

    // 기사 기본 정보
    resultArticleTitle.textContent = article.title || '입력된 뉴스/문장';
    resultArticleSummary.textContent = article.summary || '요약 정보 없음';

    if (article.isUrl && article.sourceUrl) {
      resultArticleLink.href = article.sourceUrl;
      resultArticleLinkWrapper.classList.remove('hidden');
    } else {
      resultArticleLinkWrapper.classList.add('hidden');
    }

    // 2단계 신규: 낚시성 제목 탐지 카드 렌더링
    renderClickbaitCard(clickbait);

    // 주장 리스트 렌더링
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

  // 2단계 신규: 낚시성 제목 결과 렌더링
  function renderClickbaitCard(cb) {
    if (!cb || !cb.available) {
      clickbaitCard.classList.add('hidden');
      return;
    }

    clickbaitCard.classList.remove('hidden');

    // 톤 뱃지
    clickbaitToneBadge.textContent = cb.titleTone || '중립적/보도형';

    // 위험도 뱃지 및 색상
    const risk = cb.riskLevel || '낮음(신뢰)';
    clickbaitRiskBadge.textContent = `위험도: ${risk}`;

    if (risk.includes('높음')) {
      clickbaitRiskBadge.className = 'badge-risk-high';
    } else if (risk.includes('주의')) {
      clickbaitRiskBadge.className = 'badge-risk-mid';
    } else {
      clickbaitRiskBadge.className = 'badge-risk-low';
    }

    // 점수 및 게이지 바
    const score = typeof cb.score === 'number' ? cb.score : 0;
    clickbaitScoreText.textContent = `${score} / 100`;
    clickbaitMeterFill.style.width = `${Math.min(100, Math.max(0, score))}%`;

    // 총평
    clickbaitSummaryText.textContent = cb.summary || '';

    // 세부 이유 리스트
    if (cb.reasons && cb.reasons.length > 0) {
      clickbaitReasonsList.innerHTML = cb.reasons
        .map(r => `<li>${escapeHtml(r)}</li>`)
        .join('');
      clickbaitReasonsWrapper.classList.remove('hidden');
    } else {
      clickbaitReasonsWrapper.classList.add('hidden');
    }
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

  // 개별 주장 카드 DOM 생성 (Google Fact Check + 네이버 뉴스 교차 보도 결합)
  function createClaimCard(item, num) {
    const card = document.createElement('div');
    card.className = 'claim-card';

    const verdictMeta = getVerdictMeta(item.verdict);

    // 1) Google Fact Check Tools API 출처 목록 HTML
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

    // 2) 2단계 신규: 네이버 뉴스 타 언론사 교차 보도 HTML
    let crossNewsHtml = '';
    const crossData = item.crossNews;

    if (crossData && crossData.available && crossData.items && crossData.items.length > 0) {
      const newsItems = crossData.items.map(news => {
        const title = escapeHtml(news.title);
        const url = news.originallink || news.link || '#';
        const date = escapeHtml(news.pubDate);
        const desc = escapeHtml(news.description);

        return `
          <a href="${url}" target="_blank" rel="noopener noreferrer" class="cross-news-item" title="원문 기사 보기">
            <div class="cross-news-top">
              <span class="cross-news-item-title">${title}</span>
              <span class="cross-news-date">${date}</span>
            </div>
            <p class="cross-news-desc">${desc}</p>
          </a>
        `;
      }).join('');

      crossNewsHtml = `
        <div class="cross-news-section">
          <div class="cross-news-title">
            <span>📰 네이버 뉴스 타 언론사 교차 보도 (${crossData.items.length}건 확인)</span>
          </div>
          <div class="cross-news-list">
            ${newsItems}
          </div>
        </div>
      `;
    } else if (crossData && !crossData.available) {
      crossNewsHtml = `
        <div class="cross-news-section">
          <div class="cross-news-guide">
            💡 <strong>[선택 사항]</strong> .env 파일에 네이버 검색 API 키를 등록하시면 실시간 국내 언론사 교차 보도를 함께 비교할 수 있습니다.
          </div>
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
          <span>🔗 공인 Fact Check 출처 (${item.sources ? item.sources.length : 0}건)</span>
        </div>
        ${sourcesHtml}
      </div>

      ${crossNewsHtml}
    `;

    return card;
  }
});
