import { type SVGProps } from "react";

export function PesoSign(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M8 19h8" />
      <path d="M8 13h8" />
      <path d="M8 7h6" />
      <path d="M8 4v16" />
      <path d="M14 4v16" />
    </svg>
  );
}
