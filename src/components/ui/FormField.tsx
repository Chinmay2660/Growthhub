import { Children, ReactElement, ReactNode, cloneElement, isValidElement, useId } from "react";
import clsx from "clsx";
import Label from "./Label";

export default function FormField({
  label,
  hint,
  children,
  className,
}: {
  label?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  const autoId = useId();
  const only = Children.count(children) === 1 ? Children.toArray(children)[0] : null;
  const child =
    isValidElement(only) &&
    (typeof only.type !== "string" || ["input", "textarea", "select", "button"].includes(only.type))
      ? (only as ReactElement<{ id?: string; "aria-describedby"?: string }>)
      : null;
  const controlId = child ? (child.props.id ?? autoId) : undefined;
  const hintId = hint ? `${autoId}-hint` : undefined;

  let content: ReactNode = children;
  if (child) {
    const extra: { id?: string; "aria-describedby"?: string } = {};
    if (child.props.id == null) extra.id = autoId;
    if (hintId && child.props["aria-describedby"] == null) extra["aria-describedby"] = hintId;
    if (Object.keys(extra).length > 0) content = cloneElement(child, extra);
  }

  return (
    <div className={clsx("space-y-1", className)}>
      {label && <Label htmlFor={controlId}>{label}</Label>}
      {content}
      {hint && (
        <p id={hintId} className="hint">
          {hint}
        </p>
      )}
    </div>
  );
}
