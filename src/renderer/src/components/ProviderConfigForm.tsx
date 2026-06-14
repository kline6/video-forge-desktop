import { useEffect } from 'react';

interface FieldSchema {
  name: string;
  label: string;
  type: 'text' | 'password' | 'select' | 'number';
  required?: boolean;
  defaultValue?: any;
  options?: { value: string; label: string }[];
}

interface Schema {
  fields: FieldSchema[];
}

interface Props {
  schema: Schema | undefined;
  values: Record<string, any>;
  onChange: (values: Record<string, any>) => void;
  savedValues?: Record<string, any>;
}

export default function ProviderConfigForm({ schema, values, onChange, savedValues }: Props) {
  // Initialize with saved values or defaults
  useEffect(() => {
    if (!schema) return;
    const initial: Record<string, any> = {};
    for (const field of schema.fields) {
      if (values[field.name] !== undefined) continue;
      if (savedValues?.[field.name] !== undefined) {
        initial[field.name] = savedValues[field.name];
      } else if (field.defaultValue !== undefined) {
        initial[field.name] = field.defaultValue;
      }
    }
    if (Object.keys(initial).length > 0) {
      onChange({ ...initial, ...values });
    }
  }, [schema]);

  if (!schema || !schema.fields) {
    return <p className="text-sm text-muted-foreground">此 Provider 无可配置项</p>;
  }

  const handleChange = (name: string, value: any) => {
    onChange({ ...values, [name]: value });
  };

  return (
    <div className="space-y-4">
      {schema.fields.map((field) => (
        <div key={field.name} className="space-y-1.5">
          <label className="text-sm font-medium">
            {field.label}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </label>

          {field.type === 'select' ? (
            <select
              value={values[field.name] ?? field.defaultValue ?? ''}
              onChange={(e) => handleChange(field.name, e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {!field.required && <option value="">不选择</option>}
              {field.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          ) : field.type === 'password' ? (
            <input
              type="password"
              value={values[field.name] ?? ''}
              onChange={(e) => handleChange(field.name, e.target.value)}
              placeholder={field.label}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          ) : field.type === 'number' ? (
            <input
              type="number"
              value={values[field.name] ?? field.defaultValue ?? ''}
              onChange={(e) => handleChange(field.name, parseFloat(e.target.value) || 0)}
              step="0.1"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          ) : (
            <input
              type="text"
              value={values[field.name] ?? ''}
              onChange={(e) => handleChange(field.name, e.target.value)}
              placeholder={field.label}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          )}
        </div>
      ))}
    </div>
  );
}
