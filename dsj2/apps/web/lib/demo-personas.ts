export type DemoPersonaKey =
  | "director"
  | "safety-engineer"
  | "shop-chief"
  | "employee";

export type DemoPersona = {
  key: DemoPersonaKey;
  title: string;
  email: string;
  destination: string;
  contour: "admin" | "employee";
  modeLabel: string;
  scopeLabel: string;
  scopeDepartmentName?: string;
  scopeSiteName?: string;
  readOnly: boolean;
  summary: string;
};

export const demoPersonas: DemoPersona[] = [
  {
    key: "director",
    title: "Директор",
    email: "director@alpina.local",
    destination: "/dashboard",
    contour: "admin",
    modeLabel: "Обзор без операционных действий",
    scopeLabel: "Компания Stroy Company 2030",
    readOnly: true,
    summary:
      "Сводный обзор компании, сотрудников, журналов и рисков без создания записей или изменения карточек.",
  },
  {
    key: "safety-engineer",
    title: "Инженер ОТ",
    email: "safety.engineer@alpina.local",
    destination: "/dashboard",
    contour: "admin",
    modeLabel: "Операционный контур ОТ по всей организации",
    scopeLabel: "Все подразделения и площадки Stroy Company 2030",
    readOnly: false,
    summary:
      "Орг-wide персона для журнала, комплаенса и подготовки следующих инструктажей по сотрудникам.",
  },
  {
    key: "shop-chief",
    title: "Начальник цеха",
    email: "shop.chief@alpina.local",
    destination: "/dashboard",
    contour: "admin",
    modeLabel: "Операционный контур начальника цеха",
    scopeLabel: "Бурение / Площадка Запад-14",
    scopeDepartmentName: "Бурение",
    scopeSiteName: "Площадка Запад-14",
    readOnly: false,
    summary:
      "Демо-персона линейного руководителя, сфокусированная на своем цехе и рабочей площадке.",
  },
  {
    key: "employee",
    title: "Сотрудник",
    email: "signer.employee@alpina.local",
    destination: "/my-instructions",
    contour: "employee",
    modeLabel: "Личный кабинет сотрудника",
    scopeLabel: "Только собственные инструктажи, документы и обучение",
    readOnly: false,
    summary:
      "Self-service контур без административной навигации и без доступа к чужим карточкам.",
  },
];

export function getDemoPersonaForEmail(email: string | null | undefined) {
  const normalizedEmail = email?.trim().toLowerCase();

  if (!normalizedEmail) {
    return null;
  }

  return (
    demoPersonas.find((persona) => persona.email === normalizedEmail) ?? null
  );
}

