// Vercel 서버 함수 하나가 /api/* 를 모두 받음 (vercel.json의 rewrites)
import { route } from '../server/router.js';

export const GET = route;
export const POST = route;
export const PATCH = route;
export const PUT = route;
export const DELETE = route;
