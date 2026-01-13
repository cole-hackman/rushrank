"use client";
/*
 * Documentation:
 * Topbar with left nav — https://app.subframe.com/3122e3d36a51/library?component=Topbar+with+left+nav_3cac908f-e20b-4c42-a91e-8736a54e8799
 */

import React from "react";
import * as SubframeCore from "@subframe/core";
import * as SubframeUtils from "../utils";

interface NavItemProps extends React.HTMLAttributes<HTMLDivElement> {
  selected?: boolean;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

const NavItem = React.forwardRef<HTMLDivElement, NavItemProps>(function NavItem(
  {
    selected = false,
    icon = null,
    children,
    className,
    ...otherProps
  }: NavItemProps,
  ref
) {
  return (
    <div
      className={SubframeUtils.twClassNames(
        "group/0d6214aa flex cursor-pointer items-center justify-center gap-2 rounded-md px-2 py-1 hover:bg-neutral-50 active:bg-neutral-100",
        { "bg-brand-50 hover:bg-brand-50 active:bg-brand-100": selected },
        className
      )}
      ref={ref}
      {...otherProps}
    >
      {icon ? (
        <SubframeCore.IconWrapper
          className={SubframeUtils.twClassNames(
            "text-body font-body text-default-font",
            { "text-brand-700": selected }
          )}
        >
          {icon}
        </SubframeCore.IconWrapper>
      ) : null}
      {children ? (
        <span
          className={SubframeUtils.twClassNames(
            "text-body-bold font-body-bold text-default-font",
            { "text-brand-700": selected }
          )}
        >
          {children}
        </span>
      ) : null}
    </div>
  );
});

interface TopbarWithLeftNavRootProps extends React.HTMLAttributes<HTMLElement> {
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  className?: string;
}

const TopbarWithLeftNavRoot = React.forwardRef<
  HTMLElement,
  TopbarWithLeftNavRootProps
>(function TopbarWithLeftNavRoot(
  { leftSlot, rightSlot, className, ...otherProps }: TopbarWithLeftNavRootProps,
  ref
) {
  return (
    <nav
      className={SubframeUtils.twClassNames(
        "flex w-full items-center justify-between border-b border-solid border-neutral-border bg-default-background px-4 py-4",
        className
      )}
      ref={ref}
      {...otherProps}
    >
      {leftSlot ? (
        <div className="flex items-center gap-6">{leftSlot}</div>
      ) : null}
      {rightSlot ? (
        <div className="flex items-center justify-end gap-2">{rightSlot}</div>
      ) : null}
    </nav>
  );
});

export const TopbarWithLeftNav = Object.assign(TopbarWithLeftNavRoot, {
  NavItem,
});
