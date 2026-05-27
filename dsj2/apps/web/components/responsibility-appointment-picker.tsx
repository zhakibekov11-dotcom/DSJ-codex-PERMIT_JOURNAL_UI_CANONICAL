"use client";

import { useDeferredValue, useMemo, useState, type ChangeEvent } from "react";
import { Button, Input, Textarea } from "@dsj/ui";
import { employeeKindLabels } from "../lib/labels";

type EmployeeOption = {
  id: string;
  fullName: string;
  employeeNumber: string;
  employeeKind: string;
  jobTitle: string;
  department?: { name: string } | null;
};

type InitialAppointment = {
  employeeId: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  zoneOfResponsibility?: string | null;
  roleNotes?: string | null;
};

type ResponsibilityAppointmentPickerProps = {
  employees: EmployeeOption[];
  initialAppointments?: InitialAppointment[];
  defaultEffectiveFrom?: string | null;
};

export function ResponsibilityAppointmentPicker({
  employees,
  initialAppointments = [],
  defaultEffectiveFrom,
}: ResponsibilityAppointmentPickerProps) {
  const [search, setSearch] = useState("");
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>(
    initialAppointments.map((appointment) => appointment.employeeId),
  );
  const [detailsByEmployeeId, setDetailsByEmployeeId] = useState<
    Record<
      string,
      {
        effectiveFrom: string;
        effectiveTo: string;
        zoneOfResponsibility: string;
        roleNotes: string;
      }
    >
  >(() =>
    Object.fromEntries(
      initialAppointments.map((appointment) => [
        appointment.employeeId,
        {
          effectiveFrom: appointment.effectiveFrom.slice(0, 10),
          effectiveTo: appointment.effectiveTo?.slice(0, 10) ?? "",
          zoneOfResponsibility: appointment.zoneOfResponsibility ?? "",
          roleNotes: appointment.roleNotes ?? "",
        },
      ]),
    ),
  );
  const deferredSearch = useDeferredValue(search);
  const normalizedSearch = deferredSearch.trim().toLowerCase();

  const selectedEmployees = selectedEmployeeIds
    .map((employeeId) => employees.find((employee) => employee.id === employeeId))
    .filter((employee): employee is EmployeeOption => Boolean(employee));

  const availableEmployees = useMemo(
    () =>
      employees.filter((employee) => {
        if (selectedEmployeeIds.includes(employee.id)) {
          return false;
        }

        if (!normalizedSearch) {
          return true;
        }

        const haystack = [
          employee.fullName,
          employee.employeeNumber,
          employee.jobTitle,
          employee.department?.name ?? "",
          employeeKindLabels[employee.employeeKind] ?? employee.employeeKind,
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(normalizedSearch);
      }),
    [employees, normalizedSearch, selectedEmployeeIds],
  );

  function addEmployee(employeeId: string) {
    setSelectedEmployeeIds((current) =>
      current.includes(employeeId) ? current : [...current, employeeId],
    );
    setDetailsByEmployeeId((current) => ({
      ...current,
      [employeeId]:
        current[employeeId] ?? {
          effectiveFrom: defaultEffectiveFrom?.slice(0, 10) ?? "",
          effectiveTo: "",
          zoneOfResponsibility: "",
          roleNotes: "",
        },
    }));
  }

  function removeEmployee(employeeId: string) {
    setSelectedEmployeeIds((current) => current.filter((id) => id !== employeeId));
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
      <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/70 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-900">Добавить сотрудников</p>
            <p className="mt-1 text-xs text-slate-500">
              Поиск по имени, номеру, должности или подразделению.
            </p>
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
            Доступно: {availableEmployees.length}
          </span>
        </div>

        <Input
          value={search}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setSearch(event.target.value)}
          placeholder="Найти сотрудника"
        />

        <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
          {availableEmployees.length ? (
            availableEmployees.map((employee) => (
              <div
                key={employee.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{employee.fullName}</p>
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {employee.employeeNumber} • {employee.jobTitle || "Должность не указана"}
                    {employee.department?.name ? ` • ${employee.department.name}` : ""}
                  </p>
                </div>
                <Button type="button" variant="secondary" size="sm" onClick={() => addEmployee(employee.id)}>
                  Добавить
                </Button>
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500">
              Совпадающих сотрудников не найдено.
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-900">Назначения</p>
            <p className="mt-1 text-xs text-slate-500">
              Каждая строка станет структурированным назначением в приказе.
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              selectedEmployees.length
                ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                : "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
            }`}
          >
            Выбрано: {selectedEmployees.length}
          </span>
        </div>

        <div className="space-y-3">
          {selectedEmployees.length ? (
            selectedEmployees.map((employee) => {
              const details = detailsByEmployeeId[employee.id] ?? {
                effectiveFrom: defaultEffectiveFrom?.slice(0, 10) ?? "",
                effectiveTo: "",
                zoneOfResponsibility: "",
                roleNotes: "",
              };

              return (
                <div key={employee.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{employee.fullName}</p>
                      <p className="mt-1 truncate text-xs text-slate-500">
                      {employee.employeeNumber} • {employee.jobTitle || "Должность не указана"}
                      {employee.department?.name ? ` • ${employee.department.name}` : ""}
                    </p>
                  </div>
                    <Button type="button" variant="subtle" size="sm" onClick={() => removeEmployee(employee.id)}>
                      Удалить
                    </Button>
                  </div>

                  <input type="hidden" name="appointmentEmployeeId" value={employee.id} />

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700">Действует с</label>
                      <Input
                        name="appointmentEffectiveFrom"
                        type="date"
                        defaultValue={details.effectiveFrom}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700">Действует по</label>
                      <Input
                        name="appointmentEffectiveTo"
                        type="date"
                        defaultValue={details.effectiveTo}
                      />
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-sm font-medium text-slate-700">Зона ответственности</label>
                      <Input
                        name="appointmentZoneOfResponsibility"
                        defaultValue={details.zoneOfResponsibility}
                        placeholder="Необязательно: зона, объект или участок"
                      />
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-sm font-medium text-slate-700">Примечание по роли</label>
                      <Textarea
                        name="appointmentRoleNotes"
                        defaultValue={details.roleNotes}
                        className="min-h-24"
                        placeholder="Необязательные примечания к назначению сотрудника"
                      />
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
              Выберите хотя бы одного сотрудника для этого приказа о назначении.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
