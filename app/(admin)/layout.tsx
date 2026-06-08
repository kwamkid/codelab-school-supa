'use client';

import { useEffect, useState, useMemo, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Home,
  Users,
  Calendar,
  BookOpen,
  Layers,
  Settings,
  LogOut,
  Menu,
  X,
  Building2,
  UserCog,
  CalendarDays,
  TestTube,
  Repeat,
  ChevronDown,
  ChevronRight,
  School,
  UserCheck,
  GraduationCap,
  Building,
  Loader2,
  Bell,
  Play,
  Shield,
  BarChart3,
  Key,
  User as UserIcon,
  FileText,
  Receipt,
  CreditCard,
  MessageCircle,
  PanelLeftClose,
  PanelLeftOpen,
  LucideIcon
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { Tooltip } from '@/components/ui/tooltip';
import { LoadingProvider } from '@/contexts/LoadingContext';
import { BranchProvider, useBranch } from '@/contexts/BranchContext';
import { BranchSelector } from '@/components/layout/branch-selector';
import { Loading, PageLoading } from '@/components/ui/loading';
import { getPendingMakeupCount } from '@/lib/services/makeup';
import { getNewTrialCount } from '@/lib/services/trial-bookings';
import { getUnreadNotifications, markNotificationAsRead } from '@/lib/services/notifications';
import { formatDate } from '@/lib/utils';
import { getTotalUnreadCount } from '@/lib/services/chat';
import { getClient } from '@/lib/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Notification } from '@/types/models';
import { ThemeToggle } from '@/components/ui/theme-toggle';

// Navigation types
interface NavigationItem {
  name: string;
  href?: string;
  icon?: LucideIcon;
  iconColor?: string;
  badge?: number;
  subItems?: NavigationItem[];
  requiredRole?: ('super_admin' | 'branch_admin' | 'teacher')[];
  requiredPermission?: string;
  isDivider?: boolean;
  sectionLabel?: string;
}

// MenuLink props type
interface MenuLinkProps {
  href: string;
  children: ReactNode;
  className?: string;
  title?: string;
  onClick?: () => void;
}

// Custom Link component with loading
const MenuLink = ({ href, children, className, title, onClick }: MenuLinkProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const handleClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Allow open in new tab (ctrl/cmd+click, middle-click)
    if (e.ctrlKey || e.metaKey || e.button === 1) return;

    e.preventDefault();

    // ถ้ากำลังอยู่ที่หน้าเดิมอยู่แล้ว ไม่ต้องทำอะไร
    if (pathname === href) {
      return;
    }

    setIsLoading(true);

    // Execute onClick if provided
    if (onClick) onClick();

    try {
      // Navigate
      await router.push(href);

      // Reset loading after navigation
      setTimeout(() => setIsLoading(false), 500);
    } catch (error) {
      console.error('Navigation error:', error);
      setIsLoading(false);
    }
  };

  return (
    <Link href={href} onClick={handleClick} className={className} title={title}>
      {isLoading ? (
        <div className="flex items-center text-white/70">
          <Loader2 className="mr-3 h-4 w-4 animate-spin" />
          <span>กำลังโหลด...</span>
        </div>
      ) : (
        children
      )}
    </Link>
  );
};

// Internal Layout Component ที่อยู่ใน BranchProvider
function AdminLayoutContent({ children }: { children: ReactNode }) {
  const { user, adminUser, signOut, loading: authLoading, isSuperAdmin, canManageSettings } = useAuth();
  const { selectedBranchId } = useBranch();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Desktop: collapse sidebar to an icon rail (persisted)
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('sidebarCollapsed') === 'true';
    return false;
  });
  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('sidebarCollapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [navigating, setNavigating] = useState(false);
  
  // Makeup badge state
  const [pendingMakeupCount, setPendingMakeupCount] = useState(0);
  
  // Trial booking badge state
  const [newTrialCount, setNewTrialCount] = useState(0);
  
  // Chat unread badge state
  const [chatUnreadCount, setChatUnreadCount] = useState(0);

  // Notifications state
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // Load pending makeup count - realtime + fallback polling
  useEffect(() => {
    if (!user) return;

    const loadMakeupCount = async () => {
      try {
        const count = await getPendingMakeupCount(selectedBranchId);
        setPendingMakeupCount(count);
      } catch (error) {
        console.error('Error loading makeup count:', error);
      }
    };

    loadMakeupCount();

    // Fallback polling ทุก 5 นาที (มี realtime แล้วไม่ต้องถี่)
    const interval = setInterval(loadMakeupCount, 300000);

    // Listen for makeup changes from other components
    const handleMakeupChange = () => loadMakeupCount();
    window.addEventListener('makeup-changed', handleMakeupChange);

    // Realtime: refresh ทันทีเมื่อ makeup_classes มีการ INSERT/UPDATE
    const supabase = getClient();
    const channel = supabase
      .channel('layout-makeup-count')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'makeup_classes' },
        () => loadMakeupCount()
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'makeup_classes' },
        () => loadMakeupCount()
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      window.removeEventListener('makeup-changed', handleMakeupChange);
      supabase.removeChannel(channel);
    };
  }, [user, selectedBranchId]);

  // Load new trial bookings count - realtime + fallback polling
  useEffect(() => {
    if (!user) return;

    const loadTrialCount = async () => {
      try {
        const count = await getNewTrialCount(selectedBranchId);
        setNewTrialCount(count);
      } catch (error) {
        console.error('Error loading trial count:', error);
      }
    };

    loadTrialCount();

    // Fallback polling ทุก 5 นาที
    const interval = setInterval(loadTrialCount, 300000);

    // Listen for trial booking changes from other components
    const handleTrialChange = () => loadTrialCount();
    window.addEventListener('trial-booking-changed', handleTrialChange);

    // Realtime: refresh ทันทีเมื่อ trial_bookings มีการ INSERT/UPDATE
    const supabase = getClient();
    const channel = supabase
      .channel('layout-trial-count')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'trial_bookings' },
        () => loadTrialCount()
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'trial_bookings' },
        () => loadTrialCount()
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      window.removeEventListener('trial-booking-changed', handleTrialChange);
      supabase.removeChannel(channel);
    };
  }, [user, selectedBranchId]);

  // Load chat unread count — realtime + fallback polling
  useEffect(() => {
    if (!user) return;

    const loadChatUnread = async () => {
      try {
        const count = await getTotalUnreadCount();
        setChatUnreadCount(count);
      } catch (error) {
        console.error('Error loading chat unread count:', error);
      }
    };

    loadChatUnread();

    // Fallback polling ทุก 2 นาที
    const interval = setInterval(loadChatUnread, 120000);

    // Realtime: refresh unread count ทันทีเมื่อ conversation เปลี่ยน
    const supabase = getClient();
    const channel = supabase
      .channel('layout-chat-unread')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_conversations',
        },
        () => {
          loadChatUnread();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_conversations',
        },
        () => {
          loadChatUnread();
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Load notifications
  useEffect(() => {
    const loadNotifications = async () => {
      if (user) {
        try {
          const unread = await getUnreadNotifications(user.uid);
          setNotifications(unread);
        } catch (error) {
          console.error('Error loading notifications:', error);
        }
      }
    };
    
    if (user) {
      loadNotifications();
      const interval = setInterval(loadNotifications, 300000);
      return () => clearInterval(interval);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // Teachers land on their own home page, not the admin dashboard
  useEffect(() => {
    if (adminUser?.role === 'teacher' && pathname === '/dashboard') {
      router.replace('/teacher');
    }
  }, [adminUser, pathname, router]);

  // Click outside to close notifications
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.notification-dropdown') && !target.closest('.notification-bell')) {
        setShowNotifications(false);
      }
    };

    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showNotifications]);

  // Filter navigation based on role
  const filterNavigation = (items: NavigationItem[]): NavigationItem[] => {
    // ถ้า adminUser ยังไม่โหลด → return array ว่าง (ไม่แสดงเมนูจนกว่าจะรู้ role)
    if (!adminUser) return [];

    return items.filter(item => {
      if (item.isDivider) return true;

      if (item.requiredRole) {
        if (!item.requiredRole.includes(adminUser.role)) {
          return false;
        }
      }
      
      if (item.requiredPermission) {
        if (item.requiredPermission === 'canManageSettings') {
          if (adminUser?.role === 'super_admin') return true;
          if (!canManageSettings()) return false;
        }
      }
      
      if (item.subItems) {
        const filteredSubItems = filterNavigation(item.subItems);
        if (filteredSubItems.length === 0) return false;
        // สร้าง object ใหม่แทนการ mutate
        return true;
      }
      
      return true;
    }).map(item => {
      // สร้าง copy ของ item และ filter subItems
      if (item.subItems) {
        return {
          ...item,
          subItems: filterNavigation(item.subItems)
        };
      }
      return item;
    });
  };

  // ใช้ useMemo สำหรับ navigation array
  const navigation = useMemo<NavigationItem[]>(() => [
    // Teacher home — today's classes for the logged-in teacher
    {
      name: 'หน้าหลัก',
      href: '/teacher',
      icon: Home,
      iconColor: 'text-orange-500',
      requiredRole: ['teacher']
    },
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: Home,
      iconColor: 'text-blue-500',
      requiredRole: ['super_admin', 'branch_admin']
    },
    {
      name: 'divider-1',
      isDivider: true
    },
    // --- งานหลัก (Sales & Operations) ---
    {
      name: 'ทดลองเรียน',
      href: '/trial',
      icon: TestTube,
      iconColor: 'text-cyan-600',
      badge: newTrialCount > 0 ? newTrialCount : undefined,
      requiredRole: ['super_admin', 'branch_admin']
    },
    {
      name: 'ลงทะเบียนเรียน',
      href: '/enrollments',
      icon: Calendar,
      iconColor: 'text-green-600',
      requiredRole: ['super_admin', 'branch_admin']
    },
    {
      name: 'แชท',
      href: '/chat',
      icon: MessageCircle,
      iconColor: 'text-purple-500',
      badge: chatUnreadCount > 0 ? chatUnreadCount : undefined,
      requiredRole: ['super_admin', 'branch_admin']
    },
    {
      name: 'ลาและชดเชย',
      href: '/makeup',
      icon: Repeat,
      iconColor: 'text-yellow-600',
      badge: pendingMakeupCount > 0 ? pendingMakeupCount : undefined,
      requiredRole: ['super_admin', 'branch_admin']
    },
    {
      name: 'ลูกค้า',
      icon: Users,
      iconColor: 'text-blue-600',
      subItems: [
        {
          name: 'ผู้ปกครอง',
          href: '/parents',
          icon: Users,
          iconColor: 'text-sky-500',
          requiredRole: ['super_admin', 'branch_admin']
        },
        {
          name: 'นักเรียน',
          href: '/students',
          icon: UserCheck,
          iconColor: 'text-purple-600',
          requiredRole: ['super_admin', 'branch_admin']
        },
      ]
    },
    {
      name: 'divider-2',
      isDivider: true
    },
    // --- ข้อมูลพื้นฐาน & จัดการ ---
    {
      name: 'คลาสเรียน',
      href: '/classes',
      icon: GraduationCap,
      iconColor: 'text-orange-600',
      requiredRole: ['super_admin', 'branch_admin']
    },
    {
      name: 'ข้อมูลพื้นฐาน',
      icon: Building,
      iconColor: 'text-cyan-500',
      subItems: [
        {
          name: 'ห้องเรียน',
          href: '/rooms',
          icon: School,
          iconColor: 'text-indigo-500',
          requiredRole: ['super_admin', 'branch_admin']
        },
        {
          name: 'วันหยุด',
          href: '/holidays',
          icon: CalendarDays,
          iconColor: 'text-pink-500',
          requiredRole: ['super_admin', 'branch_admin']
        },
        {
          name: 'วิชา',
          href: '/subjects',
          icon: BookOpen,
          iconColor: 'text-green-500',
          requiredRole: ['super_admin', 'branch_admin']
        },
      ]
    },
    // Super admin: single unified page (admins + teachers + invites)
    {
      name: 'ผู้ใช้งาน และครู',
      href: '/users',
      icon: Users,
      iconColor: 'text-orange-500',
      requiredRole: ['super_admin']
    },
    // Branch admin: teacher profile management only (cannot access /users)
    {
      name: 'ครูผู้สอน',
      href: '/teachers',
      icon: UserCog,
      iconColor: 'text-purple-500',
      requiredRole: ['branch_admin']
    },
    {
      name: 'กิจกรรม',
      href: '/events',
      icon: CalendarDays,
      iconColor: 'text-pink-600',
      requiredRole: ['super_admin', 'branch_admin']
    },
    {
      name: 'divider-3',
      isDivider: true,
      sectionLabel: 'สำหรับครู'
    },
    // --- สำหรับครู ---
    {
      name: 'การสอน',
      icon: GraduationCap,
      iconColor: 'text-amber-500',
      requiredRole: ['super_admin', 'teacher'],
      subItems: [
        {
          name: 'สื่อการสอน',
          href: '/teaching-materials',
          icon: Layers,
          iconColor: 'text-violet-500',
          requiredRole: ['super_admin']
        },
        {
          name: 'Slides & เนื้อหา',
          href: '/teaching/slides',
          icon: Play,
          iconColor: 'text-rose-500',
          requiredRole: ['super_admin', 'teacher']
        },
      ]
    },
    {
      name: 'เช็คชื่อ',
      href: '/attendance',
      icon: UserCheck,
      iconColor: 'text-emerald-500',
      requiredRole: ['super_admin', 'branch_admin', 'teacher']
    },
    {
      name: 'Quiz',
      href: '/quizzes',
      icon: FileText,
      iconColor: 'text-sky-500',
      requiredRole: ['super_admin', 'teacher']
    },
    {
      name: 'คะแนนนักเรียน',
      href: '/quizzes/scores',
      icon: BarChart3,
      iconColor: 'text-indigo-500',
      requiredRole: ['super_admin', 'teacher']
    },
    {
      name: 'divider-4',
      isDivider: true
    },
    // --- รายงาน & ตั้งค่า ---
    {
      name: 'รายงาน',
      icon: BarChart3,
      iconColor: 'text-indigo-600',
      requiredRole: ['super_admin', 'branch_admin'],
      subItems: [
        {
          name: 'ทดลองเรียน',
          href: '/reports/trial',
          icon: TestTube,
          iconColor: 'text-cyan-600'
        },
        {
          name: 'สมัครเรียน',
          href: '/reports/enrollment',
          icon: UserCheck,
          iconColor: 'text-green-600'
        },
        {
          name: 'ตารางสอน',
          href: '/reports/schedule',
          icon: CalendarDays,
          iconColor: 'text-orange-600'
        },
        {
          name: 'ห้องและครูว่าง',
          href: '/reports/availability',
          icon: Calendar,
          iconColor: 'text-teal-600'
        },
        {
          name: 'นักเรียน',
          href: '/reports/students',
          icon: Users,
          iconColor: 'text-blue-600'
        },
        {
          name: 'Notification Logs',
          href: '/reports/notification-logs',
          icon: Bell,
          iconColor: 'text-purple-600'
        },
      ]
    },
    {
      name: 'บัญชี',
      icon: FileText,
      iconColor: 'text-emerald-600',
      requiredRole: ['super_admin', 'branch_admin'],
      subItems: [
        {
          name: 'ใบเสร็จรับเงิน',
          href: '/accounting/receipts',
          icon: Receipt,
          iconColor: 'text-emerald-500'
        },
        {
          name: 'ใบกำกับภาษี',
          href: '/accounting/invoices',
          icon: FileText,
          iconColor: 'text-blue-500'
        },
        {
          name: 'ใบลดหนี้',
          href: '/accounting/credit-notes',
          icon: CreditCard,
          iconColor: 'text-red-500'
        },
        {
          name: 'ใบบันทึกคืนเงิน',
          href: '/accounting/refund-notes',
          icon: CreditCard,
          iconColor: 'text-orange-500'
        },
      ]
    },
    {
      name: 'ตั้งค่า',
      icon: Settings,
      iconColor: 'text-gray-600',
      requiredPermission: 'canManageSettings',
      subItems: [
        { name: 'สาขา', href: '/settings/branches' },
        { name: 'ทั่วไป', href: '/settings/general' },
        { name: 'ลาและชดเชย', href: '/settings/makeup' },
        { name: 'การชำระเงิน', href: '/settings/payment' },
        { name: 'บริษัท (ออกบิล)', href: '/settings/invoice-company' },
        { name: 'เชื่อมแชท', href: '/settings/chat' },
        { name: 'Facebook Ads', href: '/settings/facebook' },
        { name: 'จัดการโรงเรียน', href: '/settings/schools' },
        { name: 'Backup', href: '/settings/backup' },
        { name: 'Data Cleaning', href: '/data-cleaning' },
      ]
    },
  ], [pendingMakeupCount, newTrialCount, chatUnreadCount]); // dependencies สำหรับ badges

  // ใช้ useMemo เพื่อ filter navigation
  const filteredNavigation = useMemo(
    () => filterNavigation(navigation), 
    [navigation, adminUser?.role]
  );

  // Auto-expand menu items based on current path
  useEffect(() => {
    const expandedMenus = filteredNavigation
      .filter(item => 
        item.subItems?.some(sub => sub.href && pathname.startsWith(sub.href))
      )
      .map(item => item.name);
    setExpandedItems(expandedMenus);
  }, [pathname, filteredNavigation]);

  // Reset navigating state when pathname changes หรือ timeout
  useEffect(() => {
    setNavigating(false);
  }, [pathname]);
  
  // Safety: Reset navigating ถ้าค้างเกิน 3 วินาที
  useEffect(() => {
    if (navigating) {
      const timeout = setTimeout(() => {
        setNavigating(false);
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [navigating]);

  const toggleExpanded = (itemName: string) => {
    setExpandedItems(prev =>
      prev.includes(itemName)
        ? prev.filter(name => name !== itemName)
        : [...prev, itemName]
    );
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  if (authLoading) {
    return <PageLoading />;
  }

  if (!user) {
    return null;
  }

  // auth โหลดเสร็จแล้วแต่ไม่พบข้อมูล admin user ในระบบ
  if (!adminUser) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center max-w-md p-8">
          <div className="text-red-500 text-5xl mb-4">⚠</div>
          <h2 className="text-xl font-bold text-foreground mb-2">ไม่พบข้อมูลผู้ดูแลระบบ</h2>
          <p className="text-muted-foreground mb-4">
            ไม่พบข้อมูลสิทธิ์สำหรับ email: {user?.email || 'ไม่ทราบ'}
            <br />กรุณาติดต่อผู้ดูแลระบบเพื่อเพิ่มสิทธิ์การใช้งาน
          </p>
          <Button onClick={() => signOut()} variant="outline">
            ออกจากระบบ
          </Button>
        </div>
      </div>
    );
  }

  // collect every leaf href so we can pick the MOST specific match.
  // plain const (NOT useMemo) — this runs after early returns above, so a hook here
  // would break the rules of hooks ("rendered more hooks than previous render").
  const allHrefs: string[] = [];
  const collectHrefs = (items: NavigationItem[]) => items.forEach((it) => {
    if (it.href) allHrefs.push(it.href);
    if (it.subItems) collectHrefs(it.subItems);
  });
  collectHrefs(navigation);

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === href;
    if (pathname === href) return true;
    if (!pathname.startsWith(href + '/')) return false;
    // not active if a more-specific menu item also matches (e.g. /quizzes vs /quizzes/scores)
    return !allHrefs.some((h) => h !== href && h.startsWith(href + '/') && (pathname === h || pathname.startsWith(h + '/')));
  };

  const isSubItemActive = (item: NavigationItem) => {
    return item.subItems?.some((sub) => sub.href && isActive(sub.href));
  };

  const handleNotificationClick = async (notif: Notification) => {
    if (notif.actionUrl) {
      router.push(notif.actionUrl);
    }
    await markNotificationAsRead(user.uid, notif.id);
    setNotifications(prev => prev.filter(n => n.id !== notif.id));
    setShowNotifications(false);
  };

  return (
    <div className="h-[100dvh] overflow-hidden bg-background">
      <div className="flex h-full">
        {/* Loading overlay — z-[100] to cover sidebar (z-50) */}
        {navigating && <Loading fullScreen size="lg" className="z-[100]" />}
        
        {/* Mobile menu overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        
        {/* Sidebar */}
        <div
          className={cn(
            'fixed inset-y-0 left-0 z-50 w-64 transform bg-[#ef443a] shadow-lg transition-all duration-200 ease-in-out lg:static lg:translate-x-0',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full',
            sidebarCollapsed ? 'lg:w-20' : 'lg:w-64'
          )}
        >
          <div className="flex h-full flex-col">
            {/* Logo */}
            <div className={cn('flex h-16 items-center justify-between border-b border-white/20 px-6', sidebarCollapsed && 'lg:justify-center lg:px-2')}>
              {/* Wordmark — hidden on desktop when collapsed (still shown in mobile drawer) */}
              <div className={cn('flex items-center', sidebarCollapsed && 'lg:hidden')}>
                <Image
                  src="/logo.svg"
                  alt="CodeLab School"
                  width={150}
                  height={40}
                  className="h-8 w-auto brightness-0 invert"
                  priority
                />
              </div>
              {/* Collapsed (desktop): small logo mark */}
              {sidebarCollapsed && (
                <Image
                  src="/logo-just-logo.svg"
                  alt="CodeLab"
                  width={32}
                  height={32}
                  className="hidden lg:block h-8 w-8 brightness-0 invert"
                />
              )}
              {/* Mobile close */}
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden ml-2"
              >
                <X className="h-6 w-6 text-white/80" />
              </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto px-4 py-6">
              {filteredNavigation.map((item) => {
                const ItemIcon = item.icon;

                return (
                  <div key={item.name} className={item.isDivider ? '' : 'mb-2'}>
                    {item.isDivider ? (
                      <div className="my-3 border-t border-white/20">
                        {item.sectionLabel && (
                          <div className={cn('pt-2 px-3 text-xs font-semibold text-white/60 uppercase tracking-wider', sidebarCollapsed && 'lg:hidden')}>
                            {item.sectionLabel}
                          </div>
                        )}
                      </div>
                    ) : item.subItems ? (
                      <>
                        <Tooltip label={sidebarCollapsed ? item.name : ''} side="right">
                        <button
                          onClick={() => {
                            // In collapsed rail, expand the sidebar first so submenu is usable
                            if (sidebarCollapsed) setSidebarCollapsed(false);
                            toggleExpanded(item.name);
                          }}
                          className={cn(
                            'flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-base font-medium transition-colors',
                            sidebarCollapsed && 'lg:justify-center',
                            isSubItemActive(item)
                              ? 'bg-white/20 text-white font-semibold'
                              : 'text-white/90 hover:bg-white/10'
                          )}
                        >
                          <div className="flex items-center">
                            {ItemIcon && <ItemIcon className={cn('mr-3 h-5 w-5 text-white/80', sidebarCollapsed && 'lg:mr-0')} />}
                            <span className={cn(sidebarCollapsed && 'lg:hidden')}>{item.name}</span>
                          </div>
                          <span className={cn(sidebarCollapsed && 'lg:hidden')}>
                            {expandedItems.includes(item.name) ? (
                              <ChevronDown className="h-4 w-4 text-white/60" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-white/60" />
                            )}
                          </span>
                        </button>
                        </Tooltip>
                        {expandedItems.includes(item.name) && (
                          <div className={cn('mt-2 ml-8 space-y-1', sidebarCollapsed && 'lg:hidden')}>
                            {item.subItems.map((subItem) => {
                              const SubItemIcon = subItem.icon;

                              return subItem.href ? (
                                <MenuLink
                                  key={subItem.name}
                                  href={subItem.href}
                                  className={cn(
                                    'flex items-center rounded-lg px-3 py-2 text-base font-medium transition-colors',
                                    isActive(subItem.href)
                                      ? 'bg-white/20 text-white font-semibold'
                                      : 'text-white/80 hover:bg-white/10'
                                  )}
                                  onClick={() => {
                                    // เช็คว่าถ้ากำลังอยู่ที่หน้านี้อยู่แล้ว ไม่ต้องทำอะไร
                                    if (pathname !== subItem.href) {
                                      setSidebarOpen(false);
                                      setNavigating(true);
                                    }
                                  }}
                                >
                                  {SubItemIcon && <SubItemIcon className="mr-3 h-4 w-4 text-white/70" />}
                                  {subItem.name}
                                </MenuLink>
                              ) : null;
                            })}
                          </div>
                        )}
                      </>
                    ) : item.href ? (
                      <Tooltip label={sidebarCollapsed ? item.name : ''} side="right">
                      <span className="block">
                      <MenuLink
                        href={item.href}
                        className={cn(
                          'relative flex items-center rounded-lg px-3 py-2.5 text-base font-medium transition-colors',
                          sidebarCollapsed && 'lg:justify-center',
                          isActive(item.href)
                            ? 'bg-white/20 text-white font-semibold'
                            : 'text-white/90 hover:bg-white/10'
                        )}
                        onClick={() => {
                          setSidebarOpen(false);
                          setNavigating(true);
                        }}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center">
                            {ItemIcon && <ItemIcon className={cn('mr-3 h-5 w-5 text-white/80', sidebarCollapsed && 'lg:mr-0')} />}
                            <span className={cn(sidebarCollapsed && 'lg:hidden')}>{item.name}</span>
                          </div>
                          {item.badge && (
                            <span className={cn('ml-auto inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 text-xs font-bold text-[#ef443a] bg-[#ffffff] rounded-full', sidebarCollapsed && 'lg:hidden')}>
                              {item.badge}
                            </span>
                          )}
                        </div>
                        {/* Collapsed rail: show a dot instead of the count */}
                        {item.badge && sidebarCollapsed && (
                          <span className="hidden lg:block absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-white" />
                        )}
                      </MenuLink>
                      </span>
                      </Tooltip>
                    ) : null}
                  </div>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top bar */}
          <header className="h-16 bg-card border-b border-border shadow-sm px-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden"
              >
                <Menu className="h-6 w-6 text-muted-foreground" />
              </button>

              {/* Desktop sidebar collapse/expand toggle */}
              <Tooltip label={sidebarCollapsed ? 'ขยายเมนู' : 'ย่อเมนู'}>
                <button
                  onClick={() => setSidebarCollapsed((v) => !v)}
                  className="hidden lg:inline-flex text-muted-foreground hover:text-foreground"
                  aria-label={sidebarCollapsed ? 'ขยายเมนู' : 'ย่อเมนู'}
                >
                  {sidebarCollapsed ? <PanelLeftOpen className="h-6 w-6" /> : <PanelLeftClose className="h-6 w-6" />}
                </button>
              </Tooltip>

              {/* Branch Selector - Desktop */}
              <div className="hidden lg:flex items-center gap-4">
                <BranchSelector />

                {/* Role Indicator */}
                {adminUser && (
                  <>
                    {adminUser.role === 'super_admin' && (
                      <div className="text-sm font-medium px-3 py-1 rounded-md flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20">
                        <Shield className="h-3.5 w-3.5" />
                        Super Admin
                      </div>
                    )}
                    {adminUser.role === 'branch_admin' && (
                      <div className="text-sm font-medium px-3 py-1 rounded-md flex items-center gap-1.5 bg-accent text-accent-foreground border border-border">
                        <Building2 className="h-3.5 w-3.5" />
                        Branch Admin
                      </div>
                    )}
                    {adminUser.role === 'teacher' && (
                      <div className="text-sm font-medium px-3 py-1 rounded-md flex items-center gap-1.5 bg-muted text-muted-foreground border border-border">
                        <UserCog className="h-3.5 w-3.5" />
                        Teacher
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Mobile Branch Selector and Right Side Items */}
            <div className="flex items-center gap-4 ml-auto">
              {/* Branch Selector - Mobile */}
              <div className="lg:hidden">
                <BranchSelector />
              </div>

              {/* Theme Toggle */}
              <ThemeToggle />

              {/* Notification Bell */}
              <div className="relative">
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative notification-bell"
                  onClick={() => setShowNotifications(!showNotifications)}
                >
                  <Bell className="h-5 w-5 text-muted-foreground" />
                  {notifications.length > 0 && (
                    <span className="absolute -top-1 -right-1 h-5 w-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center">
                      {notifications.length}
                    </span>
                  )}
                </Button>

                {/* Notification Dropdown */}
                {showNotifications && (
                  <div className="notification-dropdown absolute right-0 mt-2 w-80 bg-popover text-popover-foreground rounded-lg shadow-lg border border-border z-50">
                    <div className="p-4 border-b border-border">
                      <h3 className="font-semibold">การแจ้งเตือน</h3>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <p className="p-4 text-muted-foreground text-center">ไม่มีการแจ้งเตือนใหม่</p>
                      ) : (
                        notifications.map(notif => (
                          <div
                            key={notif.id}
                            className="p-4 border-b border-border hover:bg-muted cursor-pointer"
                            onClick={() => handleNotificationClick(notif)}
                          >
                            <p className="font-medium text-sm">{notif.title}</p>
                            <p className="text-sm text-muted-foreground mt-1">{notif.body}</p>
                            <p className="text-xs text-muted-foreground/70 mt-2">
                              {formatDate(notif.sentAt, 'short')}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* User Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="relative h-10 w-10 rounded-full"
                  >
                    <Avatar>
                      <AvatarImage
                        src={user.photoURL || ''}
                        alt={user.displayName || ''}
                      />
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {user.displayName?.charAt(0) || 'A'}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {adminUser?.displayName || user.displayName || 'Admin'}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user.email}
                      </p>
                      {adminUser && (
                        <Badge 
                          variant="secondary" 
                          className="mt-1 text-xs w-fit"
                        >
                          {adminUser.role === 'super_admin' ? 'Super Admin' : 
                           adminUser.role === 'branch_admin' ? 'Branch Admin' : 'Teacher'}
                        </Badge>
                      )}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  
                  <DropdownMenuItem 
                    onClick={() => {
                      router.push('/profile');
                    }}
                  >
                    <UserIcon className="mr-2 h-4 w-4 text-blue-500" />
                    <span>โปรไฟล์ของฉัน</span>
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem 
                    onClick={() => {
                      router.push('/profile/change-password');
                    }}
                  >
                    <Key className="mr-2 h-4 w-4 text-amber-500" />
                    <span>เปลี่ยนรหัสผ่าน</span>
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator />
                  
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4 text-red-500" />
                    <span>ออกจากระบบ</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {/* Page content */}
          <main className="h-[calc(100%-4rem)] overflow-y-auto overflow-x-hidden overscroll-contain">
            <div className="p-4 md:p-6 pb-12">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

// Main Layout Component with Providers
export default function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <LoadingProvider>
      <BranchProvider>
        <AdminLayoutContent>
          {children}
        </AdminLayoutContent>
      </BranchProvider>
    </LoadingProvider>
  );
}