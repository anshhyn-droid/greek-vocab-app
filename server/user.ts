// 사용자 설정·날짜 (사용자 시간대 기준 "오늘")
import type { Db } from './db.js';

export async function timezoneOf(db: Db, userId: string): Promise<string> {
  return (await db.get<{ timezone: string }>('SELECT timezone FROM user_settings WHERE user_id = ?', userId))?.timezone || 'Asia/Seoul';
}

// YYYY-MM-DD. 날짜는 서버가 정함(기기 시계를 바꿔도 영향 없음)
export function localDate(tz: string, at = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
  } catch {
    return at.toISOString().slice(0, 10);
  }
}

export const STUDY_TYPES = ['word', 'gram', 'sent'] as const;
export type StudyType = (typeof STUDY_TYPES)[number];
