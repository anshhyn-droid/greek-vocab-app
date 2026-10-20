'use client';

// 자동 로그아웃 시각을 열린 탭 모두에 알림 (한 탭에서 쓰면 다른 탭도 연장)
const CHANNEL = 'gk-session';
let channel = null;
export function sessionChannel() {
  if (!channel && typeof BroadcastChannel !== 'undefined') channel = new BroadcastChannel(CHANNEL);
  return channel;
}
export function publishExpiry(ms) {
  if (!ms) return;
  window.dispatchEvent(new CustomEvent(CHANNEL, { detail: ms }));
  sessionChannel()?.postMessage(ms);
}

const csrfCookie = () => document.cookie.match(/(?:^|; )gk_csrf=([^;]*)/)?.[1];

// eslint-disable-next-line @next/next/no-location-assign-relative-destination
const goStart = (q = '') => (window.location.href = '/start' + q);

/**
 * 브라우저에서 서버 API 호출
 * - 상태를 바꾸는 요청에는 CSRF 토큰을 붙임
 * - 로그인이 풀렸으면 시작 화면으로 (하루 미사용이면 안내와 함께)
 * - 그 밖의 실패는 error.code(서버의 error 값)로 구분
 */
export async function api(path, { method = 'GET', body } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (method !== 'GET') {
    // 이 기능 전에 로그인한 세션이면 CSRF 쿠키를 먼저 받음
    if (!csrfCookie()) await fetch('/api/session', { cache: 'no-store' }).catch(() => {});
    headers['X-CSRF-Token'] = csrfCookie() || '';
  }
  const res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
  publishExpiry(Number(res.headers.get('X-Idle-Expires')));
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    // 세션이 끝났으면 화면 상태를 버리고 시작 화면을 새로 불러옴
    goStart(data.error === 'idle' ? '?notice=idle' : '');
    throw Object.assign(new Error('unauthorized'), { code: 'unauthorized' });
  }
  if (res.status === 403 && data.error === 'consent') {
    goStart();
    throw Object.assign(new Error('consent'), { code: 'consent' });
  }
  if (!res.ok) throw Object.assign(new Error('http ' + res.status), { code: data.error, status: res.status });
  return data;
}

// 문항 목록 불러오기: 요청 실패·서버 오류·빈 데이터는 모두 실패로
export async function loadList(path) {
  const data = await api(path);
  if (!Array.isArray(data) || !data.length) throw new Error('empty');
  return data;
}
