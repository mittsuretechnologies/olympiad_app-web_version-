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
  BarChart2,
  Building2,
  Trophy,
} from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  type Section = 'schools' | 'uploaders' | 'credentials' | 'moderation' | 'reports' | null;

  const sectionForPath = (p: string): Section => {
    if (p.startsWith('/dashboard/schools')) return 'schools';
    if (p.startsWith('/dashboard/uploaders')) return 'uploaders';
    if (p.startsWith('/dashboard/credentials/registered')) return 'reports';
    if (p.startsWith('/dashboard/credentials')) return 'credentials';
    if (p.startsWith('/dashboard/videos')) return 'moderation';
    if (p.startsWith('/dashboard/reports')) return 'reports';
    if (p.startsWith('/dashboard/app-users')) return 'reports';
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
  const reportsOpen = openSection === 'reports';

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
    { name: 'Manage School Credentials',   href: '/dashboard/credentials/schools',   icon: Users },
    { name: 'Manage Uploader Credentials', href: '/dashboard/credentials/uploaders', icon: UploadCloud },
    { name: 'Manage Student Credentials',  href: '/dashboard/credentials/students',  icon: KeyRound },
  ];

  const reportsSubItems = [
    { name: 'Student Report',         href: '/dashboard/credentials/registered-students', icon: UserCheck },
    { name: 'Olympiad Completions',   href: '/dashboard/reports/olympiad-completions',    icon: Trophy },
    { name: 'School Report',          href: '/dashboard/reports/schools',                 icon: Building2 },
    { name: 'App Users',              href: '/dashboard/app-users',                       icon: Smartphone },
  ];

  return (
    <div className="flex min-h-screen bg-[#F0F2F5] text-[#1F2937]">

      {/* Sidebar */}
      <aside
        style={{ scrollbarGutter: 'stable' }}
        className="w-72 bg-[#052E5C] flex flex-col fixed h-screen z-50 border-r border-[#04203f] overflow-x-hidden overflow-y-hidden hover:overflow-y-auto custom-scrollbar"
      >
        {/* Banner Card â€” centered white card floating on the blue sidebar */}
        <div className="relative px-4 pt-5 pb-2">
          <div className="relative w-full aspect-[16/10] overflow-hidden rounded-2xl bg-white shadow-lg shadow-black/20">
            <Image
              src="/banner.webp"
              alt="Kids Celebration"
              fill
              sizes="280px"
              className="object-cover object-center"
              priority
            />
          </div>
          {/* Mittsure Logo Overlay */}
          <div className="absolute top-[2px] right-[6px] h-16 w-32">
            <Image
              src="/logo-color.webp"
              alt="Mittsure Logo"
              fill
              className="object-contain"
            />
          </div>
        </div>

        <div className="p-4 pt-6 pb-2">
          <p className="px-4 text-[11px] font-bold text-blue-200/70 uppercase tracking-wider mb-2">
            Main Menu
          </p>
        </div>

        <div className="px-4 flex flex-col flex-1">
          <nav className="flex-1 space-y-2">
            {/* Dashboard Link */}
            <Link
              href="/dashboard"
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 group ${pathname === '/dashboard'
                ? 'bg-[#009846] text-white font-semibold'
                : 'text-blue-100 hover:bg-white/10 hover:text-white'
                }`}
            >
              <LayoutDashboard size={20} />
              <span className="text-sm font-semibold">Dashboard</span>
            </Link>

            {/* School Management - Expandable */}
            <div>
              <button
                onClick={() => toggleSection('schools')}
                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all duration-200 group ${pathname.startsWith('/dashboard/schools')
                  ? 'bg-[#009846] text-white font-semibold'
                  : 'text-blue-100 hover:bg-white/10 hover:text-white'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <School size={20} />
                  <span className="text-sm font-semibold">Schools</span>
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
                <div className="ml-6 pl-4 border-l border-white/15 space-y-1 my-1">
                  {schoolSubItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={`flex items-center px-2 py-2 rounded-lg transition-all duration-200 text-[12.5px] whitespace-nowrap ${isActive
                          ? 'bg-white text-[#004f9f] font-semibold'
                          : 'text-blue-200 hover:bg-white/10 hover:text-white'
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
                  ? 'bg-[#009846] text-white font-semibold'
                  : 'text-blue-100 hover:bg-white/10 hover:text-white'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <Play size={20} />
                  <span className="text-sm font-semibold">Moderation</span>
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
                <div className="ml-6 pl-4 border-l border-white/15 space-y-1 my-1">
                  {moderationSubItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={`flex items-center px-2 py-2 rounded-lg transition-all duration-200 text-[12.5px] whitespace-nowrap ${isActive
                          ? 'bg-white text-[#004f9f] font-semibold'
                          : 'text-blue-200 hover:bg-white/10 hover:text-white'
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
                  ? 'bg-[#009846] text-white font-semibold'
                  : 'text-blue-100 hover:bg-white/10 hover:text-white'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <UploadCloud size={20} />
                  <span className="text-sm font-semibold">Uploaders</span>
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
                <div className="ml-6 pl-4 border-l border-white/15 space-y-1 my-1">
                  {uploaderSubItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={`flex items-center px-2 py-2 rounded-lg transition-all duration-200 text-[12.5px] whitespace-nowrap ${isActive
                          ? 'bg-white text-[#004f9f] font-semibold'
                          : 'text-blue-200 hover:bg-white/10 hover:text-white'
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
                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all duration-200 group ${pathname.startsWith('/dashboard/credentials') && !pathname.startsWith('/dashboard/credentials/registered')
                  ? 'bg-[#009846] text-white font-semibold'
                  : 'text-blue-100 hover:bg-white/10 hover:text-white'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <KeyRound size={20} />
                  <span className="text-sm font-semibold">Credentials</span>
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
                <div className="ml-6 pl-4 border-l border-white/15 space-y-1 my-1">
                  {credentialsSubItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={`flex items-center px-2 py-2 rounded-lg transition-all duration-200 text-[12.5px] whitespace-nowrap ${isActive
                          ? 'bg-white text-[#004f9f] font-semibold'
                          : 'text-blue-200 hover:bg-white/10 hover:text-white'
                          }`}
                      >
                        <span>{item.name}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Reports - Expandable */}
            <div>
              <button
                onClick={() => toggleSection('reports')}
                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all duration-200 group ${pathname.startsWith('/dashboard/reports') || pathname.startsWith('/dashboard/credentials/registered') || pathname.startsWith('/dashboard/app-users')
                  ? 'bg-[#009846] text-white font-semibold'
                  : 'text-blue-100 hover:bg-white/10 hover:text-white'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <BarChart2 size={20} />
                  <span className="text-sm font-semibold">Reports</span>
                </div>
                <ChevronDown
                  size={16}
                  className={`transition-transform duration-200 ${reportsOpen ? 'rotate-180' : ''}`}
                />
              </button>
              <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${reportsOpen ? 'max-h-60 opacity-100 mt-1' : 'max-h-0 opacity-0'}`}
              >
                <div className="ml-6 pl-4 border-l border-white/15 space-y-1 my-1">
                  {reportsSubItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={`flex items-center px-2 py-2 rounded-lg transition-all duration-200 text-[12.5px] whitespace-nowrap ${isActive
                          ? 'bg-white text-[#004f9f] font-semibold'
                          : 'text-blue-200 hover:bg-white/10 hover:text-white'
                          }`}
                      >
                        <span>{item.name}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>

          </nav>

          {/* Logout Section */}
          <div className="mt-auto py-8">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 text-red-300 hover:bg-red-500/20 hover:text-red-200 rounded-xl transition-colors font-medium text-sm"
            >
              <LogOut size={18} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-72 min-h-screen relative px-8 pt-3 pb-8">
        {children}
      </main>
    </div>
  );
}

