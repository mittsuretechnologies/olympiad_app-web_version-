'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { isTokenExpired } from '@/lib/session-token';
import { DASHBOARD_TOKEN_KEYS, clearDashboardSession } from '@/lib/swr';
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
  ClipboardCheck,
  Award,
  Flag,
  LifeBuoy,
  History,
  Menu,
  X,
} from 'lucide-react';

type Role = 'SUPERADMIN' | 'REVIEWER' | 'EVALUATOR' | 'MODERATOR';
type Section = 'schools' | 'uploaders' | 'credentials' | 'moderation' | 'reports' | 'reviewer' | 'evaluator' | 'result' | 'settings' | null;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [role, setRole] = useState<Role>('SUPERADMIN');
  const [allowedModules, setAllowedModules] = useState<string[] | null>(null); // null = superadmin (all)
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    // Drop any expired token before reading it: a stale-but-present token used
    // to admit you to the dashboard, where every API call then 401'd with no
    // way back to /login.
    for (const key of DASHBOARD_TOKEN_KEYS) {
      const value = sessionStorage.getItem(key);
      if (value && isTokenExpired(value)) clearDashboardSession();
    }

    const token = sessionStorage.getItem('token');
    const reviewerToken = sessionStorage.getItem('reviewerToken');
    const evaluatorToken = sessionStorage.getItem('evaluatorToken');
    const moderatorToken = sessionStorage.getItem('moderatorToken');

    if (!token && !reviewerToken && !evaluatorToken && !moderatorToken) {
      router.push('/login');
      return;
    }

    let detectedRole: Role = 'SUPERADMIN';
    if (reviewerToken && !token) detectedRole = 'REVIEWER';
    else if (evaluatorToken && !token) detectedRole = 'EVALUATOR';
    else if (moderatorToken && !token) detectedRole = 'MODERATOR';

    setRole(detectedRole);

    const adminData = sessionStorage.getItem('adminUser');
    const reviewerData = sessionStorage.getItem('reviewerData');
    const evaluatorData = sessionStorage.getItem('evaluatorData');
    const moderatorData = sessionStorage.getItem('moderatorData');
    try {
      if (detectedRole === 'SUPERADMIN' && adminData) setCurrentUser(JSON.parse(adminData));
      else if (detectedRole === 'REVIEWER' && reviewerData) setCurrentUser(JSON.parse(reviewerData));
      else if (detectedRole === 'EVALUATOR' && evaluatorData) setCurrentUser(JSON.parse(evaluatorData));
      else if (detectedRole === 'MODERATOR' && moderatorData) setCurrentUser(JSON.parse(moderatorData));
    } catch { /* ignore */ }

    if (detectedRole !== 'SUPERADMIN') {
      // get memberId from stored token data
      let memberId: string | null = null;
      try {
        if (detectedRole === 'REVIEWER' && reviewerData) memberId = JSON.parse(reviewerData).id;
        if (detectedRole === 'EVALUATOR' && evaluatorData) memberId = JSON.parse(evaluatorData).id;
        if (detectedRole === 'MODERATOR' && moderatorData) memberId = JSON.parse(moderatorData).id;
      } catch { /* ignore */ }

      const permToken = token || reviewerToken || evaluatorToken || moderatorToken;
      fetch('/api/settings/role-permissions', { headers: permToken ? { Authorization: `Bearer ${permToken}` } : {} })
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
    if (p.startsWith('/dashboard/reported-videos')) return 'moderation';
    if (p.startsWith('/dashboard/moderation')) return 'moderation';
    if (p.startsWith('/dashboard/reports')) return 'reports';
    if (p.startsWith('/dashboard/app-users')) return 'reports';
    if (p.startsWith('/dashboard/reviewer')) return 'reviewer';
    if (p.startsWith('/dashboard/evaluator')) return 'evaluator';
    if (p.startsWith('/dashboard/result')) return 'result';
    if (p.startsWith('/dashboard/settings')) return 'settings';
    return 'schools';
  };

  const [openSection, setOpenSection] = useState<Section>(sectionForPath(pathname));
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // On mobile the sidebar is an overlay drawer: close it once navigation lands
  // on a new route, otherwise it stays open on top of the page you just opened.
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  // The drawer covers the page, so let the drawer scroll rather than the body
  // underneath it.
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

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
  const resultOpen = openSection === 'result';
  const settingsOpen = openSection === 'settings';

  const handleLogout = () => {
    clearDashboardSession();
    router.push('/login');
  };

  const moderationSubItems = [
    { name: 'Video Moderation', href: '/dashboard/videos', icon: Clock },
    { name: 'Reported Videos',  href: '/dashboard/reported-videos', icon: Flag },
    { name: 'Create Moderator', href: '/dashboard/moderation/moderators', icon: UserPlus },
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
    { name: 'Manage Evaluators', href: '/dashboard/evaluator/manage',           icon: UserCheck },
    { name: 'Evaluate Content',  href: '/dashboard/evaluator/evaluate-content', icon: Play },
    { name: 'Evaluation History', href: '/dashboard/evaluator/history',          icon: Clock },
  ];

  const reportsSubItems = [
    { name: 'Student Report',         href: '/dashboard/credentials/registered-students',    icon: UserCheck },
    { name: 'Olympiad Completions',   href: '/dashboard/reports/olympiad-completions',       icon: Trophy },
    { name: 'Evaluation Progress',    href: '/dashboard/reports/evaluation-progress',        icon: ClipboardCheck },
    { name: 'School Report',          href: '/dashboard/reports/schools',                    icon: Building2 },
    { name: 'App Users',              href: '/dashboard/app-users',                          icon: Smartphone },
  ];

  const resultSubItems = [
    { name: 'Result List',    href: '/dashboard/result',           icon: Trophy },
  ];

  const subItemClass = (isActive: boolean) =>
    `flex items-center px-2 py-2 rounded-lg transition-all duration-200 text-[12.5px] whitespace-nowrap ${isActive ? 'bg-[#009846] text-white font-semibold' : 'text-black font-semibold hover:bg-gray-100 hover:text-[#052E5C]'}`;

  const sectionBtnClass = (active: boolean) =>
    `w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all duration-200 ${active ? 'bg-[#009846] text-white font-semibold shadow-md' : 'bg-white/10 text-white font-semibold shadow-md border border-white/10 hover:bg-white/20'}`;

  return (
    <div className="flex min-h-screen bg-[#052E5C] text-[#1F2937]">

      {/* Mobile top bar */}
      <header className="lg:hidden fixed top-0 inset-x-0 h-16 z-40 flex items-center gap-3 px-4 bg-[#052E5C]/95 backdrop-blur-md border-b border-white/10 shadow-lg shadow-black/20">
        <button
          onClick={() => setSidebarOpen(true)}
          aria-label="Open menu"
          className="p-2 -ml-2 rounded-xl text-white hover:bg-white/10 active:bg-white/20 transition-colors"
        >
          <Menu size={22} />
        </button>
        <div className="flex items-center gap-2">
          <Image src="/mittmee-icon.jpeg" alt="mittmee" width={28} height={28} className="rounded-lg object-cover" />
          <span className="text-base font-bold tracking-tight">
            <span className="text-white">mitt</span><span className="text-[#4ADE80]">mee</span>
          </span>
        </div>
        <div className="ml-auto w-9 h-9 rounded-full bg-[#FF9000] text-black font-black text-xs flex items-center justify-center">
          {(currentUser?.name || role).split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()}
        </div>
      </header>

      {/* Drawer backdrop */}
      <div
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
        className={`lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Sidebar */}
      <aside
        style={{ scrollbarGutter: 'stable' }}
        className={`w-72 max-w-[85vw] bg-[#052E5C] flex flex-col fixed h-screen z-50 border-r border-[#04203f] overflow-x-hidden overflow-y-auto lg:overflow-y-hidden lg:hover:overflow-y-auto custom-scrollbar transition-transform duration-300 ease-in-out lg:transition-none shadow-2xl shadow-black/40 lg:shadow-none ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Drawer close */}
        <button
          onClick={() => setSidebarOpen(false)}
          aria-label="Close menu"
          className="lg:hidden absolute top-3 right-3 z-10 p-2 rounded-xl bg-black/30 text-white hover:bg-black/50 transition-colors"
        >
          <X size={18} />
        </button>

        {/* Banner */}
        <div className="relative px-4 pt-5 pb-2">
          <div className="relative w-full aspect-[16/10] overflow-hidden rounded-2xl bg-white shadow-lg shadow-black/20">
            <Image src="/banner.webp" alt="Kids Celebration" fill sizes="280px" className="object-cover object-center" priority />
          </div>
          <div className="absolute top-6 right-4 flex items-center gap-1.5 bg-white/90 rounded-lg px-2 py-1 shadow-sm">
            <Image src="/mittmee-icon.jpeg" alt="mittmee" width={24} height={24} className="rounded object-cover" />
            <span className="text-xs font-bold"><span className="text-[#1559C7]">mitt</span><span className="text-[#3CB043]">mee</span></span>
          </div>
        </div>

        <div className="p-4 pt-6 pb-2">
          <p className="px-4 text-[11px] font-bold text-blue-200/70 uppercase tracking-wider mb-2">Main Menu</p>
        </div>

        <div className="px-4 flex flex-col flex-1">
          <nav className="flex-1 space-y-2">

            {/* Dashboard */}
            <Link href="/dashboard"
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 ${pathname === '/dashboard' ? 'bg-[#009846] text-white font-semibold shadow-md' : 'bg-white/10 text-white font-semibold shadow-md border border-white/10 hover:bg-white/20'}`}>
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
                  <div className="relative ml-6 pl-4 my-1">
                  <span className="absolute left-0 top-0 bottom-1/2 w-3 border-l-[3px] border-b-[3px] border-white/70 rounded-bl-lg" />
                  <div className="space-y-1 bg-white rounded-xl shadow-md border border-gray-100 py-2">
                    {schoolSubItems.filter((_, i) => canSeeSubItem(['schools.register','schools.bulk','schools.view'][i])).map(item => <Link key={item.name} href={item.href} className={subItemClass(pathname === item.href)}><span>{item.name}</span></Link>)}
                  </div>
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
                  <div className="relative ml-6 pl-4 my-1">
                  <span className="absolute left-0 top-0 bottom-1/2 w-3 border-l-[3px] border-b-[3px] border-white/70 rounded-bl-lg" />
                  <div className="space-y-1 bg-white rounded-xl shadow-md border border-gray-100 py-2">
                    {uploaderSubItems.filter((_, i) => canSeeSubItem(['uploaders.register','uploaders.view'][i])).map(item => <Link key={item.name} href={item.href} className={subItemClass(pathname === item.href)}><span>{item.name}</span></Link>)}
                  </div>
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
                  <div className="relative ml-6 pl-4 my-1">
                  <span className="absolute left-0 top-0 bottom-1/2 w-3 border-l-[3px] border-b-[3px] border-white/70 rounded-bl-lg" />
                  <div className="space-y-1 bg-white rounded-xl shadow-md border border-gray-100 py-2">
                    {credentialsSubItems.filter((_, i) => canSeeSubItem(['credentials.schools','credentials.uploaders','credentials.students','credentials.reviewers','credentials.evaluators'][i])).map(item => <Link key={item.name} href={item.href} className={subItemClass(pathname === item.href)}><span>{item.name}</span></Link>)}
                  </div>
                  </div>
                </div>
              </div>
            )}

            {/* Moderation */}
            {canSee('moderation') && (
              <div>
                <button onClick={() => toggleSection('moderation')}
                  className={sectionBtnClass(pathname.startsWith('/dashboard/videos') || pathname.startsWith('/dashboard/reported-videos') || pathname.startsWith('/dashboard/moderation'))}>
                  <div className="flex items-center gap-3"><Play size={20} /><span className="text-sm font-semibold">Moderation</span></div>
                  <ChevronDown size={16} className={`transition-transform duration-200 ${moderationOpen ? 'rotate-180' : ''}`} />
                </button>
                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${moderationOpen ? 'max-h-60 opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
                  <div className="relative ml-6 pl-4 my-1">
                  <span className="absolute left-0 top-0 bottom-1/2 w-3 border-l-[3px] border-b-[3px] border-white/70 rounded-bl-lg" />
                  <div className="space-y-1 bg-white rounded-xl shadow-md border border-gray-100 py-2">
                    {moderationSubItems.filter((_, i) => canSeeSubItem(['moderation.pending', 'moderation.reported', 'moderation.moderators'][i])).map(item => <Link key={item.name} href={item.href} className={subItemClass(pathname === item.href)}><span>{item.name}</span></Link>)}
                  </div>
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
                  <div className="relative ml-6 pl-4 my-1">
                  <span className="absolute left-0 top-0 bottom-1/2 w-3 border-l-[3px] border-b-[3px] border-white/70 rounded-bl-lg" />
                  <div className="space-y-1 bg-white rounded-xl shadow-md border border-gray-100 py-2">
                    {reviewerSubItems.filter((_, i) => canSeeSubItem(['reviewer.manage','reviewer.content'][i])).map(item => <Link key={item.name} href={item.href} className={subItemClass(pathname === item.href)}><span>{item.name}</span></Link>)}
                  </div>
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
                  <div className="relative ml-6 pl-4 my-1">
                  <span className="absolute left-0 top-0 bottom-1/2 w-3 border-l-[3px] border-b-[3px] border-white/70 rounded-bl-lg" />
                  <div className="space-y-1 bg-white rounded-xl shadow-md border border-gray-100 py-2">
                    {evaluatorSubItems.filter((_, i) => canSeeSubItem(['evaluator.manage', 'evaluator.content', 'evaluator.history'][i])).map(item => <Link key={item.name} href={item.href} className={subItemClass(pathname === item.href)}><span>{item.name}</span></Link>)}
                  </div>
                  </div>
                </div>
              </div>
            )}

            {/* Result — only superadmin */}
            {role === 'SUPERADMIN' && (
              <div>
                <button onClick={() => toggleSection('result')}
                  className={sectionBtnClass(pathname.startsWith('/dashboard/result'))}>
                  <div className="flex items-center gap-3"><Award size={20} /><span className="text-sm font-semibold">Result</span></div>
                  <ChevronDown size={16} className={`transition-transform duration-200 ${resultOpen ? 'rotate-180' : ''}`} />
                </button>
                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${resultOpen ? 'max-h-40 opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
                  <div className="relative ml-6 pl-4 my-1">
                  <span className="absolute left-0 top-0 bottom-1/2 w-3 border-l-[3px] border-b-[3px] border-white/70 rounded-bl-lg" />
                  <div className="space-y-1 bg-white rounded-xl shadow-md border border-gray-100 py-2">
                    {resultSubItems.map(item => <Link key={item.name} href={item.href} className={subItemClass(pathname === item.href)}><span>{item.name}</span></Link>)}
                  </div>
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
                  <div className="relative ml-6 pl-4 my-1">
                  <span className="absolute left-0 top-0 bottom-1/2 w-3 border-l-[3px] border-b-[3px] border-white/70 rounded-bl-lg" />
                  <div className="space-y-1 bg-white rounded-xl shadow-md border border-gray-100 py-2">
                    {reportsSubItems.filter((_, i) => canSeeSubItem(['reports.students','reports.olympiad','reports.evaluation-progress','reports.schools','reports.appusers'][i])).map(item => <Link key={item.name} href={item.href} className={subItemClass(pathname === item.href)}><span>{item.name}</span></Link>)}
                  </div>
                  </div>
                </div>
              </div>
            )}

            {/* Activity Log — only superadmin */}
            {role === 'SUPERADMIN' && (
              <Link href="/dashboard/activity-log"
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 ${pathname.startsWith('/dashboard/activity-log') ? 'bg-[#009846] text-white font-semibold shadow-md' : 'bg-white/10 text-white font-semibold shadow-md border border-white/10 hover:bg-white/20'}`}>
                <History size={20} />
                <span className="text-sm font-semibold">Activity Log</span>
              </Link>
            )}

            {/* Support */}
            {canSee('support') && (
              <Link href="/dashboard/support-tickets"
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 ${pathname.startsWith('/dashboard/support-tickets') ? 'bg-[#009846] text-white font-semibold shadow-md' : 'bg-white/10 text-white font-semibold shadow-md border border-white/10 hover:bg-white/20'}`}>
                <LifeBuoy size={20} />
                <span className="text-sm font-semibold">Support</span>
              </Link>
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
                  <div className="relative ml-6 pl-4 my-1">
                  <span className="absolute left-0 top-0 bottom-1/2 w-3 border-l-[3px] border-b-[3px] border-white/70 rounded-bl-lg" />
                  <div className="space-y-1 bg-white rounded-xl shadow-md border border-gray-100 py-2">
                    <Link href="/dashboard/settings/permission-control" className={subItemClass(pathname === '/dashboard/settings/permission-control')}>
                      <span>Permission Control</span>
                    </Link>
                  </div>
                  </div>
                </div>
              </div>
            )}

          </nav>

          {/* Logged-in user + Logout */}
          <div className="mt-auto py-3 flex items-center gap-2">
            <div className="flex-1 min-w-0 rounded-xl bg-white/10 border border-white/10 p-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#FF9000] text-black font-black text-sm flex items-center justify-center flex-shrink-0">
                  {(currentUser?.name || role).split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-white font-bold text-xs leading-tight truncate">{currentUser?.name || role}</p>
                  <p className="text-white/50 text-[10px] truncate">{role}</p>
                </div>
                <div className="ml-auto flex-shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                </div>
              </div>
            </div>
            <button onClick={handleLogout} title="Logout"
              className="flex-shrink-0 p-3 text-red-300 hover:bg-red-500/20 hover:text-red-200 rounded-xl transition-colors">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 lg:ml-72 min-h-screen flex flex-col p-2 sm:p-3 pt-[72px] lg:pt-3">
        <div className="flex-1 bg-white border border-[#E7EBF2] rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04)] overflow-hidden">
          <div className="px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">{children}</div>
        </div>
      </main>
    </div>
  );
}
