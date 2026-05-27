"use client";

import { useState } from "react";
import { Button, Input, Select, Textarea } from "@dsj/ui";

type QuestionState = {
  id: string;
};

function createQuestionState(index: number): QuestionState {
  return {
    id: `question-${index}-${Date.now()}`,
  };
}

export function ExamQuestionBuilder() {
  const [questions, setQuestions] = useState<QuestionState[]>([
    createQuestionState(0),
    createQuestionState(1),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-900">Вопросы теста</p>
          <p className="mt-1 text-xs text-slate-500">
            Для MVP достаточно 2-5 вопросов с одним правильным ответом.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() =>
            setQuestions((current) =>
              current.length >= 5 ? current : [...current, createQuestionState(current.length)],
            )
          }
        >
          Добавить вопрос
        </Button>
      </div>

      <input type="hidden" name="questionCount" value={String(questions.length)} />

      <div className="space-y-4">
        {questions.map((question, index) => (
          <div key={question.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-900">Вопрос {index + 1}</p>
              {questions.length > 1 ? (
                <Button
                  type="button"
                  variant="subtle"
                  size="sm"
                  onClick={() =>
                    setQuestions((current) =>
                      current.filter((currentQuestion) => currentQuestion.id !== question.id),
                    )
                  }
                >
                  Удалить
                </Button>
              ) : null}
            </div>

            <div className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Формулировка вопроса</label>
                <Textarea
                  name={`questionPrompt_${index}`}
                  rows={3}
                  placeholder="Например: Что нужно сделать перед началом работ на высоте?"
                  required
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {[0, 1, 2, 3].map((optionIndex) => (
                  <div key={optionIndex} className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">
                      Вариант {optionIndex + 1}
                    </label>
                    <Input
                      name={`questionOption_${index}_${optionIndex}`}
                      placeholder={`Ответ ${optionIndex + 1}`}
                      required={optionIndex < 2}
                    />
                  </div>
                ))}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Правильный вариант</label>
                <Select name={`questionCorrectIndex_${index}`} defaultValue="0">
                  <option value="0">Вариант 1</option>
                  <option value="1">Вариант 2</option>
                  <option value="2">Вариант 3</option>
                  <option value="3">Вариант 4</option>
                </Select>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
