'use client';

import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Copy, 
  Printer, 
  RefreshCw, 
  Loader2,
  Check,
  ExternalLink,
  AlertCircle
} from 'lucide-react';
import { generateLinkToken } from '@/lib/services/link-tokens';
import { toast } from 'sonner';

interface LinkAccountQRProps {
  parentId: string;
  parentName: string;
  parentPhone: string;
}

export function LinkAccountQR({ parentId, parentName, parentPhone }: LinkAccountQRProps) {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const generateToken = async () => {
    try {
      setLoading(true);
      setError('');
      const newToken = await generateLinkToken(parentId);
      setToken(newToken);
    } catch (err) {
      console.error('Error generating token:', err);
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
      toast.error('ไม่สามารถสร้างลิงก์ได้');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    generateToken();
  }, [parentId]);

  const linkUrl = `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/liff/link-account?token=${token}`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(linkUrl);
      setCopied(true);
      toast.success('คัดลอกลิงก์แล้ว');
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      toast.error('ไม่สามารถคัดลอกได้');
    }
  };

  const printQR = () => {
    const printWindow = window.open('', 'PRINT', 'height=600,width=800');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>QR Code - ${parentName}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
            }
            .container {
              text-align: center;
              padding: 40px;
              border: 2px solid #e5e7eb;
              border-radius: 12px;
            }
            h1 {
              margin: 0 0 10px 0;
              font-size: 24px;
              color: #111827;
            }
            .info {
              margin-bottom: 30px;
              color: #6b7280;
            }
            .qr-wrapper {
              margin: 30px 0;
            }
            .instructions {
              margin-top: 30px;
              padding: 20px;
              background: #f3f4f6;
              border-radius: 8px;
              text-align: left;
            }
            .instructions h2 {
              margin: 0 0 10px 0;
              font-size: 18px;
              color: #111827;
            }
            .instructions ol {
              margin: 10px 0;
              padding-left: 20px;
            }
            .instructions li {
              margin: 5px 0;
              color: #4b5563;
            }
            .url {
              margin-top: 20px;
              padding: 10px;
              background: #f9fafb;
              border: 1px solid #e5e7eb;
              border-radius: 4px;
              word-break: break-all;
              font-size: 12px;
              color: #6b7280;
            }
            @media print {
              body {
                min-height: auto;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>เชื่อมต่อ LINE Account</h1>
            <div class="info">
              <p><strong>ผู้ปกครอง:</strong> ${parentName}</p>
              <p><strong>เบอร์โทร:</strong> ${parentPhone}</p>
            </div>
            <div class="qr-wrapper">
              ${document.getElementById('qr-code')?.innerHTML || ''}
            </div>
            <div class="instructions">
              <h2>วิธีใช้งาน:</h2>
              <ol>
                <li>เปิด LINE บนมือถือ</li>
                <li>สแกน QR Code ด้านบน</li>
                <li>กรอกเบอร์โทร ${parentPhone}</li>
                <li>ยืนยันการเชื่อมต่อ</li>
              </ol>
            </div>
            <div class="url">
              ${linkUrl}
            </div>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const openInNewTab = () => {
    window.open(linkUrl, '_blank');
  };

  if (error === 'Parent already linked to LINE') {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          ผู้ปกครองนี้เชื่อมต่อ LINE แล้ว
        </AlertDescription>
      </Alert>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {error}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <Card>
            <CardContent className="pt-6">
              <div className="flex justify-center mb-4">
                <div id="qr-code" className="p-4 bg-white rounded-lg">
                  <QRCodeSVG 
                    value={linkUrl} 
                    size={200}
                    level="M"
                    includeMargin={true}
                  />
                </div>
              </div>
              
              <div className="text-center space-y-2 mb-4">
                <p className="text-sm text-muted-foreground">
                  สแกน QR Code หรือส่งลิงก์ให้ผู้ปกครอง
                </p>
                <p className="text-xs text-muted-foreground">
                  ลิงก์จะหมดอายุใน 24 ชั่วโมง
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyToClipboard}
                  className="w-full"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      คัดลอกแล้ว
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      คัดลอกลิงก์
                    </>
                  )}
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={printQR}
                  className="w-full"
                >
                  <Printer className="h-4 w-4 mr-2" />
                  พิมพ์ QR
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openInNewTab}
                  className="w-full"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  เปิดลิงก์
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={generateToken}
                  className="w-full"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  สร้างใหม่
                </Button>
              </div>
            </CardContent>
          </Card>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="space-y-2">
              <p className="font-medium">ขั้นตอนการใช้งาน:</p>
              <ol className="list-decimal list-inside space-y-1 text-sm">
                <li>ให้ผู้ปกครองสแกน QR Code ผ่าน LINE</li>
                <li>กรอกเบอร์โทรที่ลงทะเบียนไว้ ({parentPhone})</li>
                <li>ตรวจสอบข้อมูลและยืนยันการเชื่อมต่อ</li>
              </ol>
            </AlertDescription>
          </Alert>
        </>
      )}
    </div>
  );
}