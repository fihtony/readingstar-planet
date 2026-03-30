"use client";

import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

const VARIANT_STYLES = {
  primary:
    "bg-[var(--color-warm-orange)] text-white shadow-md hover:shadow-lg",
  secondary:
    "bg-[var(--color-sky-blue)] text-white shadow-md hover:shadow-lg",
  ghost: "bg-transparent text-gray-700 hover:bg-gray-100",
};

const SIZE_STYLES = {
  sm: "px-3 py-2 text-sm",
  md: "px-5 py-3 text-base",
  lg: "px-7 py-4 text-lg",
};

export function Button({
  variant = "primary",
  size = "md",
  children,
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`
        btn-kid font-bold
        ${VARIANT_STYLES[variant]}
        ${SIZE_STYLES[size]}
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
}
