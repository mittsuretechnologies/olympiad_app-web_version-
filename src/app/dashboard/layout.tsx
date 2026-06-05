'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  School,
  LogOut,
  ChevronDown,
  PlusCircle,
  FileSpreadsheet,
  Eye,
  LayoutDashboard,
  KeyRound,
  Users,
  UploadCloud,
  UserPlus,
  UserCheck,
  Play,
  Clock,
  Smartphone,
} from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  type Section = 'schools' | 'uploaders' | 'credentials' | 'moderation' | null;

  const sectionForPath = (p: string): Section => {
    if (p.startsWith('/dashboard/schools')) return 'schools';
    if (p.startsWith('/dashboard/uploaders')) return 'uploaders';
    if (p.startsWith('/dashboard/credentials')) return 'credentials';
    if (p.startsWith('/dashboard/videos')) return 'moderation';
    return 'schools';
  };

  const [openSection, setOpenSection] = useState<Section>(sectionForPath(pathname));

  const toggleSection = (s: Exclude<Section, null>) => {
    setOpenSection((cur) => (cur === s ? null : s));
  };

  const schoolsOpen = openSection === 'schools';
  const uploadersOpen = openSection === 'uploaders';
  const credentialsOpen = openSection === 'credentials';
  const moderationOpen = openSection === 'moderation';

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/login');
  };

  const moderationSubItems = [
    { name: 'Pending Approvals', href: '/dashboard/videos', icon: Clock },
    // Later we can add 'All Archive', 'Flagged', etc.
  ];

  const schoolSubItems = [
    { name: 'Register School', href: '/dashboard/schools/register', icon: PlusCircle },
    { name: 'Bulk Upload', href: '/dashboard/schools/bulk', icon: FileSpreadsheet },
    { name: 'View / Edit Schools', href: '/dashboard/schools', icon: Eye },
  ];

  const uploaderSubItems = [


    { name: 'Register Uploader', href: '/dashboard/uploaders/register', icon: UserPlus },
    { name: 'View / Manage Uploaders', href: '/dashboard/uploaders', icon: Eye },
  ];


  const credentialsSubItems = [
    { name: 'Manage School Credentials',   href: '/dashboard/credentials/schools',             icon: Users },
    { name: 'Manage Uploader Credentials', href: '/dashboard/credentials/uploaders',           icon: UploadCloud },
    { name: 'Manage Student Credentials',  href: '/dashboard/credentials/students',            icon: KeyRound },
    { name: 'Registered Students',         href: '/dashboard/credentials/registered-students', icon: UserCheck },
  ];

  return (
    <div className="flex min-h-screen bg-[#F0F2F5] text-[#1F2937]">

      {/* Sidebar */}
      <aside 
        style={{ scrollbarGutter: 'stable' }}
        className="w-72 bg-white flex flex-col fixed h-screen z-50 border-r border-gray-200 overflow-x-hidden overflow-y-hidden hover:overflow-y-auto custom-scrollbar"
      >
        {/* Banner Card */}
        <div className="relative w-full aspect-[16/10]">
          <Image
            src="/5852.jpg"
            alt="Kids Celebration"
            fill
            className="object-cover"
            priority
          />
          {/* Mittsure Logo Overlay */}
          <div className="absolute top-[-17px] right-[-13px] h-20 w-40">
            <Image
              src="/Mittsure_LOGO_updated_page-0001-removebg-preview.png"
              alt="Mittsure Logo"
              fill
              className="object-contain"
            />
          </div>
        </div>

        <div className="p-4 pt-6 pb-2">
          <p className="px-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
            Main Menu
          </p>
        </div>

        <div className="px-4 flex flex-col flex-1">
          <nav className="flex-1 space-y-2">
            {/* Dashboard Link */}
            <Link
              href="/dashboard"
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 group ${pathname === '/dashboard'
                ? 'bg-[#E9FCD4] text-black font-semibold'
                : 'text-gray-500 hover:bg-gray-50 hover:text-black'
                }`}
            >
              <LayoutDashboard size={20} />
              <span className="text-sm">Dashboard</span>
            </Link>

            {/* School Management - Expandable */}
            <div>
              <button
                onClick={() => toggleSection('schools')}
                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all duration-200 group ${pathname.startsWith('/dashboard/schools')
                  ? 'text-black font-semibold'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-black'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <School size={20} />
                  <span className="text-sm">Schools</span>
                </div>
                <ChevronDown
                  size={16}
                  className={`transition-transform duration-200 ${schoolsOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {/* Sub Items */}
              <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${schoolsOpen ? 'max-h-80 opacity-100 mt-1' : 'max-h-0 opacity-0'
                  }`}
              >
                <div className="ml-6 pl-4 border-l border-gray-200 space-y-1 my-1">
                  {schoolSubItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={`flex items-center px-2 py-2 rounded-lg transition-all duration-200 text-[12.5px] whitespace-nowrap ${isActive
                          ? 'bg-[#E9FCD4] text-black font-semibold'
                          : 'text-gray-500 hover:text-black'
                          }`}
                      >
                        <span>{item.name}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Moderation - Expandable */}
            <div>
              <button
                onClick={() => toggleSection('moderation')}
                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all duration-200 group ${pathname.startsWith('/dashboard/videos')
                  ? 'text-black font-semibold'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-black'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <Play size={20} />
                  <span className="text-sm">Moderation</span>
                </div>
                <ChevronDown
                  size={16}
                  className={`transition-transform duration-200 ${moderationOpen ? 'rotate-180' : ''}`}
                />
              </button>

              <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${moderationOpen ? 'max-h-60 opacity-100 mt-1' : 'max-h-0 opacity-0'
                  }`}
              >
                <div className="ml-6 pl-4 border-l border-gray-200 space-y-1 my-1">
                  {moderationSubItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={`flex items-center px-2 py-2 rounded-lg transition-all duration-200 text-[12.5px] whitespace-nowrap ${isActive
                          ? 'bg-[#E9FCD4] text-black font-semibold'
                          : 'text-gray-500 hover:text-black'
                          }`}
                      >
                        <span>{item.name}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Uploaders - Expandable */}
            <div>
              <button
                onClick={() => toggleSection('uploaders')}
                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all duration-200 group ${pathname.startsWith('/dashboard/uploaders')
                  ? 'text-black font-semibold'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-black'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <UploadCloud size={20} />
                  <span className="text-sm">Uploaders</span>
                </div>
                <ChevronDown
                  size={16}
                  className={`transition-transform duration-200 ${uploadersOpen ? 'rotate-180' : ''}`}
                />
              </button>

              <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${uploadersOpen ? 'max-h-60 opacity-100 mt-1' : 'max-h-0 opacity-0'
                  }`}
              >
                <div className="ml-6 pl-4 border-l border-gray-200 space-y-1 my-1">
                  {uploaderSubItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={`flex items-center px-2 py-2 rounded-lg transition-all duration-200 text-[12.5px] whitespace-nowrap ${isActive
                          ? 'bg-[#E9FCD4] text-black font-semibold'
                          : 'text-gray-500 hover:text-black'
                          }`}
                      >
                        <span>{item.name}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>


            {/* Credentials - Expandable */}
            <div>
              <button
                onClick={() => toggleSection('credentials')}
                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all duration-200 group ${pathname.startsWith('/dashboard/credentials')
                  ? 'text-black font-semibold'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-black'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <KeyRound size={20} />
                  <span className="text-sm">Credentials</span>
                </div>
                <ChevronDown
                  size={16}
                  className={`transition-transform duration-200 ${credentialsOpen ? 'rotate-180' : ''}`}
                />
              </button>

              <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${credentialsOpen ? 'max-h-96 opacity-100 mt-1' : 'max-h-0 opacity-0'
                  }`}
              >
                <div className="ml-6 pl-4 border-l border-gray-200 space-y-1 my-1">
                  {credentialsSubItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={`flex items-center px-2 py-2 rounded-lg transition-all duration-200 text-[12.5px] whitespace-nowrap ${isActive
                          ? 'bg-[#E9FCD4] text-black font-semibold'
                          : 'text-gray-500 hover:text-black'
                          }`}
                      >
                        <span>{item.name}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* App Users */}
            <Link
              href="/dashboard/app-users"
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 group ${pathname === '/dashboard/app-users'
                ? 'bg-[#E9FCD4] text-black font-semibold'
                : 'text-gray-500 hover:bg-gray-50 hover:text-black'
                }`}
            >
              <Smartphone size={20} />
              <span className="text-sm">App Users</span>
            </Link>

          </nav>

          {/* Logout Section */}
          <div className="mt-auto py-8">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors font-medium text-sm"
            >
              <LogOut size={18} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-72 min-h-screen relative p-8">
        {children}
      </main>
    </div>
  );
}
