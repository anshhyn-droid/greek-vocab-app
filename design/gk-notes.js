// 오답 노트 저장소 — 시안은 localStorage "gk_wrong", 실제 구현은 서버 wrong_notes 테이블
// 규칙: 한 번에 못 맞히면 n+1 · ok=0 / 다른 회차에서 한 번에 맞히면 ok+1, 2가 되면 빠짐
// 한 회차 안에서는 문항마다 처음 결과 한 번만 반영. 회차 끝에 다시 나온 문항을 맞힌 것은 세지 않음
// (이전 시안: 재출제 정답이 ok로 세어져 다음 회차 한 번만 맞혀도 빠졌음 → "틀린 문제가 남지 않는" 원인)
(function(){
  const KEY = "gk_wrong";
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch(e){ return {}; } };
  const write = o => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch(e){} };
  const kindOf = k => { const t = String(k).split(":")[0]; return t === "ox" || t === "flash" ? "word" : t; };
  function toast(){ try {
    const el = document.createElement("div");
    el.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round"><path d="M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4"/><path d="M2 6h4"/><path d="M2 10h4"/><path d="M2 14h4"/><path d="M2 18h4"/><path d="M21.4 5.6a2.1 2.1 0 1 0-3-3L13 8l-1 4 4-1Z"/></svg><span>오답 노트에 담았어요</span>';
    el.style.cssText = "position:fixed;left:50%;bottom:16%;z-index:9999;display:flex;align-items:center;gap:8px;padding:11px 20px;border-radius:999px;background:#fbe4e0;color:#9b2f27;font:700 14px 'Pretendard Variable',Pretendard,sans-serif;box-shadow:0 10px 24px -10px rgba(46,43,37,.45);pointer-events:none;transform:translate(-50%,0)";
    document.body.appendChild(el);
    const a = el.animate([{ opacity:0, transform:"translate(-50%,16px)" },{ opacity:1, transform:"translate(-50%,0)", offset:.18 },{ opacity:1, transform:"translate(-50%,-14px)", offset:.62 },{ opacity:0, transform:"translate(-50%,-64px)" }], { duration:1700, easing:"cubic-bezier(.3,.7,.4,1)" });
    a.onfinish = () => el.remove();
  } catch(e){} }
  function session(name, fresh){
    // name: 이어서 하기가 되는 학습 회차 이름. 처음 결과를 본 문항 목록을 저장해 이어서 할 때도 다시 세지 않음
    const SK = name ? "gk_seen_" + name : null; let init = [];
    if (SK) { try { if (fresh) localStorage.removeItem(SK); else init = JSON.parse(localStorage.getItem(SK) || "[]") || []; } catch(e){} }
    const seen = new Set(init);
    const mark = k => { seen.add(k); if (SK) try { localStorage.setItem(SK, JSON.stringify([...seen])); } catch(e){} };
    return {
      wrong(kind, id, lesson){ const k = kind + ":" + id; if (seen.has(k)) return false; mark(k); toast();
        const o = read(), e = o[k]; o[k] = { kind, id, lesson: lesson || 3, n: (e ? e.n : 0) + 1, ok: 0, at: Date.now() }; write(o); return true; },
      right(kind, id){ const k = kind + ":" + id; if (seen.has(k)) return; mark(k);
        const o = read(), e = o[k]; if (!e) return; const ok = (e.ok || 0) + 1;
        if (ok >= 2) delete o[k]; else o[k] = { ...e, ok }; write(o); }
    };
  }
  window.gkNote = { read, write, session, kindOf, remove(k){ const o = read(); delete o[k]; write(o); } };
  // 즐겨찾기 — "gk_favs". 단어는 id 그대로(기존), 문법 "gram:id", 문장 "sent:id", 문법 개념 "concept:키"
  const FK = "gk_favs";
  const fl = () => { try { return JSON.parse(localStorage.getItem(FK) || "[]") || []; } catch(e){ return []; } };
  window.gkFav = { list: fl, has: k => fl().includes(k),
    toggle(k){ const a = fl(), on = a.includes(k), b = on ? a.filter(x => x !== k) : [...a, k]; try { localStorage.setItem(FK, JSON.stringify(b)); } catch(e){} return !on; } };
})();
