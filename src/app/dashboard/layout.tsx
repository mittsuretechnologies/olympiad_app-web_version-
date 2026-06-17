'use client';

import { useEffect, useState } from 'react';
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
  Star,
  Settings,
} from 'lucide-react';

type Role = 'SUPERADMIN' | 'REVIEWER' | 'EVALUATOR';
type Section = 'schools' | 'uploaders' | 'credentials' | 'moderation' | 'reports' | 'reviewer' | 'evaluator' | 'settings' | null;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [role, setRole] = useState<Role>('SUPERADMIN');
  const [allowedModules, setAllowedModules] = useState<string[] | null>(null); // null = superadmin (all)

  useEffect(() => {
    const token = localStorage.getItem('token');
    const reviewerToken = localStorage.getItem('reviewerToken');
    const evaluatorToken = localStorage.getItem('evaluatorToken');

    let detectedRole: Role = 'SUPERADMIN';
    if (reviewerToken && !token) detectedRole = 'REVIEWER';
    else if (evaluatorToken && !token) detectedRole = 'EVALUATOR';

    setRole(detectedRole);

    if (detectedRole !== 'SUPERADMIN') {
      // get memberId from stored token data
      const reviewerData = localStorage.getItem('reviewerData');
      const evaluatorData = localStorage.getItem('evaluatorData');
      let memberId: string | null = null;
      try {
        if (detectedRole === 'REVIEWER' && reviewerData) memberId = JSON.parse(reviewerData).id;
        if (detectedRole === 'EVALUATOR' && evaluatorData) memberId = JSON.parse(evaluatorData).id;
      } catch { /* ignore */ }

      fetch('/api/settings/role-permissions')
        .then(r => r.json())
        .then((data: { global: { role: string; allowedModules: string[] }[]; individual: { memberId: string; allowedModules: string[] }[] } | { message: string }) => {
          if ('global' in data) {
            // check individual override first
            if (memberId) {
              const individual = data.individual?.find(p => p.memberId === memberId);
              if (individual) { setAllowedModules(individual.allowedModules); return; }
            }
            // fall back to global role permissions
            const global = data.global?.find(p => p.role === detectedRole);
            setAllowedModules(global ? global.allowedModules : []);
          } else {
            setAllowedModules([]);
          }
        })
        .catch(() => setAllowedModules([]));
    }
  }, []);

  const canSee = (moduleKey: string) => {
    if (allowedModules === null) return true;
    return allowedModules.includes(moduleKey);
  };

  const canSeeSubItem = (subKey: string) => {
    if (allowedModules === null) return true;
    return allowedModules.includes(subKey);
  };

  const sectionForPath = (p: string): Section => {
    if (p.startsWith('/dashboard/schools')) return 'schools';
    if (p.startsWith('/dashboard/uploaders')) return 'uploaders';
    if (p.startsWith('/dashboard/credentials/registered')) return 'reports';
    if (p.startsWith('/dashboard/credentials')) return 'credentials';
    if (p.startsWith('/dashboard/videos')) return 'moderation';
    if (p.startsWith('/dashboard/reports')) return 'reports';
    if (p.startsWith('/dashboard/app-users')) return 'reports';
    if (p.startsWith('/dashboard/reviewer')) return 'reviewer';
    if (p.startsWith('/dashboard/evaluator')) return 'evaluator';
    if (p.startsWith('/dashboard/settings')) return 'settings';
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
  const reviewerOpen = openSection === 'reviewer';
  const evaluatorOpen = openSection === 'evaluator';
  const settingsOpen = openSection === 'settings';

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('reviewerToken');
    localStorage.removeItem('reviewerData');
    localStorage.removeItem('evaluatorToken');
    localStorage.removeItem('evaluatorData');
    router.push('/login');
  };

  const moderationSubItems = [
    { name: 'Pending Approvals', href: '/dashboard/videos', icon: Clock },
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
    { name: 'Manage School Credentials',    href: '/dashboard/credentials/schools',    icon: Users },
    { name: 'Manage Uploader Credentials',  href: '/dashboard/credentials/uploaders',  icon: UploadCloud },
    { name: 'Manage Student Credentials',   href: '/dashboard/credentials/students',   icon: KeyRound },
    { name: 'Reviewer Credentials',         href: '/dashboard/credentials/reviewers',  icon: UserCheck },
    { name: 'Evaluator Credentials',        href: '/dashboard/credentials/evaluators', icon: Star },
  ];

  const reviewerSubItems = [
    { name: 'Manage Reviewers',  href: '/dashboard/reviewer/manage',         icon: UserCheck },
    { name: 'Review Content',    href: '/dashboard/reviewer/review-content',  icon: Play },
  ];

  const evaluatorSubItems = [
    { name: 'Manage Evaluators', href: '/dashboard/evaluator/manage', icon: UserCheck },
  ];

  const reportsSubItems = [
    { name: 'Student Report',         href: '/dashboard/credentials/registered-students', icon: UserCheck },
    { name: 'Olympiad Completions',   href: '/dashboard/reports/olympiad-completions',    icon: Trophy },
    { name: 'School Report',          href: '/dashboard/reports/schools',                 icon: Building2 },
    { name: 'App Users',              href: '/dashboard/app-users',                       icon: Smartphone },
  ];

  const subItemClass = (isActive: boolean) =>
    `flex items-center px-2 py-2 rounded-lg transition-all duration-200 text-[12.5px] whitespace-nowrap ${isActive ? 'bg-white text-[#004f9f] font-semibold' : 'text-blue-200 hover:bg-white/10 hover:text-white'}`;

  const sectionBtnClass = (active: boolean) =>
    `w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all duration-200 ${active ? 'bg-[#009846] text-white font-semibold' : 'text-blue-100 hover:bg-white/10 hover:text-white'}`;

  return (
    <div className="flex min-h-screen bg-[#F0F2F5] text-[#1F2937]">

      {/* Sidebar */}
      <aside
        style={{ scrollbarGutter: 'stable' }}
        className="w-72 bg-[#052E5C] flex flex-col fixed h-screen z-50 border-r border-[#04203f] overflow-x-hidden overflow-y-hidden hover:overflow-y-auto custom-scrollbar"
      >
        {/* Banner */}
        <div className="relative px-4 pt-5 pb-2">
          <div className="relative w-full aspect-[16/10] overflow-hidden rounded-2xl bg-white shadow-lg shadow-black/20">
            <Image src="/banner.webp" alt="Kids Celebration" fill sizes="280px" className="object-cover object-center" priority />
          </div>
          <div className="absolute top-[2px] right-[6px] h-16 w-32">
            <Image src="/logo-color.webp" alt="Mittsure Logo" fill className="object-contain" />
          </div>
        </div>

        <div className="p-4 pt-6 pb-2">
          <p className="px-4 text-[11px] font-bold text-blue-200/70 uppercase tracking-wider mb-2">Main Menu</p>
        </div>

        <div className="px-4 flex flex-col flex-1">
          <nav className="flex-1 space-y-2">

            {/* Dashboard */}
            <Link href="/dashboard"
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 ${pathname === '/dashboard' ? 'bg-[#009846] text-white font-semibold' : 'text-blue-100 hover:bg-white/10 hover:text-white'}`}>
              <LayoutDashboard size={20} />
              <span className="text-sm font-semibold">Dashboard</span>
            </Link>

            {/* Schools */}
            {canSee('schools') && (
              <div>
                <button onClick={() => toggleSection('schools')}
                  className={sectionBtnClass(pathname.startsWith('/dashboard/schools'))}>
                  <div className="flex items-center gap-3"><School size={20} /><span className="text-sm font-semibold">Schools</span></div>
                  <ChevronDown size={16} className={`transition-transform duration-200 ${schoolsOpen ? 'rotate-180' : ''}`} />
                </button>
                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${schoolsOpen ? 'max-h-80 opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
                  <div className="ml-6 pl-4 border-l border-white/15 space-y-1 my-1">
                    {schoolSubItems.filter((_, i) => canSeeSubItem(['schools.register','schools.bulk','schools.view'][i])).map(item => <Link key={item.name} href={item.href} className={subItemClass(pathname === item.href)}><span>{item.name}</span></Link>)}
                  </div>
                </div>
              </div>
            )}

            {/* Moderation */}
            {canSee('moderation') && (
              <div>
                <button onClick={() => toggleSection('moderation')}
                  className={sectionBtnClass(pathname.startsWith('/dashboard/videos'))}>
                  <div className="flex items-center gap-3"><Play size={20} /><span className="text-sm font-semibold">Moderation</span></div>
                  <ChevronDown size={16} className={`transition-transform duration-200 ${moderationOpen ? 'rotate-180' : ''}`} />
                </button>
                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${moderationOpen ? 'max-h-60 opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
                  <div className="ml-6 pl-4 border-l border-white/15 space-y-1 my-1">
                    {moderationSubItems.filter((_, i) => canSeeSubItem(['moderation.pending'][i])).map(item => <Link key={item.name} href={item.href} className={subItemClass(pathname === item.href)}><span>{item.name}</span></Link>)}
                  </div>
                </div>
              </div>
            )}

            {/* Uploaders */}
            {canSee('uploaders') && (
              <div>
                <button onClick={() => toggleSection('uploaders')}
                  className={sectionBtnClass(pathname.startsWith('/dashboard/uploaders'))}>
                  <div className="flex items-center gap-3"><UploadCloud size={20} /><span className="text-sm font-semibold">Uploaders</span></div>
                  <ChevronDown size={16} className={`transition-transform duration-200 ${uploadersOpen ? 'rotate-180' : ''}`} />
                </button>
                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${uploadersOpen ? 'max-h-60 opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
                  <div className="ml-6 pl-4 border-l border-white/15 space-y-1 my-1">
                    {uploaderSubItems.filter((_, i) => canSeeSubItem(['uploaders.register','uploaders.view'][i])).map(item => <Link key={item.name} href={item.href} className={subItemClass(pathname === item.href)}><span>{item.name}</span></Link>)}
                  </div>
                </div>
              </div>
            )}

            {/* Credentials */}
            {canSee('credentials') && (
              <div>
                <button onClick={() => toggleSection('credentials')}
                  className={sectionBtnClass(pathname.startsWith('/dashboard/credentials') && !pathname.startsWith('/dashboard/credentials/registered'))}>
                  <div className="flex items-center gap-3"><KeyRound size={20} /><span className="text-sm font-semibold">Credentials</span></div>
                  <ChevronDown size={16} className={`transition-transform duration-200 ${credentialsOpen ? 'rotate-180' : ''}`} />
                </button>
                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${credentialsOpen ? 'max-h-96 opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
                  <div className="ml-6 pl-4 border-l border-white/15 space-y-1 my-1">
                    {credentialsSubItems.filter((_, i) => canSeeSubItem(['credentials.schools','credentials.uploaders','credentials.students','credentials.reviewers','credentials.evaluators'][i])).map(item => <Link key={item.name} href={item.href} className={subItemClass(pathname === item.href)}><span>{item.name}</span></Link>)}
                  </div>
                </div>
              </div>
            )}

            {/* Reviewer */}
            {canSee('reviewer') && (
              <div>
                <button onClick={() => toggleSection('reviewer')}
                  className={sectionBtnClass(pathname.startsWith('/dashboard/reviewer'))}>
                  <div className="flex items-center gap-3"><UserCheck size={20} /><span className="text-sm font-semibold">Reviewer</span></div>
                  <ChevronDown size={16} className={`transition-transform duration-200 ${reviewerOpen ? 'rotate-180' : ''}`} />
                </button>
                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${reviewerOpen ? 'max-h-60 opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
                  <div className="ml-6 pl-4 border-l border-white/15 space-y-1 my-1">
                    {reviewerSubItems.filter((_, i) => canSeeSubItem(['reviewer.manage','reviewer.content'][i])).map(item => <Link key={item.name} href={item.href} className={subItemClass(pathname === item.href)}><span>{item.name}</span></Link>)}
                  </div>
                </div>
              </div>
            )}

            {/* Evaluator */}
            {canSee('evaluator') && (
              <div>
                <button onClick={() => toggleSection('evaluator')}
                  className={sectionBtnClass(pathname.startsWith('/dashboard/evaluator'))}>
                  <div className="flex items-center gap-3"><Star size={20} /><span className="text-sm font-semibold">Evaluator</span></div>
                  <ChevronDown size={16} className={`transition-transform duration-200 ${evaluatorOpen ? 'rotate-180' : ''}`} />
                </button>
                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${evaluatorOpen ? 'max-h-60 opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
                  <div className="ml-6 pl-4 border-l border-white/15 space-y-1 my-1">
                    {evaluatorSubItems.filter((_, i) => canSeeSubItem(['evaluator.manage'][i])).map(item => <Link key={item.name} href={item.href} className={subItemClass(pathname === item.href)}><span>{item.name}</span></Link>)}
                  </div>
                </div>
              </div>
            )}

            {/* Reports */}
            {canSee('reports') && (
              <div>
                <button onClick={() => toggleSection('reports')}
                  className={sectionBtnClass(pathname.startsWith('/dashboard/reports') || pathname.startsWith('/dashboard/credentials/registered') || pathname.startsWith('/dashboard/app-users'))}>
                  <div className="flex items-center gap-3"><BarChart2 size={20} /><span className="text-sm font-semibold">Reports</span></div>
                  <ChevronDown size={16} className={`transition-transform duration-200 ${reportsOpen ? 'rotate-180' : ''}`} />
                </button>
                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${reportsOpen ? 'max-h-60 opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
                  <div className="ml-6 pl-4 border-l border-white/15 space-y-1 my-1">
                    {reportsSubItems.filter((_, i) => canSeeSubItem(['reports.students','reports.olympiad','reports.schools','reports.appusers'][i])).map(item => <Link key={item.name} href={item.href} className={subItemClass(pathname === item.href)}><span>{item.name}</span></Link>)}
                  </div>
                </div>
              </div>
            )}

            {/* Settings — only superadmin */}
            {role === 'SUPERADMIN' && (
              <div>
                <button onClick={() => toggleSection('settings')}
                  className={sectionBtnClass(pathname.startsWith('/dashboard/settings'))}>
                  <div className="flex items-center gap-3"><Settings size={20} /><span className="text-sm font-semibold">Settings</span></div>
                  <ChevronDown size={16} className={`transition-transform duration-200 ${settingsOpen ? 'rotate-180' : ''}`} />
                </button>
                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${settingsOpen ? 'max-h-40 opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
                  <div className="ml-6 pl-4 border-l border-white/15 space-y-1 my-1">
                    <Link href="/dashboard/settings/permission-control" className={subItemClass(pathname === '/dashboard/settings/permission-control')}>
                      <span>Permission Control</span>
                    </Link>
                  </div>
                </div>
              </div>
            )}

          </nav>

          {/* Logout */}
          <div className="mt-auto py-8">
            <button onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 text-red-300 hover:bg-red-500/20 hover:text-red-200 rounded-xl transition-colors font-medium text-sm">
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
