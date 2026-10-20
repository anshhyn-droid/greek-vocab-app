// 접속 기록 (보안·개인정보 명세 6-10). 이메일 등은 남기지 않고, IP는 뒷부분을 가림. 3개월 뒤 삭제
import { headers } from 'next/headers';
import { getDb } from './db';

const KEEP_DAYS = 90;

// 1.2.3.4 → 1.2.*.* / IPv6는 앞 세 묶음만
export function maskIp(ip) {
  if (!ip) return 'unknown';
  if (ip.includes('.')) return ip.split('.').slice(0, 2).join('.') + '.*.*';
  return ip.split(':').slice(0, 3).join(':') + ':*';
}

// 브라우저·OS 이름 정도만
export function clientOf(ua) {
  if (!ua) return null;
  const browser = /Edg\//.test(ua) ? 'Edge' : /SamsungBrowser/.test(ua) ? 'Samsung' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Other';
  const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'Other';
  return browser + ' / ' + os;
}

// event: login / logout / idle_logout / withdraw / reset. db를 넘기면 그 트랜잭션 안에서 씀
export async function logAccess(event, userId, db) {
  const h = await headers();
  const ip = (h.get('x-forwarded-for') || '').split(',')[0].trim() || h.get('x-real-ip') || '';
  db ||= await getDb();
  await db.run('INSERT INTO access_logs (user_id, event, ip_masked, client) VALUES (?, ?, ?, ?)', userId, event, maskIp(ip), clientOf(h.get('user-agent')));
}

export async function purgeOldLogs() {
  await (await getDb()).run(`DELETE FROM access_logs WHERE at < datetime('now', '-${KEEP_DAYS} days')`);
}
