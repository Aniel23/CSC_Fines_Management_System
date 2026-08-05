import { type HTMLAttributes } from "react";

export function PesoSign({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "1em",
        height: "1em",
        fontSize: "inherit",
        fontWeight: 700,
        lineHeight: 1,
      }}
      {...props}
    >
      ₱
    </span>
  );
}