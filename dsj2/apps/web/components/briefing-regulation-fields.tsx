"use client";

import { useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import type { BriefingType } from "@dsj/types";
import { Input, Select } from "@dsj/ui";
import { briefingTypeLabels } from "../lib/labels";

type RegulationProfile = "LABOR_PROTECTION" | "FIRE_SAFETY";

type BasisOption = {
  value: string;
  label: string;
  note: string;
};

type TemplateConfig = {
  displayType: string;
  lawTitle: string;
  lawUrl: string;
  lawCaption: string;
  journalLabel: string;
  journalReference: string;
  journalColumns: string[];
  topic: string;
  materialItems: string[];
  nextBriefingHint: string;
  noteItems: string[];
  basisLabel?: string;
  basisOptions?: BasisOption[];
};

const briefingTypeOrder: BriefingType[] = [
  "INTRODUCTORY",
  "PRIMARY",
  "REPEATED",
  "UNSCHEDULED",
  "TARGETED",
];

const profileLabels: Record<RegulationProfile, string> = {
  LABOR_PROTECTION: "БиОТ / охрана труда",
  FIRE_SAFETY: "Пожарная безопасность",
};

const templates: Record<RegulationProfile, Record<BriefingType, TemplateConfig>> = {
  LABOR_PROTECTION: {
    INTRODUCTORY: {
      displayType: "Вводный инструктаж по безопасности и охране труда",
      lawTitle: "Правила обучения, инструктирования и проверки знаний по БиОТ",
      lawUrl: "https://adilet.zan.kz/rus/docs/V1500012665",
      lawCaption: "Приказ МЗСР РК от 25.12.2015 № 1019, рег. № 12665",
      journalLabel: "Журнал регистрации вводного инструктажа",
      journalReference: "Приложение 4 к Правилам БиОТ",
      journalColumns: [
        "Дата",
        "ФИО инструктируемого",
        "Год рождения",
        "Профессия / должность",
        "Место работы",
        "Подпись инструктируемого",
        "Подпись инструктирующего",
        "ФИО инструктирующего",
      ],
      topic: "Вводный инструктаж по безопасности и охране труда",
      materialItems: [
        "Общие сведения об организации, производственных рисках и правилах безопасного поведения на территории.",
        "Права и обязанности работника в области безопасности и охраны труда.",
        "Порядок сообщения о нарушениях, травме, аварии, пожаре и других происшествиях.",
        "Маршруты эвакуации, первая помощь, средства индивидуальной защиты и базовые запреты.",
        "Локальные инструкции и допуск к дальнейшему первичному инструктажу на рабочем месте.",
      ],
      nextBriefingHint:
        "Вводный инструктаж оформляется в отдельном журнале. Дальше работник проходит первичный инструктаж на рабочем месте.",
      noteItems: [
        "Запись оформляется в отдельном журнале вводного инструктажа с обязательными подписями инструктируемого и инструктирующего.",
      ],
    },
    PRIMARY: {
      displayType: "Первичный инструктаж на рабочем месте по безопасности и охране труда",
      lawTitle: "Правила обучения, инструктирования и проверки знаний по БиОТ",
      lawUrl: "https://adilet.zan.kz/rus/docs/V1500012665",
      lawCaption: "Приказ МЗСР РК от 25.12.2015 № 1019, рег. № 12665",
      journalLabel: "Журнал регистрации инструктажа по БиОТ на рабочем месте",
      journalReference: "Приложение 5 к Правилам БиОТ",
      journalColumns: [
        "Дата",
        "ФИО инструктируемого",
        "Год рождения",
        "Профессия / должность",
        "Вид инструктажа",
        "Причина внепланового инструктажа",
        "ФИО и должность инструктирующего",
        "Подпись инструктирующего",
        "Подпись инструктируемого",
      ],
      topic: "Первичный инструктаж на рабочем месте по безопасности и охране труда",
      materialItems: [
        "Опасные и вредные производственные факторы именно на данном рабочем месте.",
        "Безопасные приемы труда, запуск и остановка оборудования, инструмента и приспособлений.",
        "Порядок применения СИЗ, блокировок, ограждений и сигнализации.",
        "Действия при аварии, пожаре, травме и нештатной ситуации на участке.",
        "Проверка знаний и допуск к самостоятельной работе только после усвоения инструктажа.",
      ],
      nextBriefingHint:
        "По Правилам БиОТ повторный инструктаж проводится не реже одного раза в полугодие. Здесь можно сразу задать дату следующего повторного инструктажа.",
      noteItems: [
        "Первичный инструктаж проводится на рабочем месте ответственным работником с практическим показом безопасных приемов труда.",
      ],
    },
    REPEATED: {
      displayType: "Повторный инструктаж по безопасности и охране труда",
      lawTitle: "Правила обучения, инструктирования и проверки знаний по БиОТ",
      lawUrl: "https://adilet.zan.kz/rus/docs/V1500012665",
      lawCaption: "Приказ МЗСР РК от 25.12.2015 № 1019, рег. № 12665",
      journalLabel: "Журнал регистрации инструктажа по БиОТ на рабочем месте",
      journalReference: "Приложение 5 к Правилам БиОТ",
      journalColumns: [
        "Дата",
        "ФИО инструктируемого",
        "Год рождения",
        "Профессия / должность",
        "Вид инструктажа",
        "Причина внепланового инструктажа",
        "ФИО и должность инструктирующего",
        "Подпись инструктирующего",
        "Подпись инструктируемого",
      ],
      topic: "Повторный инструктаж по безопасности и охране труда",
      materialItems: [
        "Закрепление требований первичного инструктажа и проверка практических навыков безопасной работы.",
        "Разбор типовых нарушений, несчастных случаев и мер предупреждения травматизма.",
        "Актуализация порядка применения СИЗ, сигнализации, эвакуации и сообщений о нарушениях.",
        "Повторная проверка знания безопасных способов работы на рабочем месте.",
      ],
      nextBriefingHint:
        "По Правилам БиОТ повторный инструктаж проводится не реже одного раза в полугодие.",
      noteItems: [
        "Повторный инструктаж проводится аналогично первичному для закрепления знаний и навыков.",
      ],
    },
    UNSCHEDULED: {
      displayType: "Внеплановый инструктаж по безопасности и охране труда",
      lawTitle: "Правила обучения, инструктирования и проверки знаний по БиОТ",
      lawUrl: "https://adilet.zan.kz/rus/docs/V1500012665",
      lawCaption: "Приказ МЗСР РК от 25.12.2015 № 1019, рег. № 12665",
      journalLabel: "Журнал регистрации инструктажа по БиОТ на рабочем месте",
      journalReference: "Приложение 5 к Правилам БиОТ",
      journalColumns: [
        "Дата",
        "ФИО инструктируемого",
        "Год рождения",
        "Профессия / должность",
        "Вид инструктажа",
        "Причина внепланового инструктажа",
        "ФИО и должность инструктирующего",
        "Подпись инструктирующего",
        "Подпись инструктируемого",
      ],
      topic: "Внеплановый инструктаж по безопасности и охране труда",
      materialItems: [
        "Разбор конкретного изменения или нарушения, вызвавшего необходимость внепланового инструктажа.",
        "Обновленные требования безопасности, запреты и порядок безопасного выполнения работ.",
        "Корректирующие меры на рабочем месте и проверка понимания новых требований.",
      ],
      nextBriefingHint:
        "Для внепланового инструктажа по Правилам БиОТ причина проведения обязательна для записи в журнале.",
      noteItems: [
        "Объем и содержание инструктажа определяются по конкретной причине и обстоятельствам его проведения.",
      ],
      basisLabel: "Причина проведения внепланового инструктажа",
      basisOptions: [
        {
          value: "NEW_RULES",
          label: "Введены новые или переработанные нормы / инструкции",
          note: "введены новые или переработанные нормы безопасности, правила или инструкции",
        },
        {
          value: "PROCESS_CHANGE",
          label: "Изменен процесс, оборудование или материалы",
          note: "изменен технологический процесс, оборудование, инструмент, сырье или материалы",
        },
        {
          value: "VIOLATION_OR_INCIDENT",
          label: "Нарушение, травма, авария, взрыв, пожар, отравление",
          note: "допущено нарушение требований безопасности, приведшее или способное привести к травме, аварии, взрыву, пожару или отравлению",
        },
        {
          value: "SUPERVISORY_DEMAND",
          label: "Требование контролирующих и надзорных органов",
          note: "инструктаж проводится по требованию контролирующих и надзорных органов",
        },
      ],
    },
    TARGETED: {
      displayType: "Целевой инструктаж по безопасности и охране труда",
      lawTitle: "Правила обучения, инструктирования и проверки знаний по БиОТ",
      lawUrl: "https://adilet.zan.kz/rus/docs/V1500012665",
      lawCaption: "Приказ МЗСР РК от 25.12.2015 № 1019, рег. № 12665",
      journalLabel: "Журнал регистрации инструктажа по БиОТ на рабочем месте",
      journalReference: "Приложение 5 к Правилам БиОТ",
      journalColumns: [
        "Дата",
        "ФИО инструктируемого",
        "Год рождения",
        "Профессия / должность",
        "Вид инструктажа",
        "Причина внепланового инструктажа",
        "ФИО и должность инструктирующего",
        "Подпись инструктирующего",
        "Подпись инструктируемого",
      ],
      topic: "Целевой инструктаж по безопасности и охране труда",
      materialItems: [
        "Условия конкретной разовой работы, ее место, границы, опасности и ответственные лица.",
        "Порядок подготовки рабочего места, допуска, применения СИЗ и безопасной последовательности действий.",
        "Порядок прекращения работ и действия при нештатной ситуации, аварии или травме.",
      ],
      nextBriefingHint:
        "Если работа выполняется по наряду-допуску, Правила БиОТ допускают фиксировать целевой инструктаж в наряде-допуске или иной разрешительной документации.",
      noteItems: [
        "Целевой инструктаж проводят для разовых работ, работ вне обычных обязанностей, ликвидации последствий аварий и работ по наряду-допуску.",
      ],
      basisLabel: "Основание целевого инструктажа",
      basisOptions: [
        {
          value: "ONE_OFF_TASK",
          label: "Разовая работа вне прямых обязанностей",
          note: "выполнение разовой работы, не связанной с прямыми обязанностями по специальности",
        },
        {
          value: "LOAD_CLEAN",
          label: "Погрузка, выгрузка, уборка территории",
          note: "выполнение погрузочно-разгрузочных работ или разовой уборки территории",
        },
        {
          value: "OUTSIDE_WORKSITE",
          label: "Разовая работа вне организации, цеха или участка",
          note: "выполнение разовой работы вне организации, цеха или участка",
        },
        {
          value: "EMERGENCY_RESPONSE",
          label: "Ликвидация последствий аварии или ЧС",
          note: "ликвидация последствий аварии, стихийного бедствия или катастрофы",
        },
        {
          value: "WORK_PERMIT",
          label: "Работа по наряду-допуску",
          note: "выполнение работ по наряду-допуску",
        },
      ],
    },
  },
  FIRE_SAFETY: {
    INTRODUCTORY: {
      displayType: "Вводный противопожарный инструктаж",
      lawTitle: "Правила обучения мерам пожарной безопасности",
      lawUrl: "https://adilet.zan.kz/rus/docs/V1400009510",
      lawCaption: "Приказ МЧС РК от 09.06.2014 № 276, рег. № 9510",
      journalLabel: "Журнал учета проведения инструктажей по пожарной безопасности",
      journalReference: "Приложение 2 к Правилам пожарной безопасности",
      journalColumns: [
        "№ п/п",
        "Дата",
        "ФИО инструктируемого",
        "Должность / профессия",
        "Вид инструктажа",
        "ФИО инструктирующего",
        "Должность инструктирующего",
        "Подпись инструктируемого",
        "Подпись инструктирующего",
      ],
      topic: "Вводный противопожарный инструктаж",
      materialItems: [
        "Специфика организации по условиям пожаро- и взрывоопасности.",
        "Противопожарный режим, приказы и инструкции по пожарной безопасности.",
        "Средства пожаротушения, пути эвакуации, сигнализация и порядок сообщения о пожаре.",
        "Практические действия при пожаре, правила личной безопасности и базовая помощь пострадавшим.",
      ],
      nextBriefingHint:
        "Лица, не прошедшие вводный противопожарный инструктаж, к исполнению служебных обязанностей не допускаются.",
      noteItems: [
        "Все виды противопожарного инструктажа фиксируются в едином журнале учета проведения инструктажей по пожарной безопасности.",
      ],
    },
    PRIMARY: {
      displayType: "Первичный противопожарный инструктаж",
      lawTitle: "Правила обучения мерам пожарной безопасности",
      lawUrl: "https://adilet.zan.kz/rus/docs/V1400009510",
      lawCaption: "Приказ МЧС РК от 09.06.2014 № 276, рег. № 9510",
      journalLabel: "Журнал учета проведения инструктажей по пожарной безопасности",
      journalReference: "Приложение 2 к Правилам пожарной безопасности",
      journalColumns: [
        "№ п/п",
        "Дата",
        "ФИО инструктируемого",
        "Должность / профессия",
        "Вид инструктажа",
        "ФИО инструктирующего",
        "Должность инструктирующего",
        "Подпись инструктируемого",
        "Подпись инструктирующего",
      ],
      topic: "Первичный противопожарный инструктаж",
      materialItems: [
        "Пожарная опасность конкретного рабочего места, материалов и оборудования.",
        "Практический показ пользования первичными средствами пожаротушения и порядка эвакуации.",
        "Действия при возникновении пожара, вызов пожарной охраны и взаимодействие с ответственными лицами.",
      ],
      nextBriefingHint:
        "Первичный противопожарный инструктаж проводится непосредственно на рабочем месте на производственных, торговых, складских объектах и объектах с массовым пребыванием людей.",
      noteItems: [
        "Программы противопожарных инструктажей утверждаются руководителем организации.",
      ],
    },
    REPEATED: {
      displayType: "Повторный противопожарный инструктаж",
      lawTitle: "Правила обучения мерам пожарной безопасности",
      lawUrl: "https://adilet.zan.kz/rus/docs/V1400009510",
      lawCaption: "Приказ МЧС РК от 09.06.2014 № 276, рег. № 9510",
      journalLabel: "Журнал учета проведения инструктажей по пожарной безопасности",
      journalReference: "Приложение 2 к Правилам пожарной безопасности",
      journalColumns: [
        "№ п/п",
        "Дата",
        "ФИО инструктируемого",
        "Должность / профессия",
        "Вид инструктажа",
        "ФИО инструктирующего",
        "Должность инструктирующего",
        "Подпись инструктируемого",
        "Подпись инструктирующего",
      ],
      topic: "Повторный противопожарный инструктаж",
      materialItems: [
        "Проверка знания действующих требований пожарной безопасности и противопожарного режима.",
        "Отработка пользования первичными средствами пожаротушения, путей эвакуации и систем оповещения.",
        "Повторная проверка действий персонала при пожаре и взаимодействия с ответственными лицами.",
      ],
      nextBriefingHint:
        "Частота повторного противопожарного инструктажа зависит от объекта: не реже 1 раза в полугодие, 1 раз в год или 1 раз в 2 года по Правилам.",
      noteItems: [
        "Повторный противопожарный инструктаж проводится по графику, утвержденному руководителем организации.",
      ],
    },
    UNSCHEDULED: {
      displayType: "Внеплановый противопожарный инструктаж",
      lawTitle: "Правила обучения мерам пожарной безопасности",
      lawUrl: "https://adilet.zan.kz/rus/docs/V1400009510",
      lawCaption: "Приказ МЧС РК от 09.06.2014 № 276, рег. № 9510",
      journalLabel: "Журнал учета проведения инструктажей по пожарной безопасности",
      journalReference: "Приложение 2 к Правилам пожарной безопасности",
      journalColumns: [
        "№ п/п",
        "Дата",
        "ФИО инструктируемого",
        "Должность / профессия",
        "Вид инструктажа",
        "ФИО инструктирующего",
        "Должность инструктирующего",
        "Подпись инструктируемого",
        "Подпись инструктирующего",
      ],
      topic: "Внеплановый противопожарный инструктаж",
      materialItems: [
        "Разбор конкретного фактора или нарушения, ставшего основанием для внепланового инструктажа.",
        "Актуализированные противопожарные требования, ограничения и корректирующие меры.",
        "Проверка понимания новых требований и действий при пожаре на данном объекте.",
      ],
      nextBriefingHint:
        "Содержание внепланового противопожарного инструктажа определяется по конкретной причине и обстоятельствам его проведения.",
      noteItems: [
        "Запись делается в журнале учета проведения инструктажей по пожарной безопасности с указанием вида инструктажа.",
      ],
      basisLabel: "Основание внепланового инструктажа",
      basisOptions: [
        {
          value: "PROCESS_CHANGE",
          label: "Изменен процесс, оборудование, сырье или материалы",
          note: "изменен технологический процесс, оборудование, инструменты, сырье или материалы",
        },
        {
          value: "VIOLATION",
          label: "Нарушены требования пожарной безопасности",
          note: "работниками допущено нарушение требований пожарной безопасности",
        },
        {
          value: "INSPECTION_ORDER",
          label: "Предписание или акт по итогам проверки",
          note: "получено предписание или акт по итогам проверки должностных лиц государственного контроля",
        },
        {
          value: "SIMILAR_FIRE",
          label: "Получена информация о пожаре на аналогичном объекте",
          note: "поступили информационные материалы о пожарах на аналогичных объектах",
        },
        {
          value: "INSUFFICIENT_KNOWLEDGE",
          label: "Выявлены неудовлетворительные знания работников",
          note: "у работников выявлены неудовлетворительные знания требований пожарной безопасности",
        },
      ],
    },
    TARGETED: {
      displayType: "Целевой противопожарный инструктаж",
      lawTitle: "Правила обучения мерам пожарной безопасности",
      lawUrl: "https://adilet.zan.kz/rus/docs/V1400009510",
      lawCaption: "Приказ МЧС РК от 09.06.2014 № 276, рег. № 9510",
      journalLabel: "Журнал учета проведения инструктажей по пожарной безопасности",
      journalReference: "Приложение 2 к Правилам пожарной безопасности",
      journalColumns: [
        "№ п/п",
        "Дата",
        "ФИО инструктируемого",
        "Должность / профессия",
        "Вид инструктажа",
        "ФИО инструктирующего",
        "Должность инструктирующего",
        "Подпись инструктируемого",
        "Подпись инструктирующего",
      ],
      topic: "Целевой противопожарный инструктаж",
      materialItems: [
        "Условия конкретной работы или мероприятия с повышенной пожарной опасностью.",
        "Порядок подготовки места, применения огнетушителей, наблюдения и прекращения работ.",
        "Действия при пожаре, эвакуации и сообщение ответственным лицам и пожарной охране.",
      ],
      nextBriefingHint:
        "Целевой противопожарный инструктаж обязателен для разовых огневых работ, работ по наряду-допуску, массовых мероприятий и ликвидации последствий ЧС.",
      noteItems: [
        "После целевого противопожарного инструктажа проверяются навыки соблюдения противопожарного режима и пользования средствами пожаротушения.",
      ],
      basisLabel: "Основание целевого инструктажа",
      basisOptions: [
        {
          value: "HOT_WORK",
          label: "Огневые или иные пожароопасные разовые работы",
          note: "выполняются разовые работы с повышенной пожарной опасностью и другие огневые работы",
        },
        {
          value: "EMERGENCY_RESPONSE",
          label: "Ликвидация последствий чрезвычайной ситуации",
          note: "проводится ликвидация последствий чрезвычайной ситуации",
        },
        {
          value: "WORK_PERMIT",
          label: "Работы по наряду-допуску",
          note: "производятся работы по наряду-допуску, включая огневые работы во взрывоопасных производствах",
        },
        {
          value: "EXCURSION",
          label: "Экскурсия на объекте",
          note: "проводится экскурсия в организации или на производстве",
        },
        {
          value: "MASS_EVENT",
          label: "Мероприятие с массовым пребыванием людей",
          note: "организация готовится к мероприятию с массовым пребыванием людей",
        },
      ],
    },
  },
};

const defaultProfile: RegulationProfile = "LABOR_PROTECTION";
const defaultBriefingType: BriefingType = "INTRODUCTORY";
type FireRepeatCycle = "HALF_YEAR" | "YEAR" | "TWO_YEARS";

const defaultFireRepeatCycle: FireRepeatCycle = "YEAR";

const fireRepeatCycleLabels: Record<FireRepeatCycle, string> = {
  HALF_YEAR: "Раз в полгода",
  YEAR: "Раз в год",
  TWO_YEARS: "Раз в 2 года",
};

function buildMaterialContent(template: TemplateConfig, selectedBasis?: BasisOption) {
  const items = selectedBasis
    ? [`Основание проведения: ${selectedBasis.note}.`, ...template.materialItems]
    : template.materialItems;

  return items.map((item, index) => `${index + 1}. ${item}`).join("\n");
}

function buildNotes(template: TemplateConfig, selectedBasis?: BasisOption, scheduleNote?: string) {
  const lines = [
    `Источник: ${template.lawCaption}.`,
    `Форма журнала: ${template.journalLabel} (${template.journalReference}).`,
    `Вид инструктажа: ${template.displayType}.`,
  ];

  if (selectedBasis && template.basisLabel) {
    lines.push(`${template.basisLabel}: ${selectedBasis.note}.`);
  }

  if (scheduleNote) {
    lines.push(scheduleNote);
  }

  return [...lines, ...template.noteItems].join("\n");
}

function parseDateValue(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

function formatDateValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addUtcMonths(date: Date, months: number) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const lastTargetDay = new Date(Date.UTC(year, month + months + 1, 0)).getUTCDate();

  return new Date(Date.UTC(year, month + months, Math.min(day, lastTargetDay)));
}

function addUtcYears(date: Date, years: number) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const lastTargetDay = new Date(Date.UTC(year + years, month + 1, 0)).getUTCDate();

  return new Date(Date.UTC(year + years, month, Math.min(day, lastTargetDay)));
}

function computeNextBriefingDate(
  profile: RegulationProfile,
  briefingType: BriefingType,
  briefingDate: string,
  fireRepeatCycle: FireRepeatCycle,
) {
  const parsedDate = parseDateValue(briefingDate);

  if (!parsedDate) {
    return null;
  }

  if (profile === "LABOR_PROTECTION") {
    if (briefingType === "PRIMARY" || briefingType === "REPEATED") {
      return formatDateValue(addUtcMonths(parsedDate, 6));
    }

    return null;
  }

  if (briefingType !== "PRIMARY" && briefingType !== "REPEATED") {
    return null;
  }

  if (fireRepeatCycle === "HALF_YEAR") {
    return formatDateValue(addUtcMonths(parsedDate, 6));
  }

  if (fireRepeatCycle === "YEAR") {
    return formatDateValue(addUtcYears(parsedDate, 1));
  }

  return formatDateValue(addUtcYears(parsedDate, 2));
}

function buildScheduleNote(
  profile: RegulationProfile,
  briefingType: BriefingType,
  fireRepeatCycle: FireRepeatCycle,
  template: TemplateConfig,
) {
  if (profile === "LABOR_PROTECTION") {
    if (briefingType === "PRIMARY" || briefingType === "REPEATED") {
      return "Следующий повторный инструктаж рассчитывается на 6 месяцев по Правилам БиОТ.";
    }

    if (briefingType === "INTRODUCTORY") {
      return "После вводного инструктажа следующий этап определяется как первичный инструктаж на рабочем месте, фиксированная дата по закону не задается.";
    }

    return "Для внепланового и целевого инструктажа следующая дата автоматически по закону не устанавливается.";
  }

  if (briefingType === "PRIMARY" || briefingType === "REPEATED") {
    if (fireRepeatCycle === "HALF_YEAR") {
      return "Следующий противопожарный инструктаж рассчитан на полугодие для объектов образования, здравоохранения и социального обеспечения.";
    }

    if (fireRepeatCycle === "YEAR") {
      return "Следующий противопожарный инструктаж рассчитан на 1 год для производственных, складских, торговых объектов и объектов с массовым пребыванием людей.";
    }

    return "Следующий противопожарный инструктаж рассчитан на 2 года для общественных зданий, не относящихся к объектам с массовым пребыванием людей.";
  }

  if (briefingType === "INTRODUCTORY") {
    return "Лица, не прошедшие вводный противопожарный инструктаж, к работе не допускаются. Следующая дата по закону автоматически не задается.";
  }

  return `${template.nextBriefingHint} Следующая дата автоматически не устанавливается.`;
}

type BriefingRegulationFieldsProps = {
  allowedBriefingTypes?: BriefingType[];
};

export function BriefingRegulationFields({
  allowedBriefingTypes = briefingTypeOrder,
}: BriefingRegulationFieldsProps) {
  const initialBriefingType = allowedBriefingTypes[0] ?? defaultBriefingType;
  const [profile, setProfile] = useState<RegulationProfile>(defaultProfile);
  const [briefingType, setBriefingType] = useState<BriefingType>(initialBriefingType);
  const [basisCode, setBasisCode] = useState("");
  const [briefingDate, setBriefingDate] = useState("");
  const [fireRepeatCycle, setFireRepeatCycle] = useState<FireRepeatCycle>(defaultFireRepeatCycle);

  const template = templates[profile][briefingType];
  const basisOptions = template.basisOptions ?? [];
  const selectedBasis = basisOptions.find((option) => option.value === basisCode);
  const requiresFireRepeatCycle =
    profile === "FIRE_SAFETY" && (briefingType === "PRIMARY" || briefingType === "REPEATED");
  const nextBriefingDueAt = computeNextBriefingDate(
    profile,
    briefingType,
    briefingDate,
    fireRepeatCycle,
  );
  const scheduleNote = buildScheduleNote(profile, briefingType, fireRepeatCycle, template);
  const topic = template.topic;
  const notes = buildNotes(template, selectedBasis, scheduleNote);
  const materialContent = buildMaterialContent(template, selectedBasis);
  const journalKind = briefingType === "INTRODUCTORY" ? "INTRODUCTORY" : "WORKPLACE";
  const basis = selectedBasis?.note ?? template.lawCaption;
  const unscheduledReason = briefingType === "UNSCHEDULED" ? (selectedBasis?.note ?? "") : "";

  useEffect(() => {
    if (!allowedBriefingTypes.includes(briefingType)) {
      setBriefingType(initialBriefingType);
    }
  }, [allowedBriefingTypes, briefingType, initialBriefingType]);

  useEffect(() => {
    if (!basisOptions.length) {
      if (basisCode) {
        setBasisCode("");
      }
      return;
    }

    if (!basisOptions.some((option) => option.value === basisCode)) {
      setBasisCode(basisOptions[0].value);
    }
  }, [basisCode, basisOptions]);

  return (
    <>
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 md:col-span-2">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Нормативный профиль</label>
            <Select
              value={profile}
              onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                setProfile(event.target.value as RegulationProfile)
              }
            >
              <option value="LABOR_PROTECTION">{profileLabels.LABOR_PROTECTION}</option>
              <option value="FIRE_SAFETY">{profileLabels.FIRE_SAFETY}</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Тип инструктажа</label>
            <Select
              name="briefingType"
              value={briefingType}
              onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                setBriefingType(event.target.value as BriefingType)
              }
            >
              {allowedBriefingTypes.map((value) => (
                <option key={value} value={value}>
                  {briefingTypeLabels[value] ?? value}
                </option>
              ))}
            </Select>
          </div>

          {basisOptions.length ? (
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-sm font-medium text-slate-700">{template.basisLabel}</label>
              <Select
                value={basisCode}
                onChange={(event: ChangeEvent<HTMLSelectElement>) => setBasisCode(event.target.value)}
              >
                {basisOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              {selectedBasis ? <p className="text-xs text-slate-500">{selectedBasis.note}</p> : null}
            </div>
          ) : null}

          {requiresFireRepeatCycle ? (
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-sm font-medium text-slate-700">
                Категория объекта для расчета следующего инструктажа
              </label>
              <Select
                value={fireRepeatCycle}
                onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                  setFireRepeatCycle(event.target.value as FireRepeatCycle)
                }
              >
                <option value="HALF_YEAR">{fireRepeatCycleLabels.HALF_YEAR}</option>
                <option value="YEAR">{fireRepeatCycleLabels.YEAR}</option>
                <option value="TWO_YEARS">{fireRepeatCycleLabels.TWO_YEARS}</option>
              </Select>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Дата проведения инструктажа</label>
            <Input
              name="briefingDate"
              type="date"
              value={briefingDate}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setBriefingDate(event.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Следующий инструктаж по закону</label>
            <Input type="date" value={nextBriefingDueAt ?? ""} readOnly disabled={!nextBriefingDueAt} />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-medium text-slate-900">{template.journalLabel}</p>
          <p className="mt-1 text-xs text-slate-500">{template.journalReference}</p>
          <p className="mt-3 text-sm text-slate-700">{scheduleNote}</p>
          <p className="mt-2 text-xs text-slate-500">
            Система сама заполнит тему, примечание и материал по выбранному виду инструктажа.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Источник:
            {" "}
            <a
              href={template.lawUrl}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-slate-700 underline decoration-slate-300 underline-offset-2"
            >
              {template.lawTitle}
            </a>
            {" "}
            · {template.lawCaption}
          </p>
        </div>
      </div>

      <input type="hidden" name="topic" value={topic} />
      <input type="hidden" name="journalKind" value={journalKind} />
      <input type="hidden" name="basis" value={basis} />
      <input type="hidden" name="unscheduledReason" value={unscheduledReason} />
      <input type="hidden" name="program" value={materialContent} />
      <input type="hidden" name="notes" value={notes} />
      <input type="hidden" name="materialContent" value={materialContent} />
      <input type="hidden" name="nextBriefingDueAt" value={nextBriefingDueAt ?? ""} />
    </>
  );
}
