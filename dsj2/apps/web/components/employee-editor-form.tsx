import { Input, Select } from "@dsj/ui";
import Image from "next/image";
import { JobTitleTranslationFields } from "./job-title-translation-fields";
import { PhotoUploadInput } from "./photo-upload-input";
import { SubmitButton } from "./submit-button";
import { employeeKindLabels, statusLabels } from "../lib/labels";

type DepartmentOption = {
  id: string;
  name: string;
};

type ContractorCompanyOption = {
  id: string;
  name: string;
};

type PositionOption = {
  id: string;
  code: string;
  name: string;
};

type EmployeeFormData = {
  id?: string;
  companyId: string;
  departmentId: string | null;
  positionId?: string | null;
  contractorCompanyId: string | null;
  fullName: string;
  employeeNumber: string;
  jobTitle: string;
  jobTitleKz: string | null;
  photoDataUrl?: string | null;
  photoFileName?: string | null;
  email: string | null;
  phone: string | null;
  employeeKind: string;
  status: string;
  accountEmail: string | null;
  hasAccount: boolean;
};

export function EmployeeEditorForm({
  mode,
  action,
  companyId,
  departments,
  positions,
  contractorCompanies,
  employee,
}: {
  mode: "create" | "edit";
  action: (formData: FormData) => void | Promise<void>;
  companyId: string;
  departments: DepartmentOption[];
  positions: PositionOption[];
  contractorCompanies: ContractorCompanyOption[];
  employee?: EmployeeFormData;
}) {
  const isEdit = mode === "edit";

  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      {isEdit ? <input type="hidden" name="employeeId" value={employee?.id ?? ""} /> : null}
      <input type="hidden" name="companyId" value={companyId} />

      <div className="space-y-1.5 md:col-span-2">
        <label className="text-sm font-medium text-slate-700">ФИО</label>
        <Input name="fullName" defaultValue={employee?.fullName ?? ""} required />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">ИИН</label>
        <Input
          name="iin"
          defaultValue=""
          placeholder={
            isEdit ? "Оставьте пустым или введите новый ИИН" : "990101400555"
          }
          required={!isEdit}
        />
        {isEdit ? (
          <p className="text-xs text-slate-400">
            Оставьте поле пустым, если IIN менять не нужно.
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">Табельный номер</label>
        <Input name="employeeNumber" defaultValue={employee?.employeeNumber ?? ""} required />
      </div>

      <JobTitleTranslationFields
        ruName="jobTitle"
        kzName="jobTitleKz"
        ruLabel="Должность"
        kzLabel="Должность на казахском"
        ruDefaultValue={employee?.jobTitle ?? ""}
        kzDefaultValue={employee?.jobTitleKz ?? ""}
        ruRequired
        kzRequired
      />

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">Тип сотрудника</label>
        <Select name="employeeKind" defaultValue={employee?.employeeKind ?? "INTERNAL"}>
          {Object.entries(employeeKindLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>

      {isEdit ? (
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">Статус</label>
          <Select name="status" defaultValue={employee?.status ?? "active"}>
            <option value="active">{statusLabels.active}</option>
            <option value="inactive">{statusLabels.inactive}</option>
          </Select>
        </div>
      ) : (
        <input type="hidden" name="status" value="active" />
      )}

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">Подразделение</label>
        <Select name="departmentId" defaultValue={employee?.departmentId ?? ""}>
          <option value="">Не назначено</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">Должность</label>
        <Select name="positionId" defaultValue={employee?.positionId ?? ""}>
          <option value="">Не назначена</option>
          {positions.map((position) => (
            <option key={position.id} value={position.id}>
              {position.name} ({position.code})
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">Подрядная компания</label>
        <Select name="contractorCompanyId" defaultValue={employee?.contractorCompanyId ?? ""}>
          <option value="">Не назначена</option>
          {contractorCompanies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">Электронная почта</label>
        <Input
          name="email"
          type="email"
          defaultValue={employee?.accountEmail ?? employee?.email ?? ""}
          placeholder="name@company.kz"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">Телефон</label>
        <Input name="phone" defaultValue={employee?.phone ?? ""} placeholder="+77015550015" />
      </div>

      <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
        <div>
          <p className="text-sm font-medium text-slate-800">Фото сотрудника</p>
          <p className="mt-1 text-xs text-slate-500">
            Необязательно. Если фото загружено, оно автоматически подтянется в редактор шаблонов удостоверений.
          </p>
        </div>

        {employee?.photoDataUrl ? (
          <div className="flex flex-col gap-3 md:flex-row md:items-start">
            <Image
              src={employee.photoDataUrl}
              alt={`Фото сотрудника ${employee.fullName}`}
              className="h-[120px] w-[90px] rounded-xl border border-slate-200 object-cover"
              width={90}
              height={120}
              unoptimized
            />
            <div className="space-y-2 text-sm text-slate-600">
              <p>{employee.photoFileName ?? "Текущее фото сотрудника"}</p>
              <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                <input type="checkbox" name="removePhoto" className="h-4 w-4 rounded border-slate-300" />
                Удалить текущее фото
              </label>
            </div>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">
            {employee?.photoDataUrl ? "Заменить фото" : "Загрузить фото"}
          </label>
          <PhotoUploadInput
            name="employeePhoto"
            inputClassName="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700"
            pasteAreaClassName="rounded-lg border border-dashed border-[var(--accent-border)] bg-white px-3 py-2 text-xs text-[var(--muted)] outline-none transition-colors duration-150 focus:border-[var(--focus-border)] focus:ring-2 focus:ring-[var(--focus-ring)]"
            pasteHint="Можно вставить фото из буфера: кликните сюда и нажмите Ctrl+V / Cmd+V"
          />
          <p className="text-xs text-slate-400">
            JPG/PNG, исходный файл до 10 МБ. Система сама подготовит фото под шаблоны удостоверений.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
        <div className="flex items-start gap-3">
          <input
            id="createAccount"
            name="createAccount"
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-950"
          />
          <div className="space-y-3">
            <div>
              <label htmlFor="createAccount" className="text-sm font-medium text-slate-800">
                {employee?.hasAccount ? "Обновить данные личного кабинета" : "Создать личный кабинет сотрудника"}
              </label>
              <p className="mt-1 text-xs text-slate-500">
                {employee?.hasAccount
                  ? `Сейчас кабинет активен для ${employee.accountEmail ?? "указанного email"}. При необходимости можно обновить email и пароль.`
                  : "Отметьте, если сотруднику нужно выдать вход в систему для прохождения инструктажей."}
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Новый / временный пароль</label>
              <Input name="accountPassword" type="password" placeholder="Минимум 8 символов" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-end md:col-span-2">
        <SubmitButton
          label={isEdit ? "Сохранить изменения" : "Создать сотрудника"}
          pendingLabel={isEdit ? "Сохранение..." : "Создание..."}
        />
      </div>
    </form>
  );
}
