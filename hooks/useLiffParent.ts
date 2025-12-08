import { useState, useEffect } from 'react';
import { Parent, Student } from '@/types/models';
import { getParentByLineId, getStudentsByParent } from '@/lib/services/parents';
import { useLiff } from '@/components/liff/liff-provider';

interface UseLiffParentReturn {
  parent: Parent | null;
  students: Student[];
  loading: boolean;
  error: Error | null;
  isRegistered: boolean;
  refetch: () => Promise<void>;
}

export function useLiffParent(): UseLiffParentReturn {
  const { profile, isLoggedIn, isLoading: liffLoading } = useLiff();
  const [parent, setParent] = useState<Parent | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [hasChecked, setHasChecked] = useState(false);

  const fetchParentData = async () => {
    // Don't fetch if LIFF is still loading
    if (liffLoading) {
      console.log('[useLiffParent] LIFF still loading, skipping fetch');
      return;
    }

    // Don't fetch if not logged in
    if (!isLoggedIn || !profile?.userId) {
      console.log('[useLiffParent] Not logged in or no profile');
      setParent(null);
      setStudents([]);
      setLoading(false);
      setHasChecked(true);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log('[useLiffParent] Fetching parent data for:', profile.userId);

      // Get parent by LINE ID
      const parentData = await getParentByLineId(profile.userId);
      
      if (parentData) {
        console.log('[useLiffParent] Found parent:', parentData.id);
        setParent(parentData);
        
        // Get students
        const studentsData = await getStudentsByParent(parentData.id);
        const activeStudents = studentsData.filter(s => s.isActive);
        console.log('[useLiffParent] Found students:', activeStudents.length);
        setStudents(activeStudents);
      } else {
        console.log('[useLiffParent] No parent found');
        setParent(null);
        setStudents([]);
      }
    } catch (err) {
      console.error('[useLiffParent] Error fetching parent data:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
      setHasChecked(true);
    }
  };

  // Effect to handle LIFF loading state
  useEffect(() => {
    // If LIFF is still loading, keep our loading state true
    if (liffLoading) {
      setLoading(true);
      return;
    }

    // LIFF has finished loading, now we can check parent data
    if (!hasChecked && isLoggedIn && profile?.userId) {
      fetchParentData();
    } else if (!isLoggedIn) {
      // Not logged in
      setParent(null);
      setStudents([]);
      setLoading(false);
      setHasChecked(true);
    }
  }, [liffLoading, isLoggedIn, profile?.userId, hasChecked]);

  return {
    parent,
    students,
    loading: loading || liffLoading, // Include LIFF loading state
    error,
    isRegistered: !!parent,
    refetch: fetchParentData,
  };
}