'use client';
// 학습 완료 모션: "+N XP" 칩이 결과 카드에서 튀어나와, 화면 헤더 오른쪽 끝에 갑자기 나타난
// "총 경험치" 배지로 날아가 박히고 숫자가 합산된 뒤 사라짐 (xp-fly.js와 같은 순서·시간)

const fmt = (n) => Number(n).toLocaleString();
const centerOf = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

function el(tag, style, html) {
  const node = document.createElement(tag);
  Object.assign(node.style, { position: 'fixed', pointerEvents: 'none', ...style });
  if (html) node.innerHTML = html;
  document.body.appendChild(node);
  return node;
}

function makeBadge(total) {
  return el(
    'div',
    {
      left: '0px', top: '0px', zIndex: 100, opacity: '0', display: 'flex', alignItems: 'center', gap: '10px',
      padding: '8px 16px 8px 8px', borderRadius: '999px', background: '#fffaf1',
      border: '1.5px solid var(--color-neutral-300)', boxShadow: '0 14px 30px -16px rgba(32,30,29,.5)',
    },
    `<span style="width:30px;height:30px;border-radius:999px;background:var(--color-accent);color:#fffaf1;display:flex;align-items:center;justify-content:center;font:800 11px 'Figtree',sans-serif">XP</span>` +
      `<span style="display:flex;flex-direction:column;gap:1px;line-height:1.1"><span style="font:700 10px 'Noto Sans KR',sans-serif;color:var(--color-neutral-700)">총 경험치</span>` +
      `<span data-n style="font:800 16px 'Figtree',sans-serif;color:var(--color-accent-800);font-variant-numeric:tabular-nums">${fmt(total)}</span></span>`
  );
}

function countUp(node, from, to, ms) {
  const t0 = performance.now();
  const step = (t) => {
    const p = Math.min(1, (t - t0) / ms);
    node.textContent = fmt(Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// 배지 자리: [data-xp-anchor] 줄의 오른쪽 끝 · 세로 가운데. 헤더가 화면 밖이면 오른쪽 위
function badgeSpot(br) {
  let x = window.innerWidth - br.width - 22;
  let y = 18;
  const an = document.querySelector('[data-xp-anchor]');
  if (an) {
    const r = an.getBoundingClientRect();
    const cs = getComputedStyle(an);
    const pt = parseFloat(cs.paddingTop) || 0;
    const pb = parseFloat(cs.paddingBottom) || 0;
    x = r.right - (parseFloat(cs.paddingRight) || 0) - br.width;
    const cy = r.top + pt + (r.height - pt - pb - br.height) / 2;
    if (cy >= 8) y = cy;
  }
  return { x, y };
}

export function flyXp(from, amount, oldTotal, newTotal) {
  if (!from || typeof document === 'undefined') return;
  const a = centerOf(from.getBoundingClientRect());
  const badge = makeBadge(oldTotal);
  const num = badge.querySelector('[data-n]');
  const br = badge.getBoundingClientRect();
  const { x: bx, y: by } = badgeSpot(br);
  Object.assign(badge.style, { left: bx + 'px', top: by + 'px' });
  const target = { x: bx + br.width / 2, y: by + br.height / 2 };
  const dx = target.x - a.x;
  const dy = target.y - a.y;

  const chip = el('div', {
    left: a.x + 'px', top: a.y + 'px', zIndex: 101, padding: '8px 15px', borderRadius: '999px',
    background: 'var(--color-accent-600)', color: '#fffaf1', font: "800 15px 'Figtree',sans-serif",
    whiteSpace: 'nowrap', boxShadow: '0 10px 24px -10px rgba(32,30,29,.55)',
  });
  chip.textContent = '+' + amount + ' XP';
  const T = 'translate(-50%,-50%) ';
  chip.animate(
    [
      { transform: T + 'scale(.3)', opacity: 0, offset: 0 },
      { transform: T + 'translate(0,-44px) scale(1.3)', opacity: 1, offset: 0.24, easing: 'ease-out' },
      { transform: T + 'translate(0,-38px) scale(1.15)', offset: 0.46, easing: 'cubic-bezier(.55,0,.95,.35)' },
      { transform: T + `translate(${dx * 0.5}px,${dy * 0.5 - 50}px) scale(1)`, offset: 0.76, easing: 'cubic-bezier(.6,0,1,.6)' },
      { transform: T + `translate(${dx}px,${dy}px) scale(.35)`, opacity: 0.95, offset: 1 },
    ],
    { duration: 1100, fill: 'forwards' }
  ).onfinish = () => {
    chip.remove();
    badge.animate(
      [
        { transform: 'scale(1)' },
        { transform: 'scale(1.25) rotate(-5deg)', offset: 0.2 },
        { transform: 'scale(.9) rotate(2deg)', offset: 0.48 },
        { transform: 'scale(1.05)', offset: 0.74 },
        { transform: 'scale(1)' },
      ],
      { duration: 560, easing: 'ease-out' }
    );
    // 박힐 때 튀는 점 10개
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * Math.PI * 2;
      const d = 36 + Math.random() * 16;
      const dot = el('span', {
        left: target.x + 'px', top: target.y + 'px', width: '7px', height: '7px', borderRadius: '999px', zIndex: 101,
        background: i % 2 ? 'var(--color-accent)' : 'var(--color-accent-2)',
      });
      dot.animate(
        [
          { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
          { transform: `translate(-50%,-50%) translate(${Math.cos(ang) * d}px,${Math.sin(ang) * d}px) scale(.2)`, opacity: 0 },
        ],
        { duration: 520, easing: 'cubic-bezier(.2,.8,.3,1)' }
      ).onfinish = () => dot.remove();
    }
    countUp(num, oldTotal, newTotal, 700);
    setTimeout(() => {
      badge.animate([{ transform: 'none', opacity: 1 }, { transform: 'scale(.85)', opacity: 0 }], {
        duration: 280, easing: 'ease-in', fill: 'forwards',
      }).onfinish = () => badge.remove();
    }, 2300);
  };
  // 칩이 떠오른 직후 배지가 '팍' 등장
  setTimeout(() => {
    badge.animate(
      [{ transform: 'scale(.2)', opacity: 0 }, { transform: 'scale(1.15)', opacity: 1, offset: 0.6 }, { transform: 'scale(1)', opacity: 1 }],
      { duration: 240, easing: 'cubic-bezier(.34,1.56,.64,1)', fill: 'forwards' }
    );
  }, 300);
}
