'use client';
// 완료 기록을 읽고 쓰는 곳은 여기 하나뿐입니다.
// 저장 위치는 서버 DB(lesson_progress · study_sessions …)이고, 화면은 이 함수들만 부릅니다.
import { api } from './api';

// 과 메뉴: 과 정보 + 끝낸 학습(["word","gram","sent"] 중)
export const loadLessonProgress = () => api('/api/lesson');

// 과 메뉴 "기록 지우기": 이 과의 완료 기록만
export const clearLessonProgress = () => api('/api/lesson', { method: 'DELETE' });

/**
 * 학습·암기 완료 기록. 서버가 보상을 계산해 돌려줌
 * @param mode   word | gram | sent | review | ox | note
 * @param items  [{ id, type, round?, firstTry }] — 처음 답한 문항마다 한 번
 * @returns { reward: { total, multiplier, reviewBonus, … }, xpBefore, xpAfter, streak }
 */
export const recordCompletion = ({ mode, items, durationSec, ox }) =>
  api('/api/sessions', { method: 'POST', body: { mode, items, durationSec, ox } });
