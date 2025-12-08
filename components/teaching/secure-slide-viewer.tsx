'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  X,
  Maximize2, 
  Minimize2,
  BookOpen,
  ArrowLeft,
  RotateCcw,
  HelpCircle
} from 'lucide-react';
import { TeachingMaterial, Class } from '@/types/models';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface SecureSlideViewerProps {
  material: TeachingMaterial;
  classInfo: Class;
  onBack: () => void;
}

export default function SecureSlideViewer({ 
  material,
  classInfo,
  onBack 
}: SecureSlideViewerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);

  // Toggle CSS fullscreen
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Refresh iframe (เพื่อ restart slides)
  const refreshSlides = () => {
    setIframeKey(prev => prev + 1);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFullscreen) {
          setIsFullscreen(false);
        } else {
          onBack();
        }
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === 'h' || e.key === 'H') {
        setShowControls(!showControls);
      } else if (e.key === 'i' || e.key === 'I') {
        setShowInfo(!showInfo);
      } else if (e.key === 'r' || e.key === 'R') {
        refreshSlides();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [showControls, showInfo, isFullscreen, onBack]);

  // Prevent right-click context menu on iframe
  useEffect(() => {
    const preventRightClick = (e: MouseEvent) => {
      e.preventDefault();
    };
    
    document.addEventListener('contextmenu', preventRightClick);
    return () => document.removeEventListener('contextmenu', preventRightClick);
  }, []);

  // Fullscreen mode
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 bg-black z-[9999] flex flex-col">
        {/* Controls - Fullscreen */}
        {showControls && (
          <div className="bg-black bg-opacity-80 text-white p-4 flex justify-between items-center">
            <div>
              <h2 className="font-semibold text-lg">{material.title}</h2>
              <p className="text-sm opacity-80">{classInfo.name} - ครั้งที่ {material.sessionNumber}</p>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={refreshSlides}
                title="Refresh Slides (R)"
                className="bg-white text-black border-gray-300 hover:bg-gray-100"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={toggleFullscreen}
                title="Exit Fullscreen (F)"
                className="bg-white text-black border-gray-300 hover:bg-gray-100"
              >
                <Minimize2 className="h-4 w-4" />
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowInfo(!showInfo)}
                title="Toggle Info (I)"
                className="bg-white text-black border-gray-300 hover:bg-gray-100"
              >
                <BookOpen className="h-4 w-4" />
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowControls(false)}
                title="Hide controls (H)"
                className="bg-white text-black border-gray-300 hover:bg-gray-100"
              >
                Hide
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={onBack}
                title="Back (Esc)"
                className="bg-red-500 text-white border-red-500 hover:bg-red-600"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 flex">
          {/* Slide Content */}
          <div className={`${showInfo && showControls ? 'w-3/4' : 'w-full'} relative`}>
            <iframe
              key={iframeKey}
              src={material.embedUrl}
              className="w-full h-full border-none"
              allowFullScreen
              allow="autoplay; fullscreen"
              style={{
                // ป้องกันการแสดง URL
                pointerEvents: 'auto',
              }}
              onContextMenu={(e) => e.preventDefault()}
            />
            
            {/* Overlay to prevent URL inspection */}
            <div 
              className="absolute inset-0 pointer-events-none"
              style={{ zIndex: -1 }}
            />
          </div>

          {/* Info Panel */}
          {showInfo && showControls && (
            <div className="w-1/4 bg-black bg-opacity-90 text-white p-4 overflow-y-auto">
              <h3 className="font-semibold mb-4">ข้อมูลการสอน</h3>
              
              <div className="space-y-4 text-sm">
                <div>
                  <div className="font-medium text-blue-300 mb-2">🎯 จุดประสงค์การเรียนรู้</div>
                  <ul className="list-disc list-inside space-y-1 text-gray-300">
                    {material.objectives.map((obj: string, index: number) => (
                      <li key={index}>{obj}</li>
                    ))}
                  </ul>
                </div>
                
                <div>
                  <div className="font-medium text-green-300 mb-2">📦 อุปกรณ์ที่ใช้</div>
                  <div className="flex flex-wrap gap-1">
                    {material.materials?.map((item: string, index: number) => (
                      <span key={index} className="bg-gray-700 px-2 py-1 rounded text-xs">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
                
                {material.preparation && material.preparation.length > 0 && (
                  <div>
                    <div className="font-medium text-yellow-300 mb-2">✅ เตรียมการ</div>
                    <ul className="list-disc list-inside space-y-1 text-gray-300 text-xs">
                      {material.preparation.map((prep: string, index: number) => (
                        <li key={index}>{prep}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {material.teachingNotes && (
                  <div>
                    <div className="font-medium text-orange-300 mb-2">📝 บันทึกสำหรับครู</div>
                    <p className="text-gray-300 text-xs whitespace-pre-wrap">
                      {material.teachingNotes}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Controls */}
        {showControls && (
          <div className="bg-black bg-opacity-70 px-4 py-2 text-xs text-white">
            <div className="flex justify-center gap-6">
              <span>🎯 โหมดการสอน</span>
              <span><kbd className="bg-gray-700 px-1 rounded">H</kbd> ซ่อน/แสดง</span>
              <span><kbd className="bg-gray-700 px-1 rounded">I</kbd> ข้อมูล</span>
              <span><kbd className="bg-gray-700 px-1 rounded">F</kbd> ออก</span>
              <span><kbd className="bg-gray-700 px-1 rounded">R</kbd> รีเฟรช</span>
              <span><kbd className="bg-gray-700 px-1 rounded">Esc</kbd> กลับ</span>
            </div>
          </div>
        )}

        {/* Hidden controls button */}
        {!showControls && (
          <div className="absolute bottom-4 right-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowControls(true)}
              className="bg-white text-black border-gray-300 hover:bg-gray-100"
            >
              Show Controls
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Normal mode
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div>
          <Button 
            onClick={onBack}
            variant="outline" 
            size="sm"
            className="mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            กลับ
          </Button>
          
          <h1 className="text-2xl font-bold">{material.title}</h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 mt-1">
            <span>ครั้งที่ {material.sessionNumber}</span>
            <span>•</span>
            <span>{classInfo.name}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshSlides}
            title="Refresh Slides (R)"
          >
            <RotateCcw className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">รีเฟรช</span>
          </Button>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                title="Keyboard Shortcuts"
              >
                <HelpCircle className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="end">
              <div className="space-y-2">
                <h4 className="font-medium text-sm mb-2">คีย์ลัด</h4>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span><kbd className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">F</kbd></span>
                    <span className="text-gray-600">เต็มจอ/ออกจากเต็มจอ</span>
                  </div>
                  <div className="flex justify-between">
                    <span><kbd className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">H</kbd></span>
                    <span className="text-gray-600">ซ่อน/แสดง Controls</span>
                  </div>
                  <div className="flex justify-between">
                    <span><kbd className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">I</kbd></span>
                    <span className="text-gray-600">แสดงข้อมูล (เต็มจอ)</span>
                  </div>
                  <div className="flex justify-between">
                    <span><kbd className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">R</kbd></span>
                    <span className="text-gray-600">รีเฟรช Slides</span>
                  </div>
                  <div className="flex justify-between">
                    <span><kbd className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">Esc</kbd></span>
                    <span className="text-gray-600">ออก/กลับ</span>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          
          <Button
            size="sm"
            onClick={toggleFullscreen}
            title="Fullscreen (F)"
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Maximize2 className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">เต็มจอ</span>
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="space-y-4">
        {/* Slide Content - Full Width */}
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="relative bg-black">
              <iframe
                key={iframeKey}
                src={material.embedUrl}
                className="w-full h-[400px] sm:h-[500px] lg:h-[600px] border-none"
                allowFullScreen
                allow="autoplay; fullscreen"
                onContextMenu={(e) => e.preventDefault()}
              />
            </div>
          </CardContent>
        </Card>

        {/* Session Info - 2 columns grid */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Learning Objectives */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-1">
                <span>🎯</span>
                <span>จุดประสงค์การเรียนรู้</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {material.objectives.map((obj: string, index: number) => (
                  <li key={index} className="text-gray-700">{obj}</li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Materials */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-1">
                <span>📦</span>
                <span>อุปกรณ์ที่ใช้</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {material.materials?.map((item: string, index: number) => (
                  <li key={index} className="text-gray-700">{item}</li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Preparation */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-1">
                <span>✅</span>
                <span>เตรียมการก่อนสอน</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {material.preparation && material.preparation.length > 0 ? (
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {material.preparation.map((prep: string, index: number) => (
                    <li key={index} className="text-gray-700">{prep}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">ไม่มีข้อมูล</p>
              )}
            </CardContent>
          </Card>

          {/* Teaching Notes */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-1">
                <span>📝</span>
                <span>บันทึกสำหรับครู</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {material.teachingNotes ? (
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{material.teachingNotes}</p>
              ) : (
                <p className="text-sm text-gray-500">ไม่มีข้อมูล</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}