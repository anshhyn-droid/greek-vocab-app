import { requireLogin } from '@/lib/guard';
import ReviewApp from './ReviewApp';

export default async function Page() {
  await requireLogin();
  return <ReviewApp />;
}
