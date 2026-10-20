// 경험치 모션 (design/xp-fly.js 동작 그대로): "+N XP" 칩이 결과 칸에서 튀어나와 날아가 총 경험치 배지에 박히며 합산
// 배지는 지금 탭([data-xp-target], 컴퓨터는 오른쪽 가죽 탭·폰은 하단 탭) 옆에 나타남
const center = (r: DOMRect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
const fmt = (n: number) => Number(n).toLocaleString();

function badge(total: number) {
  const b = document.createElement('div');
  Object.assign(b.style, {
    position: 'fixed', left: '0px', top: '0px', zIndex: '100', pointerEvents: 'none', opacity: '0',
    display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 16px 8px 8px', borderRadius: '999px',
    background: '#fffaf1', border: '1.5px solid #e8dcc6', boxShadow: '0 14px 30px -16px rgba(32,30,29,.5)',
  });
  b.innerHTML =
    '<span style="width:30px;height:30px;border-radius:999px;background:#c67139;color:#fffaf1;display:flex;align-items:center;justify-content:center;font:700 12px \'Pretendard Variable\',Pretendard,sans-serif">XP</span>' +
    '<span style="display:flex;flex-direction:column;gap:1px;line-height:1.1"><span style="font:600 12px \'Gentium Greek\',\'Pretendard Variable\',Pretendard,sans-serif;color:oklch(.455 .018 45)">총 경험치</span>' +
    '<span data-n style="font:700 16px \'Pretendard Variable\',Pretendard,sans-serif;color:#643312;font-variant-numeric:tabular-nums">' + fmt(total) + '</span></span>';
  document.body.appendChild(b);
  return b;
}

function count(el: HTMLElement, from: number, to: number, dur: number) {
  const t0 = performance.now();
  const step = (t: number) => {
    const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
    el.textContent = fmt(Math.round(from + (to - from) * e));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function flyXp(from: Element | null, amount: number, oldTotal: number, newTotal: number) {
  if (!from || !amount) return;
  const a = center(from.getBoundingClientRect());
  const b = badge(oldTotal), num = b.querySelector('[data-n]') as HTMLElement, br = b.getBoundingClientRect();
  // 위치: 지금 탭 옆. 탭이 없으면 오른쪽 위
  let bx = window.innerWidth - br.width - 22, by = 18;
  const tab = document.querySelector('[data-xp-target="true"]');
  if (tab) {
    const r = tab.getBoundingClientRect();
    const phone = r.top > window.innerHeight / 2; // 폰 하단 탭바
    bx = phone ? Math.min(window.innerWidth - br.width - 12, Math.max(12, r.left + r.width / 2 - br.width / 2)) : Math.max(12, r.left - br.width - 10);
    by = phone ? r.top - br.height - 12 : r.top + r.height / 2 - br.height / 2;
  }
  b.style.left = bx + 'px';
  b.style.top = by + 'px';
  const t = { x: bx + br.width / 2, y: by + br.height / 2 }, dx = t.x - a.x, dy = t.y - a.y;

  const el = document.createElement('div');
  el.textContent = '+' + amount + ' XP';
  Object.assign(el.style, {
    position: 'fixed', left: a.x + 'px', top: a.y + 'px', zIndex: '101', pointerEvents: 'none', padding: '8px 15px', borderRadius: '999px',
    background: '#b2622d', color: '#fffaf1', font: "700 16px 'Pretendard Variable',Pretendard,sans-serif", whiteSpace: 'nowrap', boxShadow: '0 10px 24px -10px rgba(32,30,29,.55)',
  });
  document.body.appendChild(el);
  const T = 'translate(-50%,-50%) ';
  el.animate([
    { transform: T + 'scale(.3)', opacity: 0, offset: 0 },
    { transform: T + 'translate(0,-44px) scale(1.3)', opacity: 1, offset: 0.24, easing: 'ease-out' },
    { transform: T + 'translate(0,-38px) scale(1.15)', offset: 0.46, easing: 'cubic-bezier(.55,0,.95,.35)' },
    { transform: T + `translate(${dx * 0.5}px,${dy * 0.5 - 50}px) scale(1)`, offset: 0.76, easing: 'cubic-bezier(.6,0,1,.6)' },
    { transform: T + `translate(${dx}px,${dy}px) scale(.35)`, opacity: 0.95, offset: 1 },
  ], { duration: 1100, fill: 'forwards' }).onfinish = () => {
    el.remove();
    b.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.25) rotate(-5deg)', offset: 0.2 }, { transform: 'scale(.9) rotate(2deg)', offset: 0.48 }, { transform: 'scale(1.05)', offset: 0.74 }, { transform: 'scale(1)' }], { duration: 560, easing: 'ease-out' });
    for (let i = 0; i < 10; i++) {
      const s = document.createElement('span'), ang = (i / 10) * Math.PI * 2, d = 36 + Math.random() * 16;
      Object.assign(s.style, { position: 'fixed', left: t.x + 'px', top: t.y + 'px', width: '7px', height: '7px', borderRadius: '999px', background: i % 2 ? '#c67139' : '#7a8a5e', zIndex: '101', pointerEvents: 'none' });
      document.body.appendChild(s);
      s.animate([{ transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }, { transform: `translate(-50%,-50%) translate(${Math.cos(ang) * d}px,${Math.sin(ang) * d}px) scale(.2)`, opacity: 0 }], { duration: 520, easing: 'cubic-bezier(.2,.8,.3,1)' }).onfinish = () => s.remove();
    }
    count(num, oldTotal, newTotal, 700);
    setTimeout(() => {
      b.animate([{ transform: 'none', opacity: 1 }, { transform: 'scale(.85)', opacity: 0 }], { duration: 280, easing: 'ease-in', fill: 'forwards' }).onfinish = () => b.remove();
    }, 2300);
  };
  setTimeout(() => {
    b.animate([{ transform: 'scale(.2)', opacity: 0 }, { transform: 'scale(1.15)', opacity: 1, offset: 0.6 }, { transform: 'scale(1)', opacity: 1 }], { duration: 240, easing: 'cubic-bezier(.34,1.56,.64,1)', fill: 'forwards' });
  }, 300);
}

// "오답 노트에 담았어요" — 위로 쓱 올라가며 사라짐 (design/gk-notes.js)
export function wrongToast() {
  const el = document.createElement('div');
  el.innerHTML =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round"><path d="M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4"/><path d="M2 6h4"/><path d="M2 10h4"/><path d="M2 14h4"/><path d="M2 18h4"/><path d="M21.4 5.6a2.1 2.1 0 1 0-3-3L13 8l-1 4 4-1Z"/></svg><span>오답 노트에 담았어요</span>';
  el.setAttribute('role', 'status');
  el.style.cssText = "position:fixed;left:50%;bottom:16%;z-index:9999;display:flex;align-items:center;gap:8px;padding:11px 20px;border-radius:999px;background:#fbe4e0;color:#9b2f27;font:700 14px 'Pretendard Variable',Pretendard,sans-serif;box-shadow:0 10px 24px -10px rgba(46,43,37,.45);pointer-events:none;transform:translate(-50%,0)";
  document.body.appendChild(el);
  const a = el.animate([{ opacity: 0, transform: 'translate(-50%,16px)' }, { opacity: 1, transform: 'translate(-50%,0)', offset: 0.18 }, { opacity: 1, transform: 'translate(-50%,-14px)', offset: 0.62 }, { opacity: 0, transform: 'translate(-50%,-64px)' }], { duration: 1700, easing: 'cubic-bezier(.3,.7,.4,1)' });
  a.onfinish = () => el.remove();
}
