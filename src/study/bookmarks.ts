// 책갈피: 누르는 즉시 저장, 다시 누르면 빠짐 (bookmarks 표)
import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';

export type BmType = 'word' | 'gram' | 'sent' | 'concept';
export interface Bookmark { type: BmType; id: string; lesson: number; at: string }

export function useBookmarks() {
  const [list, setList] = useState<Bookmark[]>([]);
  useEffect(() => { api<Bookmark[]>('/api/bookmarks').then(setList).catch(() => {}); }, []);
  const has = useCallback((type: BmType, id: string) => list.some((b) => b.type === type && b.id === id), [list]);
  const toggle = useCallback(async (type: BmType, id: string) => {
    const on = !list.some((b) => b.type === type && b.id === id);
    setList((l) => (on ? [{ type, id, lesson: 0, at: new Date().toISOString() }, ...l] : l.filter((b) => !(b.type === type && b.id === id))));
    try {
      await api('/api/bookmarks', { method: 'POST', body: { type, id } });
    } catch {
      setList((l) => (on ? l.filter((b) => !(b.type === type && b.id === id)) : l)); // 되돌림
    }
  }, [list]);
  return { list, has, toggle };
}
