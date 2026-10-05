'use client';

// 브라우저에서 서버 API 호출. 로그인이 풀렸으면 시작 화면으로
export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  if (res.status === 401) {
    // 세션이 끝났으면 화면 상태를 버리고 시작 화면을 새로 불러옴
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = '/start';
    throw new Error('unauthorized');
  }
  if (!res.ok) throw new Error('http ' + res.status);
  return res.json();
}

// 문항 목록 불러오기: 요청 실패·서버 오류·빈 데이터는 모두 실패로
export async function loadList(path) {
  const data = await api(path);
  if (!Array.isArray(data) || !data.length) throw new Error('empty');
  return data;
}
