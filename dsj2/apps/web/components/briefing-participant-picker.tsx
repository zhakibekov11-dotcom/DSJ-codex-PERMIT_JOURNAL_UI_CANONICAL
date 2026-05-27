"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { Button, Input } from "@dsj/ui";
import { employeeKindLabels } from "../lib/labels";

type EmployeeOption = {
  id: string;
  fullName: string;
  employeeNumber: string;
  employeeKind: string;
  contractorCompany?: { name: string } | null;
  accountEmail?: string | null;
  accountRole?: string | null;
  hasEmployeeSignerAccount?: boolean;
};

type BriefingParticipantPickerProps = {
  employees: EmployeeOption[];
  initialEmployeeIds?: string[];
  availableTitle?: string;
  availableDescription?: string;
  availableEmptyState?: string;
  selectedTitle?: string;
  selectedDescription?: string;
  selectedEmptyState?: string;
  searchPlaceholder?: string;
  searchEndpoint?: string;
};

export function BriefingParticipantPicker({
  employees,
  initialEmployeeIds = [],
  availableTitle = "Добавить сотрудников",
  availableDescription = "Ищи по ФИО, табельному номеру, типу сотрудника или подрядной компании.",
  availableEmptyState = "Подходящие сотрудники не найдены.",
  selectedTitle = "Выбранные участники",
  selectedDescription = "Здесь можно исключить лишних перед сохранением инструктажа.",
  selectedEmptyState = "Пока никто не выбран. Добавь хотя бы одного сотрудника в список справа.",
  searchPlaceholder = "Поиск сотрудника или подрядчика",
  searchEndpoint,
}: BriefingParticipantPickerProps) {
  const [search, setSearch] = useState("");
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>(initialEmployeeIds);
  const [remoteEmployees, setRemoteEmployees] = useState<EmployeeOption[]>(employees);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search);
  const searchTerm = deferredSearch.trim();
  const normalizedSearch = searchTerm.toLowerCase();

  useEffect(() => {
    setRemoteEmployees(employees);
  }, [employees]);

  useEffect(() => {
    if (!searchEndpoint) {
      return;
    }

    const controller = new AbortController();
    const url = new URL(searchEndpoint, window.location.origin);

    if (searchTerm) {
      url.searchParams.set("search", searchTerm);
    } else {
      url.searchParams.delete("search");
    }

    setIsSearching(true);
    setSearchError(null);

    void fetch(url.toString(), {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Search failed with status ${response.status}`);
        }

        return (await response.json()) as EmployeeOption[];
      })
      .then((nextEmployees) => {
        setRemoteEmployees(nextEmployees);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setSearchError("Не удалось загрузить сотрудников.");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [searchEndpoint, searchTerm]);

  const candidateEmployees = searchEndpoint ? remoteEmployees : employees;
  const employeesById = useMemo(() => {
    const byId = new Map<string, EmployeeOption>();

    for (const employee of [...employees, ...remoteEmployees]) {
      byId.set(employee.id, employee);
    }

    return byId;
  }, [employees, remoteEmployees]);

  const selectedEmployees = selectedEmployeeIds
    .map((employeeId) => employeesById.get(employeeId))
    .filter((employee): employee is EmployeeOption => Boolean(employee));

  const availableEmployees = candidateEmployees.filter((employee) => {
    if (selectedEmployeeIds.includes(employee.id)) {
      return false;
    }

    if (!normalizedSearch) {
      return true;
    }

    const searchTarget = [
      employee.fullName,
      employee.employeeNumber,
      employee.accountEmail ?? "",
      employee.contractorCompany?.name ?? "",
      employeeKindLabels[employee.employeeKind] ?? employee.employeeKind,
    ]
      .join(" ")
      .toLowerCase();

    return searchTarget.includes(normalizedSearch);
  });

  return (
    <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-900">{availableTitle}</p>
            <p className="mt-1 text-xs text-slate-500">{availableDescription}</p>
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
            {isSearching ? "Поиск..." : `Доступно: ${availableEmployees.length}`}
          </span>
        </div>

        <Input
          value={search}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setSearch(event.target.value)}
          placeholder={searchPlaceholder}
        />

        {searchError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {searchError}
          </div>
        ) : null}

        <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
          {availableEmployees.length ? (
            availableEmployees.map((employee) => (
              <div
                key={employee.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{employee.fullName}</p>
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {employee.employeeNumber} •{" "}
                    {employeeKindLabels[employee.employeeKind] ?? employee.employeeKind}
                    {employee.contractorCompany?.name ? ` • ${employee.contractorCompany.name}` : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    setSelectedEmployeeIds((current) =>
                      current.includes(employee.id) ? current : [...current, employee.id],
                    )
                  }
                >
                  Добавить
                </Button>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500">
              {availableEmptyState}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-900">{selectedTitle}</p>
            <p className="mt-1 text-xs text-slate-500">{selectedDescription}</p>
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

        <div className="space-y-2">
          {selectedEmployees.length ? (
            selectedEmployees.map((employee) => (
              <div
                key={employee.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{employee.fullName}</p>
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {employee.employeeNumber} •{" "}
                    {employeeKindLabels[employee.employeeKind] ?? employee.employeeKind}
                    {employee.contractorCompany?.name ? ` • ${employee.contractorCompany.name}` : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="subtle"
                  size="sm"
                  onClick={() =>
                    setSelectedEmployeeIds((current) =>
                      current.filter((employeeId) => employeeId !== employee.id),
                    )
                  }
                >
                  Исключить
                </Button>
                <input type="hidden" name="employeeIds" value={employee.id} />
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
              {selectedEmptyState}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
