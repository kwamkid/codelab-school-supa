'use client';

import { useState, useEffect } from 'react';
import { FormSelect } from '@/components/ui/form-select';
import { getActiveBranches } from '@/lib/services/branches';
import { Branch } from '@/types/models';

interface BranchSelectorProps {
  value: string;
  onChange: (value: string) => void;
  showAllOption?: boolean;
}

export default function BranchSelector({ value, onChange, showAllOption = true }: BranchSelectorProps) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBranches();
  }, []);

  const loadBranches = async () => {
    try {
      const data = await getActiveBranches();
      setBranches(data);
    } catch (error) {
      console.error('Error loading branches:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormSelect
      value={value}
      onValueChange={onChange}
      placeholder="เลือกสาขา"
      className="w-[200px]"
      options={[
        ...(showAllOption ? [{ value: 'all', label: 'ทุกสาขา' }] : []),
        ...branches.map((branch) => ({
          value: branch.id,
          label: branch.name,
        })),
      ]}
    />
  );
}