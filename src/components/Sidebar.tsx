'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  const menuItems = [
    {
      title: 'Content',
      items: [
        { name: 'New post', path: '/dashboard', icon: '📝' },
        { name: 'Scheduled', path: '/scheduled', icon: '🕒' },
        { name: 'Posts', path: '/posts', icon: '📚' },
        { name: 'Studio', path: '/studio', icon: '🎨' },
      ],
    },
    {
      title: 'Configuration',
      items: [
        { name: 'Accounts', path: '/accounts', icon: '👥' },
      ],
    },
  ];

  return (
    <div className="w-64 bg-white h-screen flex flex-col border-r border-gray-200">
      <div className="p-4">
        <Link href="/dashboard" className="flex items-center space-x-2">
          <span className="text-xl font-bold">MultiPost</span>
        </Link>
      </div>

      <button className="mx-4 mb-6 bg-[#3DDC84] hover:bg-[#32B76C] text-white px-4 py-2 rounded-md flex items-center justify-center space-x-2">
        <span>+ Create post</span>
      </button>

      <div className="flex-1 overflow-y-auto">
        {menuItems.map((section) => (
          <div key={section.title} className="mb-6">
            <h3 className="px-4 mb-2 text-sm font-medium text-gray-500">
              {section.title}
            </h3>
            <ul>
              {section.items.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.path}
                    className={`flex items-center space-x-2 px-4 py-2 text-sm ${
                      pathname === item.path
                        ? 'bg-gray-100 text-gray-900'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span>{item.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center space-x-2 text-sm">
          <div className="w-8 h-8 bg-[#3DDC84] rounded-full flex items-center justify-center text-white">
            {user?.email?.[0].toUpperCase()}
          </div>
          <div className="flex-1">
            <p className="text-xs text-gray-500">Free Plan</p>
          </div>
        </div>
      </div>
    </div>
  );
}
