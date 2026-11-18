import { createElement, type ComponentProps } from "react";

/** Native keyboard and touch behavior, with a shared, truncating selected label. */
export function Select({ children, ...props }: ComponentProps<"select">) {
  return (
    <select {...props}>
      {!props.multiple && (
        <button type="button" className="select-value" tabIndex={-1}>
          {createElement("selectedcontent")}
        </button>
      )}
      {children}
    </select>
  );
}
