import { ClipboardCheck, House, UserRound, type LucideIcon } from 'lucide-react';

export type TabKey = 'learn' | 'test' | 'me';

// 책 오른쪽 가죽 탭 / 폰 하단 탭바
export const TABS: { k: TabKey; label: string; to: string; icon: LucideIcon }[] = [
  { k: 'learn', label: '학습', to: '/learn', icon: House },
  { k: 'test', label: '테스트', to: '/test', icon: ClipboardCheck },
  { k: 'me', label: '마이페이지', to: '/me', icon: UserRound },
];

export const tabOf = (pathname: string): TabKey =>
  pathname.startsWith('/test') ? 'test' : pathname.startsWith('/me') ? 'me' : 'learn';
