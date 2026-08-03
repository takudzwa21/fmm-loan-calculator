import { cn } from "@/lib/utils";

type Option = { value: string; label: string };

export function Segmented({
  label,
  value,
  options,
  onChange,
  name,
  describedBy,
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  name: string;
  describedBy?: string | undefined;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-describedby={describedBy}
      className="inline-flex w-full rounded-md border bg-muted p-0.5"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            id={`${name}-${opt.value}`}
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex-1 rounded-[5px] px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-card hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
