'use client';

// Shared certificate editor: four editable fields + a live preview that matches
// the printed output, and a print button. Used by both the manual page
// (/certificates) and the auto page (prefilled from a class). The preview uses
// the same PNG background and % positions as the print template.

import { useLayoutEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import type { CertificateFields } from '@/components/reports/certificate-template';
import { CERT_FIELDS, CERT_CANVAS, fitFontPx, certText } from '@/components/reports/certificate-template';
import { printCertificateFields } from '@/lib/reports/print-student-report';

const PREVIEW_MAX_W = 620; // keep the preview compact

interface Props {
  value: CertificateFields;
  onChange: (next: CertificateFields) => void;
  /** Optional extra action row rendered next to the print button. */
  actions?: React.ReactNode;
  /** Hide the built-in footer print button (caller renders its own, e.g. header). */
  hidePrintButton?: boolean;
  /** Called right before printing (e.g. to persist edited names). Awaited. */
  onBeforePrint?: (fields: CertificateFields) => Promise<void> | void;
}

/** Print the given certificate fields. Exported so a header button can call it. */
export function printCertificate(fields: CertificateFields): void {
  printCertificateFields(fields);
}

// Field geometry is the single source of truth in the template. The preview uses
// the SAME approach as print: an A4-ratio .cert with container-query font sizing
// (cqw). Font px are computed on the 2000px canvas via fitFontPx, then converted
// to cqw — so preview == print deterministically (no transform scaling).
const POS = CERT_FIELDS;

// canvas px -> cqw (% of the cert's own width). Must match the template's cqw().
const toCqw = (canvasPx: number) => ((canvasPx / CERT_CANVAS.w) * 100);

function Field({ k, text }: { k: keyof typeof POS; text: string }) {
  const p = POS[k];
  const uc = certText(text);     // uppercase, same as print
  const px = fitFontPx(uc, p);   // identical computation to the print template
  return (
    <div
      style={{
        position: 'absolute',
        top: `${p.top}%`,
        left: `${p.left}%`,
        transform: 'translate(-50%, -50%)',
        textAlign: 'center',
        whiteSpace: 'nowrap',
        lineHeight: 1,
        color: p.color,
        fontWeight: p.weight,
        fontSize: `${toCqw(px).toFixed(4)}cqw`,
        letterSpacing: `${p.spacing}px`,
      }}
    >
      {uc}
    </div>
  );
}

export function CertificateEditor({ value, onChange, actions, hidePrintButton, onBeforePrint }: Props) {
  const [printing, setPrinting] = useState(false);
  const [fontsReady, setFontsReady] = useState(false); // re-measure once font loads

  // fitFontPx() measures with the real font; re-render once it has loaded so the
  // first paint isn't sized with a fallback metric.
  useLayoutEffect(() => {
    if (typeof document === 'undefined' || !document.fonts) { setFontsReady(true); return; }
    document.fonts.ready.then(() => setFontsReady(true));
  }, []);
  void fontsReady;

  const set = (k: keyof CertificateFields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...value, [k]: e.target.value });

  const handlePrint = async () => {
    setPrinting(true);
    try {
      await onBeforePrint?.(value); // persist edited names first, if wired
      printCertificateFields(value);
    } catch (e: any) {
      // printing still proceeds even if the save failed — don't block the print
      printCertificateFields(value);
    } finally {
      setTimeout(() => setPrinting(false), 1500);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="cf-subject">ชื่อวิชา</Label>
          <Input id="cf-subject" value={value.subjectName} onChange={set('subjectName')} placeholder="เช่น Python เบื้องต้น" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cf-student">ชื่อนักเรียน</Label>
          <Input id="cf-student" value={value.studentName} onChange={set('studentName')} placeholder="เช่น Somchai Jaidee" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cf-teacher">ชื่อครู</Label>
          <Input id="cf-teacher" value={value.teacherName} onChange={set('teacherName')} placeholder="เช่น Teacher A" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cf-date">วันที่ (DD/MM/YYYY)</Label>
          <Input id="cf-date" value={value.date} onChange={set('date')} placeholder="เช่น 11/06/2026" />
        </div>
      </div>

      {/* Live preview — SAME layout as print: A4-ratio box with container-query
          font sizing (cqw). No transform scaling, so it can't drift from print.
          Left-aligned, with extra space above the inputs. */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: PREVIEW_MAX_W,
          marginTop: 24,
          aspectRatio: `${CERT_CANVAS.w} / ${CERT_CANVAS.h}`,
          containerType: 'inline-size',
          backgroundImage: "url('/cert-template.png')",
          backgroundSize: '100% 100%',
          backgroundRepeat: 'no-repeat',
          boxShadow: '0 4px 20px rgba(0,0,0,.12)',
          fontFamily: "'IBM Plex Sans Thai', sans-serif",
        }}
      >
        <Field k="subject" text={value.subjectName} />
        <Field k="student" text={value.studentName} />
        <Field k="teacher" text={value.teacherName} />
        <Field k="date" text={value.date} />
      </div>

      {(actions || !hidePrintButton) && (
        <div className="flex items-center justify-end gap-3">
          {actions}
          {!hidePrintButton && (
            <Button onClick={handlePrint} disabled={printing}>
              <Printer className="h-4 w-4 mr-2" />
              {printing ? 'กำลังพิมพ์...' : 'พิมพ์ใบประกาศนียบัตร'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
