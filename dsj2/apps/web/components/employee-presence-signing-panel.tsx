"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, QrCode } from "lucide-react";
import { Button } from "@dsj/ui";

type EmployeePresenceSigningPanelProps = {
  employeeName: string;
  employeeNumber?: string | null;
  employeeJobTitle?: string | null;
  signUrl: string;
  isSigned: boolean;
};

export function EmployeePresenceSigningPanel({
  employeeName,
  employeeNumber,
  employeeJobTitle,
  signUrl,
  isSigned,
}: EmployeePresenceSigningPanelProps) {
  const [isQrVisible, setIsQrVisible] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);

  useEffect(() => {
    if (isSigned || !isQrVisible) {
      return;
    }

    let cancelled = false;
    setQrDataUrl(null);
    setQrError(null);

    void import("qrcode")
      .then((QRCode) =>
        QRCode.toDataURL(signUrl, {
          errorCorrectionLevel: "M",
          margin: 2,
          width: 224,
        }),
      )
      .then((dataUrl) => {
        if (!cancelled) {
          setQrDataUrl(dataUrl);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQrError("Не удалось сформировать QR.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isQrVisible, isSigned, signUrl]);

  const employeeMeta = [
    employeeNumber || "без табельного",
    employeeJobTitle || "должность не указана",
  ].join(" / ");

  if (isSigned) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        <div className="flex items-start gap-3">
          <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div>
            <p className="font-medium">Сотрудник подписал инструктаж</p>
            <p className="mt-1 text-emerald-700">{employeeName}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isQrVisible) {
    return (
      <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium text-slate-900">{employeeName}</p>
            <p className="mt-1 text-xs text-slate-500">{employeeMeta}</p>
          </div>
          <Button variant="subtle" size="sm" onClick={() => setIsQrVisible(true)}>
            <QrCode className="mr-2 h-4 w-4" aria-hidden />
            QR сотрудника
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-600">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-slate-900">Подпись сотрудника</p>
          <p className="mt-1 text-slate-700">{employeeName}</p>
          <p className="mt-1 text-xs text-slate-500">{employeeMeta}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
          QR
        </span>
      </div>

      <div className="mt-4 flex justify-center">
        <div className="grid h-60 w-60 place-items-center rounded-xl border border-slate-200 bg-white p-3">
          {qrDataUrl ? (
            <Image
              src={qrDataUrl}
              alt={`QR для подписи инструктажа сотрудником ${employeeName}`}
              width={224}
              height={224}
              unoptimized
            />
          ) : (
            <span className="text-xs text-slate-400">
              {qrError ?? "Генерируем QR..."}
            </span>
          )}
        </div>
      </div>

      <p className="mt-3 break-all rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
        {signUrl}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => setIsQrVisible(false)}>
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
          Назад
        </Button>
        <Button size="sm" onClick={() => window.location.reload()}>
          <Check className="mr-2 h-4 w-4" aria-hidden />
          Проверить
        </Button>
      </div>
    </div>
  );
}
