'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, School, MessageSquare, Repeat, Database } from 'lucide-react';
import GeneralSettingsComponent from './general-settings';
import LineSettingsComponent from './line-settings';
import MakeupSettingsComponent from './makeup-settings';
import BackupLogsTab from './backup-logs-tab';

export default function SettingsPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Settings className="h-8 w-8 text-red-500" />
          ตั้งค่าระบบ
        </h1>
        <p className="text-gray-600 mt-2">จัดการการตั้งค่าต่างๆ ของระบบ</p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general">
            <School className="h-4 w-4 mr-2" />
            ตั้งค่าทั่วไป
          </TabsTrigger>
          <TabsTrigger value="makeup">
            <Repeat className="h-4 w-4 mr-2" />
            ลาและชดเชย
          </TabsTrigger>
          <TabsTrigger value="line">
            <MessageSquare className="h-4 w-4 mr-2" />
            LINE Integration
          </TabsTrigger>
          <TabsTrigger value="backup">
            <Database className="h-4 w-4 mr-2" />
            Backup
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <GeneralSettingsComponent />
        </TabsContent>
        
        <TabsContent value="makeup">
          <MakeupSettingsComponent />
        </TabsContent>
        
        <TabsContent value="line">
          <LineSettingsComponent />
        </TabsContent>

        <TabsContent value="backup">
          <BackupLogsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}