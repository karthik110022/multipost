import { Suspense } from 'react';
import DashboardClient from '@/components/dashboard/DashboardClient';

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#3DDC84]"></div>
      </div>
    }>
      <DashboardClient />
    </Suspense>
  );
}
