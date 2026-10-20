// 화면 크기와 펼친 책 크기 (steps/00_공통규칙.md "화면 크기")
import { useSyncExternalStore } from 'react';

export const PHONE_MAX = 700; // 700px 미만 = 폰

export interface BookSize {
  w: number; // 창 폭
  h: number; // 창 높이
  narrow: boolean;
  BH: number; // 책 높이 = min(750, 창 높이 − 110)
  BW: number; // 책 폭 = min(1100, 창 폭 − 130, BH × 1.6)
  left: number; // 책 왼쪽 (탭 자리 30px만큼 왼쪽으로)
  top: number;
}

export function bookSize(w: number, h: number): BookSize {
  const BH = Math.min(750, h - 110);
  const BW = Math.min(1100, w - 130, BH * 1.6);
  return { w, h, narrow: w < PHONE_MAX, BH, BW, left: (w - BW) / 2 - 30, top: (h - BH) / 2 };
}

// 글자 크기(마이페이지): 보통·크게·아주 크게 → 화면 전체 배율 (design/gk-session.js)
// 배율을 곱한 만큼 책이 창을 넘지 않도록, 책 크기는 배율로 나눈 창 크기로 계산
export const ZOOM: Record<string, number> = { m: 1, l: 1.08, xl: 1.16 };
let zoom = 1;
const measure = () => bookSize(Math.round(window.innerWidth / zoom), Math.round(window.innerHeight / zoom));

// 창 크기는 리스너 하나가 계산하고, 이 값을 쓰는 화면 모두에게 알림
let snap = measure();
const subs = new Set<() => void>();
const refresh = () => {
  const next = measure();
  if (next.w === snap.w && next.h === snap.h) return;
  snap = next;
  subs.forEach((cb) => cb());
};
window.addEventListener('resize', refresh);

export function setFontSize(size: string) {
  zoom = ZOOM[size] || 1;
  document.documentElement.style.zoom = zoom === 1 ? '' : String(zoom);
  refresh();
}
const subscribe = (cb: () => void) => {
  subs.add(cb);
  return () => { subs.delete(cb); };
};

// 창 크기가 바뀌면 다시 계산
export function useBookSize(): BookSize {
  return useSyncExternalStore(subscribe, () => snap);
}

// 종이: #fffaf1 기반, 가운데 접힌 곳(왼쪽 쪽 비율 f%)으로 갈수록 살짝 어두워짐
export function paperGradient(f = 50): string {
  const r = (n: number) => n.toFixed(1) + '%';
  return `linear-gradient(90deg,#f1e4ca 0%,#fbf3e3 ${r(f * 0.12)},#fffaf1 ${r(f * 0.6)},#f7edda ${r(f - 4)},#eadbbd ${r(f)},#f7edda ${r(f + 4)},#fffaf1 ${r(f + (100 - f) * 0.4)},#fbf3e3 ${r(100 - (100 - f) * 0.12)},#f1e4ca 100%)`;
}
