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
  LucideIcon
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { LoadingProvider } from '@/contexts/LoadingContext';
import { BranchProvider, useBranch } from '@/contexts/BranchContext';
import { BranchSelector } from '@/components/layout/branch-selector';
import { PageLoading } from '@/components/ui/loading';
import { getMakeupClasses } from '@/lib/services/makeup';
import { getTrialBookings } from '@/lib/services/trial-bookings';
import { getUnreadNotifications, markNotificationAsRead } from '@/lib/services/notifications';
import { formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Notification } from '@/types/models';

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
}

// MenuLink props type
interface MenuLinkProps {
  href: string;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

// Custom Link component with loading
const MenuLink = ({ href, children, className, onClick }: MenuLinkProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  
  const handleClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
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
    <Link href={href} onClick={handleClick} className={className}>
      {isLoading ? (
        <div className="flex items-center">
          <Loader2 className="mr-3 h-4 w-4 animate-spin" />
          <span className="opacity-70">กำลังโหลด...</span>
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
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [navigating, setNavigating] = useState(false);
  
  // Makeup badge state
  const [pendingMakeupCount, setPendingMakeupCount] = useState(0);
  
  // Trial booking badge state
  const [newTrialCount, setNewTrialCount] = useState(0);
  
  // Notifications state
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // Load pending makeup count - กรองตาม branch ที่เลือก
  useEffect(() => {
    const loadMakeupCount = async () => {
      try {
        const makeupClasses = await getMakeupClasses();
        
        // ถ้าเลือก "ทุกสาขา" ให้นับทั้งหมดที่ pending
        if (!selectedBranchId) {
          const pendingCount = makeupClasses.filter(
            m => m.status === 'pending' // นับทั้งหมดที่ pending ไม่สนใจ requestedBy
          ).length;
          setPendingMakeupCount(pendingCount);
          return;
        }
        
        // ถ้าเลือกสาขาเฉพาะ ต้องโหลด classes เพื่อเช็ค branchId
        const { getClass } = await import('@/lib/services/classes');
        
        // สร้าง map ของ classId -> branchId เพื่อประสิทธิภาพ
        const classBranchMap = new Map<string, string>();
        
        // ดึง branchId ของ classes ที่เกี่ยวข้องเท่านั้น
        const uniqueClassIds = [...new Set(makeupClasses.map(m => m.originalClassId))];
        await Promise.all(
          uniqueClassIds.map(async (classId) => {
            try {
              const classData = await getClass(classId);
              if (classData) {
                classBranchMap.set(classId, classData.branchId);
              }
            } catch (error) {
              console.error(`Error loading class ${classId}:`, error);
            }
          })
        );
        
        // กรอง makeup classes ที่อยู่ในสาขาที่เลือก
        const filteredMakeups = makeupClasses.filter(m => {
          // ถ้ามี makeupSchedule แล้ว ใช้ branchId จาก makeupSchedule
          if (m.makeupSchedule?.branchId) {
            return m.makeupSchedule.branchId === selectedBranchId;
          }
          // ถ้ายังไม่มี (pending) ใช้ branchId จาก original class
          const classBranchId = classBranchMap.get(m.originalClassId);
          return classBranchId === selectedBranchId;
        });
        
        // นับทั้งหมดที่เป็น pending ไม่สนใจ requestedBy
        const pendingCount = filteredMakeups.filter(
          m => m.status === 'pending' // นับทั้งหมดที่ pending
        ).length;

        setPendingMakeupCount(pendingCount);
      } catch (error) {
        console.error('Error loading makeup count:', error);
      }
    };
    
    if (user) {
      loadMakeupCount();
      // Refresh ทุก 30 วินาที
      const interval = setInterval(loadMakeupCount, 30000);
      return () => clearInterval(interval);
    }
  }, [user, selectedBranchId]); // เพิ่ม selectedBranchId ใน dependency

  // Load new trial bookings count - กรองตาม branch ที่เลือก
  useEffect(() => {
    const loadTrialCount = async () => {
      try {
        // ดึงข้อมูล trial bookings (กรองตาม selectedBranchId)
        const bookings = await getTrialBookings(selectedBranchId);
        
        // นับเฉพาะที่มีสถานะ 'new' (รอติดต่อ)
        const newBookings = bookings.filter(b => b.status === 'new').length;
        setNewTrialCount(newBookings);
      } catch (error) {
        console.error('Error loading trial count:', error);
      }
    };
    
    if (user) {
      loadTrialCount();
      const interval = setInterval(loadTrialCount, 30000);
      return () => clearInterval(interval);
    }
  }, [user, selectedBranchId]);

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
      const interval = setInterval(loadNotifications, 60000);
      return () => clearInterval(interval);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

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
    return items.filter(item => {
      if (item.isDivider) return true;
      
      if (item.requiredRole && adminUser) {
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
    { 
      name: 'Dashboard', 
      href: '/dashboard', 
      icon: Home,
      iconColor: 'text-blue-500'
    },
    { 
      name: 'divider-1',
      isDivider: true 
    },
    {
      name: 'ผู้ใช้งาน และครู',
      icon: Users,
      iconColor: 'text-orange-500',
      requiredRole: ['super_admin', 'branch_admin'],
      subItems: [
        { 
          name: 'ผู้ดูแลระบบ', 
          href: '/users', 
          icon: Shield,
          iconColor: 'text-red-500',
          requiredRole: ['super_admin']
        },
        { 
          name: 'ครูผู้สอน', 
          href: '/teachers', 
          icon: UserCog,
          iconColor: 'text-purple-500',
          requiredRole: ['super_admin', 'branch_admin']
        },
      ]
    },
    {
      name: 'ข้อมูลพื้นฐาน',
      icon: Building,
      iconColor: 'text-cyan-500',
      subItems: [
        { 
          name: 'สาขา', 
          href: '/branches', 
          icon: Building2,
          iconColor: 'text-teal-500',
          requiredRole: ['super_admin']
        },
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
          requiredRole: ['super_admin']
        },
      ]
    },
    { 
      name: 'divider-2',
      isDivider: true 
    },
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
      requiredRole: ['super_admin', 'branch_admin','teacher']
    },
    { 
      name: 'divider-3',
      isDivider: true 
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
      name: 'คลาสเรียน', 
      href: '/classes', 
      icon: GraduationCap,
      iconColor: 'text-orange-600'
    },
    { 
      name: 'ลงทะเบียนเรียน', 
      href: '/enrollments', 
      icon: Calendar,
      iconColor: 'text-green-600',
      requiredRole: ['super_admin', 'branch_admin']
    },
    { 
      name: 'ลาและชดเชย', 
      href: '/makeup', 
      icon: Repeat,
      iconColor: 'text-yellow-600',
      badge: pendingMakeupCount > 0 ? pendingMakeupCount : undefined
    },
    { 
      name: 'ทดลองเรียน', 
      href: '/trial', 
      icon: TestTube,
      iconColor: 'text-cyan-600',
      badge: newTrialCount > 0 ? newTrialCount : undefined,
      requiredRole: ['super_admin', 'branch_admin']
    },
    { 
      name: 'กิจกรรม', 
      href: '/events', 
      icon: CalendarDays,
      iconColor: 'text-pink-600',
      requiredRole: ['super_admin', 'branch_admin']
    },
    { 
      name: 'divider-4',
      isDivider: true 
    },
    {
      name: 'รายงาน',
      icon: BarChart3,
      iconColor: 'text-indigo-600',
      requiredRole: ['super_admin', 'branch_admin'],
      subItems: [
        { 
          name: 'ห้องและครูว่าง', 
          href: '/reports/availability', 
          icon: Calendar,
          iconColor: 'text-teal-600'
        },
      ]
    },
    { 
      name: 'ตั้งค่า', 
      href: '/settings', 
      icon: Settings,
      iconColor: 'text-gray-600',
      requiredPermission: 'canManageSettings'
    },
  ], [pendingMakeupCount, newTrialCount]); // dependencies สำหรับ badges

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

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  const isSubItemActive = (item: NavigationItem) => {
    return item.subItems?.some((sub) => sub.href && pathname.startsWith(sub.href));
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
    <div className="h-screen overflow-hidden bg-gray-50">
      <div className="flex h-full">
        {/* Loading overlay */}
        {navigating && <PageLoading />}
        
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
            'fixed inset-y-0 left-0 z-50 w-64 transform bg-white shadow-lg transition-transform duration-200 ease-in-out lg:static lg:translate-x-0',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <div className="flex h-full flex-col">
            {/* Logo */}
            <div className="flex h-16 items-center justify-between px-6 border-b">
              <div className="w-full">
                <Image 
                  src="/logo.svg" 
                  alt="CodeLab School" 
                  width={150}
                  height={40}
                  className="w-full max-w-[180px]"
                  priority
                />
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden ml-2"
              >
                <X className="h-6 w-6 text-gray-500" />
              </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto px-4 py-6">
              {filteredNavigation.map((item) => {
                const ItemIcon = item.icon;
                
                return (
                  <div key={item.name} className={item.isDivider ? '' : 'mb-2'}>
                    {item.isDivider ? (
                      <div className="my-3 border-t border-gray-200" />
                    ) : item.subItems ? (
                      <>
                        <button
                          onClick={() => toggleExpanded(item.name)}
                          className={cn(
                            'flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-base font-normal transition-colors',
                            isSubItemActive(item)
                              ? 'bg-red-50/50 text-red-600'
                              : 'text-gray-700 hover:bg-gray-50'
                          )}
                        >
                          <div className="flex items-center">
                            {ItemIcon && <ItemIcon className={cn("mr-3 h-5 w-5", item.iconColor || 'text-gray-500')} />}
                            {item.name}
                          </div>
                          {expandedItems.includes(item.name) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                        {expandedItems.includes(item.name) && (
                          <div className="mt-2 ml-8 space-y-1">
                            {item.subItems.map((subItem) => {
                              const SubItemIcon = subItem.icon;
                              
                              return subItem.href ? (
                                <MenuLink
                                  key={subItem.name}
                                  href={subItem.href}
                                  className={cn(
                                    'flex items-center rounded-lg px-3 py-2 text-base font-normal transition-colors',
                                    isActive(subItem.href)
                                      ? 'bg-red-50 text-red-600'
                                      : 'text-gray-600 hover:bg-gray-50'
                                  )}
                                  onClick={() => {
                                    // เช็คว่าถ้ากำลังอยู่ที่หน้านี้อยู่แล้ว ไม่ต้องทำอะไร
                                    if (pathname !== subItem.href) {
                                      setSidebarOpen(false);
                                      setNavigating(true);
                                    }
                                  }}
                                >
                                  {SubItemIcon && <SubItemIcon className={cn("mr-3 h-4 w-4", subItem.iconColor || 'text-gray-500')} />}
                                  {subItem.name}
                                </MenuLink>
                              ) : null;
                            })}
                          </div>
                        )}
                      </>
                    ) : item.href ? (
                      <MenuLink
                        href={item.href}
                        className={cn(
                          'flex items-center rounded-lg px-3 py-2.5 text-base font-normal transition-colors',
                          isActive(item.href)
                            ? 'bg-red-50/50 text-red-600'
                            : 'text-gray-700 hover:bg-gray-50'
                        )}
                        onClick={() => {
                          setSidebarOpen(false);
                          setNavigating(true);
                        }}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center">
                            {ItemIcon && <ItemIcon className={cn("mr-3 h-5 w-5", item.iconColor || 'text-gray-500')} />}
                            {item.name}
                          </div>
                          {item.badge && (
                            <span className="ml-auto inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 text-xs font-medium text-white bg-red-500 rounded-full">
                              {item.badge}
                            </span>
                          )}
                        </div>
                      </MenuLink>
                    ) : null}
                  </div>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Top bar */}
          <header className="h-16 bg-white shadow-sm px-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden"
              >
                <Menu className="h-6 w-6 text-gray-500" />
              </button>

              {/* Branch Selector - Desktop */}
              <div className="hidden lg:flex items-center gap-4">
                <BranchSelector />
                
                {/* Role Indicator */}
                {adminUser && (
                  <div className="text-sm text-gray-600 px-3 py-1 bg-gray-100 rounded-md">
                    {adminUser.role === 'super_admin' && (
                      <span className="flex items-center gap-1">
                        <Shield className="h-3.5 w-3.5 text-red-500" />
                        Super Admin
                      </span>
                    )}
                    {adminUser.role === 'branch_admin' && (
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5 text-teal-500" />
                        Branch Admin
                      </span>
                    )}
                    {adminUser.role === 'teacher' && (
                      <span className="flex items-center gap-1">
                        <UserCog className="h-3.5 w-3.5 text-purple-500" />
                        Teacher
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Mobile Branch Selector and Right Side Items */}
            <div className="flex items-center gap-4 ml-auto">
              {/* Branch Selector - Mobile */}
              <div className="lg:hidden">
                <BranchSelector />
              </div>

              {/* Notification Bell */}
              <div className="relative">
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative notification-bell"
                  onClick={() => setShowNotifications(!showNotifications)}
                >
                  <Bell className="h-5 w-5 text-gray-600" />
                  {notifications.length > 0 && (
                    <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                      {notifications.length}
                    </span>
                  )}
                </Button>
                
                {/* Notification Dropdown */}
                {showNotifications && (
                  <div className="notification-dropdown absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border z-50">
                    <div className="p-4 border-b">
                      <h3 className="font-semibold">การแจ้งเตือน</h3>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <p className="p-4 text-gray-500 text-center">ไม่มีการแจ้งเตือนใหม่</p>
                      ) : (
                        notifications.map(notif => (
                          <div
                            key={notif.id}
                            className="p-4 border-b hover:bg-gray-50 cursor-pointer"
                            onClick={() => handleNotificationClick(notif)}
                          >
                            <p className="font-medium text-sm">{notif.title}</p>
                            <p className="text-sm text-gray-600 mt-1">{notif.body}</p>
                            <p className="text-xs text-gray-400 mt-2">
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
                      <AvatarFallback>
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