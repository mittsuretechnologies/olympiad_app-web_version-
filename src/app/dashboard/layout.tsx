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
  Hash,
  UploadCloud,
  UserPlus,
  GraduationCap,
} from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  type Section = 'schools' | 'uploaders' | 'students' | 'credentials' | null;

  const sectionForPath = (p: string): Section => {
    if (p.startsWith('/dashboard/schools')) return 'schools';
    if (p.startsWith('/dashboard/uploaders')) return 'uploaders';
    if (p.startsWith('/dashboard/students')) return 'students';
    if (p.startsWith('/dashboard/credentials')) return 'credentials';
    return 'schools';
  };

  const [openSection, setOpenSection] = useState<Section>(sectionForPath(pathname));

  const toggleSection = (s: Exclude<Section, null>) => {
    setOpenSection((cur) => (cur === s ? null : s));
  };

  const schoolsOpen = openSection === 'schools';
  const uploadersOpen = openSection === 'uploaders';
  const studentsOpen = openSection === 'students';
  const credentialsOpen = openSection === 'credentials';

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/login');
  };

  const schoolSubItems = [
    { name: 'Register School', href: '/dashboard/schools/register', icon: PlusCircle },
    { name: 'Bulk Upload', href: '/dashboard/schools/bulk', icon: FileSpreadsheet },
    { name: 'View / Edit Schools', href: '/dashboard/schools', icon: Eye },
    { name: 'Olympiad ID Info', href: '/dashboard/schools/olympiad-info', icon: Hash },
  ];

  const uploaderSubItems = [
    { name: 'Register Uploader', href: '/dashboard/uploaders/register', icon: UserPlus },
    { name: 'View / Manage Uploaders', href: '/dashboard/uploaders', icon: Eye },
  ];

  const studentSubItems = [
    { name: 'Registered Students', href: '/dashboard/students', icon: GraduationCap },
  ];

  const credentialsSubItems = [
    { name: 'Manage School Credentials', href: '/dashboard/credentials/schools', icon: Users },
    { name: 'Manage Uploader Credentials', href: '/dashboard/credentials/uploaders', icon: UploadCloud },
  ];

  return (
    <div className="flex min-h-screen bg-[#DDE2F9] text-[#432818]">
      <div className="bg-glow-warm"></div>

      {/* Sidebar */}
      <aside className="w-72 bg-[#06013E] flex flex-col fixed h-screen z-50 shadow-[10px_0_30px_rgba(6,1,62,0.25)] overflow-y-auto">
        {/* Banner Card */}
        <div className="p-3">
          <div className="bg-white rounded-2xl overflow-hidden shadow-md ring-1 ring-white/10">
            <div className="relative w-full" style={{ aspectRatio: '16/10' }}>
              <Image
                src="/5852.jpg"
                alt="Kids Celebration"
                fill
                className="object-contain"
                priority
              />
              {/* Mittsure Logo Overlay */}
              <div className="absolute" style={{ top: '-20px', right: '-20px' }}>
                <div className="relative h-24 w-44">
                  <Image
                    src="/Mittsure_LOGO_updated_page-0001-removebg-preview.png"
                    alt="Mittsure Logo"
                    fill
                    className="object-contain"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 flex flex-col flex-1">
          
      
          

          <nav className="flex-1 space-y-1">
            {/* Dashboard Link */}
            <Link
              href="/dashboard"
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors duration-100 group ${pathname === '/dashboard'
                ? 'bg-white text-[#06013E] shadow-lg'
                : 'text-white hover:bg-white/15'
                }`}
            >
              <LayoutDashboard size={18} className={pathname === '/dashboard' ? 'text-[#06013E]' : ''} />
              <span className="font-semibold text-sm">Dashboard</span>
            </Link>

            {/* School Management - Expandable */}
            <div>
              <button
                onClick={() => toggleSection('schools')}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors duration-100 group ${pathname.startsWith('/dashboard/schools')
                  ? 'bg-white/25 text-white'
                  : 'text-white hover:bg-white/15'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <School size={18} />
                  <span className="font-semibold text-sm">School Management</span>
                </div>
                <ChevronDown
                  size={16}
                  className={`transition-transform duration-150 ${schoolsOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {/* Sub Items */}
              <div
                className={`overflow-hidden transition-all duration-150 ease-out ${schoolsOpen ? 'max-h-80 opacity-100 mt-1' : 'max-h-0 opacity-0'
                  }`}
              >
                <div className="ml-4 pl-4 border-l-2 border-white/30 space-y-1">
                  {schoolSubItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-100 text-sm ${isActive
                          ? 'bg-white text-[#06013E] shadow-md font-semibold'
                          : 'text-white/90 hover:bg-white/15'
                          }`}
                      >
                        <Icon size={16} />
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
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors duration-100 group ${pathname.startsWith('/dashboard/uploaders')
                  ? 'bg-white/25 text-white'
                  : 'text-white hover:bg-white/15'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <UploadCloud size={18} />
                  <span className="font-semibold text-sm">Uploaders</span>
                </div>
                <ChevronDown
                  size={16}
                  className={`transition-transform duration-150 ${uploadersOpen ? 'rotate-180' : ''}`}
                />
              </button>

              <div
                className={`overflow-hidden transition-all duration-150 ease-out ${uploadersOpen ? 'max-h-60 opacity-100 mt-1' : 'max-h-0 opacity-0'
                  }`}
              >
                <div className="ml-4 pl-4 border-l-2 border-white/30 space-y-1">
                  {uploaderSubItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-100 text-sm ${isActive
                          ? 'bg-white text-[#06013E] shadow-md font-semibold'
                          : 'text-white/90 hover:bg-white/15'
                          }`}
                      >
                        <Icon size={16} />
                        <span>{item.name}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Students - Expandable */}
            <div>
              <button
                onClick={() => toggleSection('students')}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors duration-100 group ${pathname.startsWith('/dashboard/students')
                  ? 'bg-white/25 text-white'
                  : 'text-white hover:bg-white/15'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <GraduationCap size={18} />
                  <span className="font-semibold text-sm">Students</span>
                </div>
                <ChevronDown size={16} className={`transition-transform duration-150 ${studentsOpen ? 'rotate-180' : ''}`} />
              </button>

              <div className={`overflow-hidden transition-all duration-150 ease-out ${studentsOpen ? 'max-h-40 opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
                <div className="ml-4 pl-4 border-l-2 border-white/30 space-y-1">
                  {studentSubItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;
                    return (
                      <Link key={item.name} href={item.href}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-100 text-sm ${isActive
                          ? 'bg-white text-[#06013E] shadow-md font-semibold'
                          : 'text-white/90 hover:bg-white/15'
                          }`}
                      >
                        <Icon size={16} />
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
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors duration-100 group ${pathname.startsWith('/dashboard/credentials')
                  ? 'bg-white/25 text-white'
                  : 'text-white hover:bg-white/15'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <KeyRound size={18} />
                  <span className="font-semibold text-sm">Credentials</span>
                </div>
                <ChevronDown
                  size={16}
                  className={`transition-transform duration-150 ${credentialsOpen ? 'rotate-180' : ''}`}
                />
              </button>

              <div
                className={`overflow-hidden transition-all duration-150 ease-out ${credentialsOpen ? 'max-h-60 opacity-100 mt-1' : 'max-h-0 opacity-0'
                  }`}
              >
                <div className="ml-4 pl-4 border-l-2 border-white/30 space-y-1">
                  {credentialsSubItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-100 text-sm ${isActive
                          ? 'bg-white text-[#06013E] shadow-md font-semibold'
                          : 'text-white/90 hover:bg-white/15'
                          }`}
                      >
                        <Icon size={16} />
                        <span>{item.name}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          </nav>

          <div className="mt-auto space-y-4 pt-6 border-t border-white/25">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-white hover:bg-white/15 transition-all w-full group"
            >
              <LogOut size={18} className="group-hover:rotate-12 transition-transform" />
              <span className="font-semibold text-sm">Logout Session</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-72 px-6 pt-2 pb-10 relative min-h-screen">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
