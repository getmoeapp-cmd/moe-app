import { useEffect, useState } from "react";

// Number box that lets people type "2." on the way to "2.5".
export default function NumInput({ value, onValue, placeholder = "0", ...rest }) {
  const [text, setText] = useState(value == null ? "" : String(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setText(value == null ? "" : String(value)); }, [value, focused]);
  return (
    <input
      {...rest}
      inputMode="decimal"
      value={text}
      placeholder={placeholder}
      onFocus={(e) => { setFocused(true); e.target.select(); }}
      onBlur={() => { setFocused(false); setText(value == null ? "" : String(value)); }}
      onChange={(e) => {
        const t = e.target.value.replace(",", ".");
        if (!/^\d*\.?\d{0,2}$/.test(t)) return;
        setText(t);
        const v = parseFloat(t);
        onValue(Number.isNaN(v) ? 0 : v);
      }}
    />
  );
}
