// 자동 로그아웃 — 시안은 localStorage로 흉내. 실제는 서버 세션의 유휴 만료로 판단하고 화면은 안내만 함
// 하루(24시간) 동안 사용하지 않으면 로그아웃. 사용자 설정 없음
// 남은 시간이 1분이 되면 안내 창 → "계속 사용하기"를 누르면 연장, 그대로 두면 로그아웃 후 시작 화면에서 이유를 알려 줌
(function(){
  const LAST = "gk_last_active", USER = "gk_user", PREF = "gk_prefs", REASON = "gk_logout_reason";
  const get = k => { try { return localStorage.getItem(k); } catch(e){ return null; } };
  const set = (k, v) => { try { localStorage.setItem(k, v); } catch(e){} };
  const minutes = () => 1440;
  const limitMs = () => get("gk_idle_demo") === "1" ? 40000 : minutes() * 60000; // 시연용: 40초
  let box = null;
  const stamp = () => set(LAST, String(Date.now()));
  const touch = () => { if (!box) stamp(); };

  function warn(left){
    if (!box) {
      box = document.createElement("div");
      Object.assign(box.style, { position:"fixed", inset:"0", zIndex:200, background:"rgba(32,30,29,.45)", display:"flex", alignItems:"center", justifyContent:"center", padding:"24px" });
      box.innerHTML =
        '<div role="alertdialog" aria-live="assertive" style="width:100%;max-width:380px;box-sizing:border-box;padding:26px 24px 20px;border-radius:30px;background:#fffaf1;border:1.5px solid #e8dcc6;box-shadow:0 24px 50px -24px rgba(32,30,29,.55);display:flex;flex-direction:column;gap:12px;font-family:\'Gentium Greek\',\'Hahmlet\',serif">'
        + '<span style="width:44px;height:44px;border-radius:999px;background:#ffe1d0;color:#8c491a;display:flex;align-items:center;justify-content:center;font:700 16px \'Pretendard Variable\',Pretendard,sans-serif" data-left-badge>60</span>'
        + '<span style="font-family:\'Gentium Greek\',Hahmlet,serif;font-weight:700;font-size:20px;color:#201e1d">곧 자동으로 로그아웃됩니다</span>'
        + '<span style="font:500 14px/1.6 \'Gentium Greek\',\'Pretendard Variable\',Pretendard,sans-serif;color:oklch(.455 .018 45);word-break:keep-all">한동안 사용하지 않아 <b data-left style="color:#8c491a">60초</b> 뒤 로그아웃됩니다. 풀던 문제는 저장되지 않습니다.</span>'
        + '<div style="display:flex;gap:9px;margin-top:6px">'
        + '<button data-stay style="flex:1.4;cursor:pointer;padding:13px;border:0;border-radius:999px;background:#a85c2b;color:#fffaf1;font:700 14px \'Gentium Greek\',\'Pretendard Variable\',Pretendard,sans-serif">계속 사용하기</button>'
        + '<button data-out style="flex:1;cursor:pointer;padding:13px;border-radius:999px;border:1.5px solid #e8dcc6;background:transparent;color:oklch(.455 .018 45);font:700 14px \'Gentium Greek\',\'Pretendard Variable\',Pretendard,sans-serif">로그아웃</button>'
        + '</div></div>';
      box.querySelector("[data-stay]").onclick = () => { close(); stamp(); };
      box.querySelector("[data-out]").onclick = () => logout("manual");
      document.body.appendChild(box);
      box.querySelector("[data-stay]").focus();
    }
    box.querySelector("[data-left]").textContent = left + "초";
    box.querySelector("[data-left-badge]").textContent = left;
  }
  function close(){ if (box) { box.remove(); box = null; } }
  function logout(reason){
    close();
    // 로그아웃하면 기기에 남은 학습 데이터를 모두 지움 (시연 설정만 남김)
    try { Object.keys(localStorage).filter(k => k.indexOf("gk_") === 0 && k !== "gk_idle_demo").forEach(k => localStorage.removeItem(k)); } catch(e){}
    if (reason === "idle") set(REASON, "idle:" + minutes()); else if (reason) set(REASON, reason);
    location.href = "Start.dc.html";
  }
  function tick(){
    if (!get(USER)) { close(); return; }
    const limit = limitMs(), last = +get(LAST) || Date.now(), left = Math.ceil((limit - (Date.now() - last)) / 1000);
    if (left <= 0) { logout("idle"); return; }
    if (left <= Math.min(60, Math.floor(limit / 2000))) warn(left); else close();
  }
  ["pointerdown", "keydown", "wheel", "touchstart"].forEach(e => window.addEventListener(e, touch, { passive:true }));
  // 글자 크기(마이페이지): 보통 · 크게 · 아주 크게 → 화면 전체 배율
  function applySize(){ try { const p=JSON.parse(get(PREF)||"{}"), z={ m:1, l:1.08, xl:1.16 }[p.gk]||1; document.documentElement.style.zoom = z===1 ? "" : String(z); } catch(e){} }
  applySize(); window.gkApplySize = applySize;
  stamp();
  setInterval(tick, 1000);
  window.gkIdle = { touch: stamp, minutes, logout };
})();
