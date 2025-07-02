import React from "react";

interface FormInputProps {
  label: string;
  value: string;
  onChange: (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => void;
  placeholder?: string;
  type?: "text" | "textarea" | "dropdown";
  options?: string[];
}
const FormInput: React.FC<FormInputProps> = ({
  label,
  value,
  onChange,
  placeholder,
  type,
  options,
}) => (
  <div className="form-group">
    <label>{label}</label>
    {type === "textarea" ? (
      <textarea value={value} onChange={onChange} placeholder={placeholder} />
    ) : type === "dropdown" ? (
      <select value={value} onChange={onChange}>
        <option value="" disabled>
          Select an option
        </option>
        {options?.map((option, index) => (
          <option key={index} value={option}>
            {option}
          </option>
        ))}
      </select>
    ) : (
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
    )}
  </div>
);

export default FormInput;
