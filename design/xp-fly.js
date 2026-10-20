// 학습 완료 시: "+N XP"가 결과 카드에서 튀어나오고, 오른쪽 위에 총 경험치 배지가 갑자기 나타나 거기 박히며 합산됨
(function(){
  const center = r => ({ x: r.left + r.width/2, y: r.top + r.height/2 });
  const fmt = n => Number(n).toLocaleString();
  function badge(total){
    const b = document.createElement('div');
    Object.assign(b.style, { position:'fixed', left:'0px', top:'0px', zIndex:100, pointerEvents:'none', opacity:'0',
      display:'flex', alignItems:'center', gap:'10px', padding:'8px 16px 8px 8px', borderRadius:'999px',
      background:'#fffaf1', border:'1.5px solid var(--color-neutral-300)', boxShadow:'0 14px 30px -16px rgba(32,30,29,.5)' });
    b.innerHTML = '<span style="width:30px;height:30px;border-radius:999px;background:var(--color-accent);color:#fffaf1;display:flex;align-items:center;justify-content:center;font:700 12px \'Pretendard Variable\',Pretendard,sans-serif">XP</span>'
      + '<span style="display:flex;flex-direction:column;gap:1px;line-height:1.1"><span style="font:600 12px \'Gentium Greek\',\'Pretendard Variable\',Pretendard,sans-serif;color:var(--color-neutral-700)">총 경험치</span>'
      + '<span data-n style="font:700 16px \'Pretendard Variable\',Pretendard,sans-serif;color:var(--color-accent-800);font-variant-numeric:tabular-nums">' + fmt(total) + '</span></span>';
    document.body.appendChild(b);
    return b;
  }
  function count(el, from, to, dur){
    const t0 = performance.now();
    const step = t => { const p = Math.min(1,(t-t0)/dur), e = 1-Math.pow(1-p,3);
      el.textContent = fmt(Math.round(from + (to-from)*e)); if (p<1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  // 순서: 보상 칩이 튀어나옴 → 오른쪽 위에 총 경험치 배지가 갑자기 등장 → 칩이 날아가 콱 박힘 → 숫자 합산 → 잠시 뒤 사라짐
  function run(from, amount, oldTotal, newTotal){
    const fr = from.getBoundingClientRect(), a = center(fr);
    const b = badge(oldTotal), num = b.querySelector('[data-n]'), br = b.getBoundingClientRect();
    const vw = window.innerWidth;
    // 위치: 화면 헤더 줄([data-xp-anchor])의 오른쪽 끝 · 세로 가운데에 맞춤. 헤더가 화면 밖이면 오른쪽 위 고정
    let bx = vw - br.width - 22, by = 18;
    const an = document.querySelector('[data-xp-anchor]');
    if (an) { const r = an.getBoundingClientRect(), cs = getComputedStyle(an);
      const pt = parseFloat(cs.paddingTop)||0, pb = parseFloat(cs.paddingBottom)||0;
      bx = r.right - (parseFloat(cs.paddingRight)||0) - br.width;
      const y = r.top + pt + (r.height - pt - pb - br.height)/2;
      if (y >= 8) by = y; }
    b.style.left = bx + 'px'; b.style.top = by + 'px';
    const t = { x: bx + br.width/2, y: by + br.height/2 }, dx = t.x - a.x, dy = t.y - a.y;

    const el = document.createElement('div');
    el.textContent = '+' + amount + ' XP';
    Object.assign(el.style, { position:'fixed', left:a.x+'px', top:a.y+'px', zIndex:101, pointerEvents:'none',
      padding:'8px 15px', borderRadius:'999px', background:'var(--color-accent-600)', color:'#fffaf1',
      font:"700 16px 'Pretendard Variable',Pretendard,sans-serif", whiteSpace:'nowrap', boxShadow:'0 10px 24px -10px rgba(32,30,29,.55)' });
    document.body.appendChild(el);
    const T = 'translate(-50%,-50%) ';
    el.animate([
      { transform: T+'scale(.3)', opacity:0, offset:0 },
      { transform: T+'translate(0,-44px) scale(1.3)', opacity:1, offset:.24, easing:'ease-out' },
      { transform: T+'translate(0,-38px) scale(1.15)', offset:.46, easing:'cubic-bezier(.55,0,.95,.35)' },
      { transform: T+`translate(${dx*.5}px,${dy*.5-50}px) scale(1)`, offset:.76, easing:'cubic-bezier(.6,0,1,.6)' },
      { transform: T+`translate(${dx}px,${dy}px) scale(.35)`, opacity:.95, offset:1 }
    ], { duration:1100, fill:'forwards' }).onfinish = () => {
      el.remove();
      b.animate([{ transform:'scale(1)' }, { transform:'scale(1.25) rotate(-5deg)', offset:.2 },
        { transform:'scale(.9) rotate(2deg)', offset:.48 }, { transform:'scale(1.05)', offset:.74 }, { transform:'scale(1)' }],
        { duration:560, easing:'ease-out' });
      for (let i=0;i<10;i++){
        const s = document.createElement('span'), ang = i/10*Math.PI*2, d = 36 + Math.random()*16;
        Object.assign(s.style, { position:'fixed', left:t.x+'px', top:t.y+'px', width:'7px', height:'7px', borderRadius:'999px',
          background: i%2 ? 'var(--color-accent)' : 'var(--color-accent-2)', zIndex:101, pointerEvents:'none' });
        document.body.appendChild(s);
        s.animate([{ transform:'translate(-50%,-50%) scale(1)', opacity:1 },
          { transform:`translate(-50%,-50%) translate(${Math.cos(ang)*d}px,${Math.sin(ang)*d}px) scale(.2)`, opacity:0 }],
          { duration:520, easing:'cubic-bezier(.2,.8,.3,1)' }).onfinish = () => s.remove();
      }
      count(num, oldTotal, newTotal, 700);
      setTimeout(()=>{ b.animate([{ transform:'none', opacity:1 }, { transform:'scale(.85)', opacity:0 }],
        { duration:280, easing:'ease-in', fill:'forwards' }).onfinish = () => b.remove(); }, 2300);
    };
    // 칩이 떠오른 직후 배지가 '팍' 등장
    setTimeout(()=>{ b.animate([{ transform:'scale(.2)', opacity:0 }, { transform:'scale(1.15)', opacity:1, offset:.6 }, { transform:'scale(1)', opacity:1 }],
      { duration:240, easing:'cubic-bezier(.34,1.56,.64,1)', fill:'forwards' }); }, 300);
  }
  window.gkXp = { run };
})();
