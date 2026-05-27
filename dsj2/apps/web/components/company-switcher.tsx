import { Button, Select } from "@dsj/ui";

type CompanySwitcherProps = {
  pathname: string;
  companies: Array<{
    id: string;
    name: string;
  }>;
  activeCompanyId: string | null;
  searchParams?: Record<string, string | string[] | undefined>;
};

export function CompanySwitcher({
  pathname,
  companies,
  activeCompanyId,
  searchParams = {},
}: CompanySwitcherProps) {
  if (companies.length <= 1 || !activeCompanyId) {
    return null;
  }

  return (
    <form
      action={pathname}
      className="flex flex-col gap-2 sm:flex-row sm:items-end"
    >
      {Object.entries(searchParams).map(([key, value]) => {
        if (
          key === "companyId" ||
          typeof value !== "string" ||
          value.length === 0
        ) {
          return null;
        }

        return <input key={key} type="hidden" name={key} value={value} />;
      })}
      <div className="min-w-56 flex-1 space-y-1">
        <label className="block text-sm font-medium text-slate-700">
          Компания
        </label>
        <Select
          name="companyId"
          defaultValue={activeCompanyId}
          className="h-10"
        >
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </Select>
      </div>
      <Button type="submit" variant="secondary" size="sm">
        Показать
      </Button>
    </form>
  );
}
