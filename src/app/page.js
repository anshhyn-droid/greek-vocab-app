"use client";

import { useEffect, useState, useRef } from "react";
import { Signal, Wifi, BatteryMedium, ArrowLeft, Timer, Circle, X, PartyPopper, Volume2, Volume1 } from "lucide-react";

const SHOW_SEC = 1.5;

export default function Lesson3Page() {
  const [words, setWords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // States from Component logic
  const [round, setRound] = useState(1);
  const [queue, setQueue] = useState([]);
  const [cleared, setCleared] = useState(0);
  const [phase, setPhase] = useState("loading"); // loading, show, quiz, end
  const [sec, setSec] = useState(SHOW_SEC);
  const [pick, setPick] = useState(null);
  const [wrongs, setWrongs] = useState([]);
  const [flash, setFlash] = useState(null);
  const [order, setOrder] = useState([]);
  const [miss, setMiss] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);

  const timerRef = useRef(null);
  const audioTimerRef = useRef(null);

  useEffect(() => {
    fetchWords();
    return () => {
      clearInterval(timerRef.current);
      clearTimeout(audioTimerRef.current);
    };
  }, []);

  const fetchWords = async () => {
    try {
      const res = await fetch("/api/words");
      if (!res.ok) throw new Error("Failed to fetch words");
      const data = await res.json();
      setWords(data);
      restart(data);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const restart = (data = words) => {
    setRound(1);
    setQueue(data.map((_, i) => i)); 
    setCleared(0);
    setMiss(0);
    setStartTime(Date.now());
    setTime(0);
    startWord(1, data.map((_, i) => i), data);
  };

  const startWord = (currentRound, currentQueue, data = words) => {
    clearInterval(timerRef.current);
    const w = data[currentQueue[0]];
    const r2 = currentRound === 2;
    
    setPhase(r2 ? "quiz" : "show");
    setSec(r2 ? 0 : SHOW_SEC);
    setPick(null);
    setWrongs([]);
    setFlash(null);
    setOrder(w ? w.ch : []);

    if (r2) return;
    
    timerRef.current = setInterval(() => {
      setSec((prev) => {
        const nextSec = Math.round((prev - 0.5) * 10) / 10;
        if (nextSec <= 0) {
          clearInterval(timerRef.current);
          setPhase("quiz");
          return 0;
        }
        return nextSec;
      });
    }, 500);
  };

  const answer = (t, right) => {
    if (pick || wrongs.includes(t)) return;
    
    if (right) {
      clearInterval(timerRef.current);
      setPick(t);
      return;
    }
    
    setWrongs((prev) => [...prev, t]);
    setFlash(t);
    setMiss((prev) => prev + 1);
    setTimeout(() => {
      setFlash((prevFlash) => (prevFlash === t ? null : prevFlash));
    }, 500);
  };

  const next = () => {
    const q = [...queue];
    const cur = q.shift();
    const failed = wrongs.length > 0;
    
    if (failed) q.push(cur);
    const newCleared = failed ? cleared : cleared + 1;
    
    if (q.length === 0) {
      clearInterval(timerRef.current);
      if (round === 1) {
        setRound(2);
        const newQueue = [...Array(words.length).keys()].sort(() => Math.random() - 0.5);
        setQueue(newQueue);
        setCleared(0);
        startWord(2, newQueue);
        return;
      }
      setQueue(q);
      setCleared(newCleared);
      setPhase("end");
      setTime(Math.max(1, Math.round((Date.now() - startTime) / 1000)));
      return;
    }
    
    setQueue(q);
    setCleared(newCleared);
    startWord(round, q);
  };

  const playAudio = () => {
    clearTimeout(audioTimerRef.current);
    setPlaying(true);
    audioTimerRef.current = setTimeout(() => {
      setPlaying(false);
    }, 1100);
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (words.length === 0) return <div>No words available.</div>;

  const w = words[queue[0]] || words[0];
  const tot = words.length * 2;
  const pct = Math.max(0, Math.round(((tot - miss) / tot) * 100));

  const prog = phase === "end" ? "100%" : Math.round((((round - 1) * words.length + cleared) / tot) * 100) + "%";

  const stats = [
    { k: "정답률", v: pct + "%", fg: pct >= 90 ? "var(--sage-ink)" : "var(--ink)" },
    { k: "소요 시간", v: Math.floor(time / 60) + ":" + String(time % 60).padStart(2, "0"), fg: "var(--ink)" },
    { k: "획득 XP", v: "+" + (tot * 2 + (pct >= 90 ? 10 : 0)), fg: "var(--accent-ink)" }
  ];

  return (
    <div className="ws-theme" style={{
      width: 390, height: 844, borderRadius: 46, overflow: "hidden", position: "relative",
      background: "var(--ground)", color: "var(--ink)", display: "flex", flexDirection: "column",
      boxShadow: "0 30px 60px -30px rgba(32,30,29,.45)"
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 28px 6px", font: "700 13px 'Figtree', sans-serif" }}>
        <span>9:41</span>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span className="ic" style={{ width: 14, height: 14 }}><Signal size={14} /></span>
          <span className="ic" style={{ width: 14, height: 14 }}><Wifi size={14} /></span>
          <span className="ic" style={{ width: 18, height: 18 }}><BatteryMedium size={18} /></span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 22px 4px" }}>
        <span onClick={() => restart()} className="ic" title="처음부터" style={{ width: 22, height: 22, cursor: "pointer", color: "var(--muted)" }}>
          <ArrowLeft size={22} />
        </span>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ font: "800 10.5px 'Noto Sans KR', sans-serif", letterSpacing: ".08em", color: "var(--accent-ink)" }}>
            3과 · 명사 2변화
          </span>
          <span style={{ fontFamily: "'Caprasimo', serif", fontSize: 20, color: "var(--ink)" }}>
            단어 · {round === 2 ? "확인하기" : "익히기"}
          </span>
        </div>
        <span style={{ padding: "6px 12px", borderRadius: 999, background: "var(--accent-soft)", border: "1.5px solid var(--bd-cur)", font: "800 11.5px 'Figtree', sans-serif", color: "var(--accent-ink)" }}>
          {round} / 2
        </span>
      </div>

      <div style={{ margin: "10px 22px 4px", height: 9, borderRadius: 999, background: "var(--line)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: prog, borderRadius: 999, background: "var(--accent)", transition: "width .3s" }}></div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "18px 22px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
        
        {phase !== "end" && (
          <div style={{ position: "relative", padding: "44px 18px", borderRadius: 26, background: "var(--card)", border: "1.5px solid var(--line)", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, minHeight: 150, justifyContent: "center" }}>
            <span onClick={playAudio} className="ic" style={{ position: "absolute", top: 13, left: 14, width: 20, height: 20, cursor: "pointer", color: playing ? "var(--accent)" : "var(--muted)", transform: `scale(${playing ? 1.18 : 1})`, transition: "transform .18s, color .18s" }}>
              {playing ? <Volume2 size={20} /> : <Volume1 size={20} />}
            </span>
            
            {phase === "show" && (
              <span style={{ position: "absolute", top: 12, right: 14, display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 999, background: "var(--accent-soft)", border: "1.5px solid var(--bd-cur)", color: "var(--accent-ink)", font: "800 11.5px 'Figtree', sans-serif" }}>
                <span className="ic" style={{ width: 12, height: 12 }}><Timer size={12} /></span>
                {Math.ceil(sec)}s
              </span>
            )}

            <span className="gk" style={{ fontSize: 42, lineHeight: 1.1, fontWeight: 700, color: "var(--ink)" }}>{w.g}</span>
            
            {phase === "show" && (
              <span style={{ font: "600 14px 'Noto Sans KR', sans-serif", color: "var(--muted)" }}>{w.m}</span>
            )}
          </div>
        )}

        {phase === "quiz" && (
          <div className="pop-anim" style={{ display: "flex", flexDirection: "column", gap: 11 }}>
            <span style={{ textAlign: "center", font: "600 12.5px 'Noto Sans KR', sans-serif", color: "var(--muted)" }}>
              {round === 2 ? "뜻 없이 단어만 보고 고르세요" : "알맞은 뜻을 고르세요"} · {queue.length}개 남음
            </span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {order.map((t, idx) => {
                const right = t === w.m;
                const ok = right && pick === t;
                const isFlash = flash === t;
                const dead = wrongs.includes(t) && !isFlash;
                
                const bg = ok ? "var(--tile-done)" : isFlash ? "var(--wrong-soft)" : "var(--tile)";
                const bd = ok ? "var(--bd-done)" : isFlash ? "var(--wrong)" : "var(--line)";
                const fg = ok ? "var(--sage-ink)" : isFlash ? "var(--wrong-ink)" : dead ? "var(--muted)" : "var(--ink)";
                const markc = isFlash ? "var(--wrong)" : "var(--muted)";
                const op = dead ? 0.45 : 1;
                const cur = dead ? "default" : "pointer";

                return (
                  <div key={idx} onClick={() => answer(t, right)} style={{ padding: "16px 10px", borderRadius: 20, textAlign: "center", position: "relative", transition: "background .18s, border-color .18s, color .18s", font: "700 14px 'Noto Sans KR', sans-serif", background: bg, border: `1.5px solid ${bd}`, color: fg, opacity: op, cursor: cur }}>
                    {t}
                    {ok && <span className="ic" style={{ width: 16, height: 16, position: "absolute", top: 9, right: 10, color: "var(--sage)" }}><Circle size={16} /></span>}
                    {(isFlash || dead) && <span className="ic" style={{ width: 16, height: 16, position: "absolute", top: 9, right: 10, color: markc }}><X size={16} /></span>}
                  </div>
                );
              })}
            </div>
            {!!pick && (
              <>
                <div style={{ padding: "13px 16px", borderRadius: 22, background: "var(--tile-done)", border: "1.5px solid var(--bd-done)", font: "400 12.5px/1.6 'Noto Sans KR', sans-serif", color: "var(--ink)" }}>
                  <b style={{ color: "var(--sage-ink)" }}>정답이에요</b> · <span className="gk" style={{ fontWeight: 700 }}>{w.g}</span> — {w.m}
                </div>
                <div onClick={next} style={{ padding: 14, borderRadius: 999, background: "var(--btn)", color: "var(--on-accent)", textAlign: "center", font: "800 14px 'Noto Sans KR', sans-serif", cursor: "pointer" }}>
                  다음 단어
                </div>
              </>
            )}
          </div>
        )}

        {phase === "end" && (
          <div className="pop-anim" style={{ padding: "26px 20px", borderRadius: 26, background: "var(--tile-done)", border: "1.5px solid var(--bd-done)", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center" }}>
            <span className="ic" style={{ width: 30, height: 30, color: "var(--sage)" }}><PartyPopper size={30} /></span>
            <span style={{ font: "700 15px 'Noto Sans KR', sans-serif" }}>단어를 모두 맞혔어요</span>
            <span style={{ font: "400 12.5px/1.6 'Noto Sans KR', sans-serif", color: "var(--muted)" }}>
              익히기·확인하기 두 라운드를 모두 통과했습니다
            </span>
            <div style={{ marginTop: 10, width: "100%", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {stats.map((r, i) => (
                <div key={i} style={{ padding: "12px 8px", borderRadius: 20, background: "var(--card)", border: "1.5px solid var(--line)", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                  <span style={{ font: "800 16px 'Figtree', sans-serif", color: r.fg, fontVariantNumeric: "tabular-nums" }}>{r.v}</span>
                  <span style={{ font: "700 10px 'Noto Sans KR', sans-serif", color: "var(--muted)" }}>{r.k}</span>
                </div>
              ))}
            </div>
            <div onClick={() => restart()} style={{ marginTop: 18, padding: "12px 24px", borderRadius: 999, background: "var(--btn)", color: "var(--on-accent)", font: "800 13.5px 'Noto Sans KR', sans-serif", cursor: "pointer", width: "100%" }}>
              다시 하기
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
