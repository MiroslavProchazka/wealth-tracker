interface FormFieldProps {
  label: string;
  name: string;
  type?: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  placeholder?: string;
  required?: boolean;
  step?: string;
  min?: string;
  options?: { value: string; label: string }[];
  rows?: number;
}

export default function FormField({
  label, name, type = "text", value, onChange, placeholder,
  required, step, min, options, rows,
}: FormFieldProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
      <label htmlFor={name}>{label}</label>
      {options ? (
        <div style={{ position: "relative" }}>
          <select id={name} name={name} value={value} onChange={onChange} required={required}
            style={{ paddingRight: "2rem" }}>
            <option value="">Select…</option>
            {options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {/* Custom chevron */}
          <span style={{
            position: "absolute",
            right: "0.75rem",
            top: "50%",
            transform: "translateY(-50%)",
            pointerEvents: "none",
            color: "var(--text-3)",
            fontSize: "0.6rem",
          }}>▼</span>
        </div>
      ) : type === "textarea" ? (
        <textarea
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          rows={rows ?? 3}
          style={{ resize: "vertical" }}
        />
      ) : (
        <input
          id={name}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          step={step}
          min={min}
        />
      )}
    </div>
  );
}
