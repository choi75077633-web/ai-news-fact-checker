const axios = require('axios');

const FACT_CHECK_API_URL = 'https://factchecktools.googleapis.com/v1alpha1/claims:search';

/**
 * 긴 문장이나 자연어 질문에서 Fact Check API에 최적화된 2~3단어 검색 키워드 후보군 생성
 */
function generateQueryCandidates(rawQuery) {
  if (!rawQuery) return [];
  const text = rawQuery.trim();

  const candidates = [];

  // 특정 대표 이슈에 대한 자동 키워드 보정 (한/영 듀얼 쿼리)
  if (text.includes('백신') && (text.includes('마이크로칩') || text.includes('칩') || text.includes('5G'))) {
    candidates.push('백신 마이크로칩');
    candidates.push('vaccine microchip');
    candidates.push('코로나 백신');
  } else if (text.includes('빙하') || text.includes('해빙') || text.includes('온난화')) {
    candidates.push('북극 해빙');
    candidates.push('arctic sea ice');
    candidates.push('지구 온난화');
  } else if (text.includes('기본소득') || text.includes('지원금')) {
    candidates.push('기본소득');
    candidates.push('universal basic income');
  } else if (text.includes('통장') && text.includes('동결')) {
    candidates.push('계좌 동결');
    candidates.push('보이스피싱 지급정지');
  }

  // 불필요한 조사, 서술어, 특수문자 제거 후 명사형 단어 추출
  const clean = text
    .replace(/[\[\](){}<>!?,~"'\n\r]/g, ' ')
    .replace(/(에는|에서|으로|에게|하여|하고|되어|다는|라는|따르면|통해|위한|대해|에도|불구하고|지난|최근|충격|경악|발칵|긴급|발표|내용이|주장이|사람을|전격|빠르게|확산되고|있습니다|제기되었습니다|밝혔다|전했다)/g, ' ');

  const words = clean.split(/\s+/).filter(w => w.length >= 2);

  if (words.length >= 2) {
    candidates.push(`${words[0]} ${words[1]}`);
    if (words.length >= 3) {
      candidates.push(`${words[0]} ${words[2]}`);
    }
  } else if (words.length === 1) {
    candidates.push(words[0]);
  }

  // 원본 짧은 검색어 추가
  if (text.length <= 30 && !candidates.includes(text)) {
    candidates.push(text);
  }

  return [...new Set(candidates)];
}

/**
 * Google Fact Check Tools API를 사용하여 특정 키워드/주장과 관련된 기존 팩트체크 기사(ClaimReview) 검색
 * @param {string} rawQuery - 검색어 (인물, 사건, 주장 핵심 키워드)
 * @param {string} [languageCode='ko'] - 기본 언어 코드
 * @returns {Promise<Array>} 정제된 근거(Evidence) 목록
 */
async function searchFactChecks(rawQuery, languageCode = 'ko') {
  const apiKey = process.env.FACT_CHECK_API_KEY;

  if (!apiKey || apiKey === 'your_google_fact_check_api_key_here') {
    console.warn('[FactCheck API] FACT_CHECK_API_KEY가 설정되지 않았습니다. 외부 근거 조회가 제한됩니다.');
    return [];
  }

  if (!rawQuery || rawQuery.trim().length === 0) {
    return [];
  }

  const queryCandidates = generateQueryCandidates(rawQuery);
  if (queryCandidates.length === 0) {
    queryCandidates.push(rawQuery.slice(0, 30));
  }

  for (const query of queryCandidates) {
    try {
      // 1. 한국어 검색 시도
      let response = await axios.get(FACT_CHECK_API_URL, {
        params: {
          query: query,
          languageCode: languageCode,
          key: apiKey,
          pageSize: 5
        },
        timeout: 8000
      });

      let rawClaims = response.data?.claims || [];

      // 2. 한국어 결과가 없으면 글로벌(언어 제한 없음) 검색 시도
      if (rawClaims.length === 0) {
        response = await axios.get(FACT_CHECK_API_URL, {
          params: {
            query: query,
            key: apiKey,
            pageSize: 5
          },
          timeout: 8000
        });
        rawClaims = response.data?.claims || [];
      }

      if (rawClaims.length > 0) {
        // 결과 파싱 및 표준화
        const evidences = [];

        for (const claim of rawClaims) {
          const claimText = claim.text || '';
          const claimant = claim.claimant || '미상';
          const claimDate = claim.claimDate ? claim.claimDate.split('T')[0] : '';

          if (claim.claimReview && Array.isArray(claim.claimReview)) {
            for (const review of claim.claimReview) {
              const publisherName = review.publisher?.name || review.publisher?.site || '검증 기관';
              const reviewUrl = review.url || '';
              const reviewTitle = review.title || claimText;
              const rating = review.textualRating || '검증 완료';

              evidences.push({
                claimText,
                claimant,
                claimDate,
                publisher: publisherName,
                url: reviewUrl,
                title: reviewTitle,
                rating: rating
              });
            }
          }
        }

        if (evidences.length > 0) {
          console.log(`[FactCheck API] '${query}' 키워드로 ${evidences.length}건의 공인 근거 확보 성공!`);
          return evidences;
        }
      }
    } catch (err) {
      // 개별 쿼리 실패 시 다음 후보로 계속 진행
      continue;
    }
  }

  return [];
}

module.exports = {
  searchFactChecks
};
