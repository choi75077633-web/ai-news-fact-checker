const axios = require('axios');

const NAVER_NEWS_API_URL = 'https://openapi.naver.com/v1/search/news.json';

/**
 * 네이버 뉴스 응답 HTML 태그 및 엔티티 정제
 */
function cleanHtml(text) {
  if (!text) return '';
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&apos;/g, "'")
    .trim();
}

/**
 * 네이버 검색 API로 관련 뉴스 기사 검색 (언론사 교차 검증)
 * @param {string} query - 검색 키워드
 * @param {number} [display=6] - 가져올 기사 수
 * @returns {Promise<Object>} { available, total, items, message }
 */
async function searchNaverNews(query, display = 6) {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  // 네이버 키가 없는 경우 안전한 Fallback 제공 (원칙: 키가 없어도 기존 기능 정상 작동)
  if (!clientId || !clientSecret || clientId === 'your_naver_client_id_here' || clientSecret === 'your_naver_client_secret_here') {
    return {
      available: false,
      total: 0,
      items: [],
      message: '네이버 검색 API 키가 설정되지 않아 언론사 교차 보도 조회를 건너뜁니다.'
    };
  }

  if (!query || query.trim().length === 0) {
    return {
      available: true,
      total: 0,
      items: [],
      message: '검색어가 비어 있습니다.'
    };
  }

  try {
    const cleanQuery = query.trim().slice(0, 100);
    const response = await axios.get(NAVER_NEWS_API_URL, {
      params: {
        query: cleanQuery,
        display: display,
        sort: 'sim' // 정확도순 검색
      },
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret
      },
      timeout: 8000
    });

    const data = response.data;
    const rawItems = data?.items || [];

    const items = rawItems.map(item => ({
      title: cleanHtml(item.title),
      originallink: item.originallink || item.link,
      link: item.link,
      description: cleanHtml(item.description),
      pubDate: item.pubDate ? new Date(item.pubDate).toLocaleDateString('ko-KR') : ''
    }));

    return {
      available: true,
      total: data?.total || items.length,
      items: items,
      message: items.length > 0
        ? `총 ${items.length}개의 관련 언론사 보도를 확인했습니다.`
        : '관련된 최근 언론사 보도를 찾지 못했습니다.'
    };
  } catch (err) {
    console.warn('[NaverNews API] 호출 실패:', err.response?.data?.errorMessage || err.message);
    // API 에러 발생 시에도 앱이 다운되지 않고 정상 진행되도록 예외 처리
    return {
      available: false,
      total: 0,
      items: [],
      message: `네이버 검색 API 호출 실패 (${err.message})`
    };
  }
}

module.exports = {
  searchNaverNews
};
