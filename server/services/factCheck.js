const axios = require('axios');

const FACT_CHECK_API_URL = 'https://factchecktools.googleapis.com/v1alpha1/claims:search';

/**
 * Google Fact Check Tools API를 사용하여 특정 키워드/주장과 관련된 기존 팩트체크 기사(ClaimReview) 검색
 * @param {string} query - 검색어 (인물, 사건, 주장 핵심 키워드)
 * @param {string} [languageCode='ko'] - 기본 언어 코드
 * @returns {Promise<Array>} 정제된 근거(Evidence) 목록
 */
async function searchFactChecks(query, languageCode = 'ko') {
  const apiKey = process.env.FACT_CHECK_API_KEY;

  if (!apiKey || apiKey === 'your_google_fact_check_api_key_here') {
    console.warn('[FactCheck API] FACT_CHECK_API_KEY가 설정되지 않았습니다. 외부 근거 조회가 제한됩니다.');
    return [];
  }

  if (!query || query.trim().length === 0) {
    return [];
  }

  const cleanQuery = query.trim().slice(0, 100);

  try {
    // 1차 검색: 지정된 언어(한국어)로 검색
    let response = await axios.get(FACT_CHECK_API_URL, {
      params: {
        query: cleanQuery,
        languageCode: languageCode,
        key: apiKey,
        pageSize: 5
      },
      timeout: 10000
    });

    let rawClaims = response.data?.claims || [];

    // 한국어 결과가 없을 경우, 언어 필터 없이 글로벌 데이터베이스에서 2차 검색
    if (rawClaims.length === 0 && languageCode === 'ko') {
      try {
        response = await axios.get(FACT_CHECK_API_URL, {
          params: {
            query: cleanQuery,
            key: apiKey,
            pageSize: 5
          },
          timeout: 10000
        });
        rawClaims = response.data?.claims || [];
      } catch (subErr) {
        // 2차 검색 오류는 무시하고 진행
      }
    }

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

    return evidences;
  } catch (err) {
    if (err.response) {
      const status = err.response.status;
      const msg = err.response.data?.error?.message || err.message;
      console.error(`[FactCheck API] 호출 실패 (${status}):`, msg);
      // API 오류 시 빈 배열 반환하여 전체 파이프라인이 멈추지 않고 '근거 부족'으로 자연스럽게 처리되도록 함
      return [];
    }
    console.error('[FactCheck API] 네트워크 오류:', err.message);
    return [];
  }
}

module.exports = {
  searchFactChecks
};
