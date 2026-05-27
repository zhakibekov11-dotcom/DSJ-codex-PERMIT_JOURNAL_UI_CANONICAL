"use client";

type ProgressMeterProps = {
  value: number;
  label?: string;
};

export function ProgressMeter({ value, label }: ProgressMeterProps) {
  const normalizedValue = Math.max(0, Math.min(100, Math.round(value)));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
        <span>{label ?? "Прогресс"}</span>
        <span className="font-medium text-slate-700">{normalizedValue}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-slate-900 transition-[width]"
          style={{ width: `${normalizedValue}%` }}
        />
      </div>
    </div>
  );
}
