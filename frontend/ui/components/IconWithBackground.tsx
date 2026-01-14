"use client";
/*
 * Documentation:
 * Icon with background — https://app.subframe.com/3122e3d36a51/library?component=Icon+with+background_c5d68c0e-4c0c-4cff-8d8c-6ff334859b3a
 */

import React from "react";
import { FeatherCheck } from "@subframe/core";
import * as SubframeCore from "@subframe/core";
import * as SubframeUtils from "../utils";

interface IconWithBackgroundRootProps
  extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "brand" | "neutral" | "error" | "success" | "warning";
  size?: "x-large" | "large" | "medium" | "small" | "x-small";
  icon?: React.ReactNode;
  square?: boolean;
  className?: string;
}

const IconWithBackgroundRoot = React.forwardRef<
  HTMLDivElement,
  IconWithBackgroundRootProps
>(function IconWithBackgroundRoot(
  {
    variant = "brand",
    size = "x-small",
    icon = <FeatherCheck />,
    square = false,
    className,
    ...otherProps
  }: IconWithBackgroundRootProps,
  ref
) {
  return (
    <div
      className={SubframeUtils.twClassNames(
        "group/c5d68c0e flex h-5 w-5 items-center justify-center gap-2 rounded-full bg-brand-100 dark:bg-brand-900/40",
        {
          "rounded-md": square,
          "h-6 w-6": size === "small",
          "h-8 w-8": size === "medium",
          "h-12 w-12": size === "large",
          "h-16 w-16": size === "x-large",
          "bg-warning-100 dark:bg-warning-900/40": variant === "warning",
          "bg-success-100 dark:bg-success-900/40": variant === "success",
          "bg-error-100 dark:bg-error-900/40": variant === "error",
          "bg-neutral-100 dark:bg-neutral-800": variant === "neutral",
        },
        className
      )}
      ref={ref}
      {...otherProps}
    >
      {icon ? (
        <SubframeCore.IconWrapper
          className={SubframeUtils.twClassNames(
            "font-['Inter'] text-[10px] font-[400] leading-[12px] text-brand-800 dark:text-brand-300",
            {
              "text-caption font-caption": size === "small",
              "text-body font-body": size === "medium",
              "text-heading-2 font-heading-2": size === "large",
              "text-heading-1 font-heading-1": size === "x-large",
              "text-warning-800 dark:text-warning-300": variant === "warning",
              "text-success-800 dark:text-success-300": variant === "success",
              "text-error-800 dark:text-error-300": variant === "error",
              "text-neutral-700 dark:text-neutral-300": variant === "neutral",
            }
          )}
        >
          {icon}
        </SubframeCore.IconWrapper>
      ) : null}
    </div>
  );
});

export const IconWithBackground = IconWithBackgroundRoot;
