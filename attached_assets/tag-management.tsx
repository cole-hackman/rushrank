"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/DropdownMenu";
import { DropdownMenuSeparator } from "@/components/ui/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { TextField } from "@/components/ui/text-field";
import { DefaultPageLayout } from "@/components/layouts/DefaultPageLayout";
import { FeatherCheck } from "@subframe/core";
import { FeatherCopy } from "@subframe/core";
import { FeatherEdit2 } from "@subframe/core";
import { FeatherFilter } from "@subframe/core";
import { FeatherMoreHorizontal } from "@subframe/core";
import { FeatherPlus } from "@subframe/core";
import { FeatherSearch } from "@subframe/core";
import { FeatherTag } from "@subframe/core";
import { FeatherTrash } from "@subframe/core";
import { FeatherTrendingUp } from "@subframe/core";
import { FeatherUsers } from "@subframe/core";
import * as SubframeCore from "@subframe/core";

function AnalyticsAndReports() {
  return (
    <DefaultPageLayout>
      <div className="flex h-full w-full flex-col items-start">
        <div className="flex w-full grow shrink-0 basis-0 flex-col items-start gap-6 bg-default-background px-6 py-6 overflow-auto">
          <div className="flex w-full items-center justify-between">
            <Breadcrumbs>
              <Breadcrumbs.Item>Home</Breadcrumbs.Item>
              <Breadcrumbs.Divider />
              <Breadcrumbs.Item>Admin</Breadcrumbs.Item>
              <Breadcrumbs.Divider />
              <Breadcrumbs.Item active={true}>Tag Management</Breadcrumbs.Item>
            </Breadcrumbs>
            <Button
              icon={<FeatherPlus />}
              onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
            >
              Create Tag
            </Button>
          </div>
          <div className="flex w-full flex-col items-start gap-2">
            <span className="text-heading-1 font-heading-1 text-default-font">
              Tag Management
            </span>
            <span className="text-body font-body text-subtext-color">
              Organize and categorize PNMs with custom tags
            </span>
          </div>
          <div className="flex w-full items-start gap-4 flex-wrap">
            <div className="flex grow shrink-0 basis-0 items-center gap-6 rounded-md bg-[#162238ff] px-6 py-8">
              <div className="flex h-12 w-12 flex-none items-center justify-center rounded-md">
                <FeatherTag className="text-heading-2 font-heading-2 text-white" />
              </div>
              <div className="flex grow shrink-0 basis-0 flex-col items-start gap-1">
                <span className="text-heading-2 font-heading-2 text-white">
                  24
                </span>
                <span className="text-body font-body text-default-font">
                  Total Tags
                </span>
              </div>
            </div>
            <div className="flex grow shrink-0 basis-0 items-center gap-6 rounded-md bg-brand-100 px-6 py-8">
              <div className="flex h-12 w-12 flex-none items-center justify-center rounded-md bg-brand-600">
                <FeatherTrendingUp className="text-heading-2 font-heading-2 text-white" />
              </div>
              <div className="flex grow shrink-0 basis-0 flex-col items-start gap-1">
                <span className="text-heading-2 font-heading-2 text-brand-700">
                  Leadership
                </span>
                <span className="text-body font-body text-brand-700">
                  Most Used Tag
                </span>
              </div>
            </div>
            <div className="flex grow shrink-0 basis-0 items-center gap-6 rounded-md bg-success-100 px-6 py-8">
              <div className="flex h-12 w-12 flex-none items-center justify-center rounded-md bg-success-600">
                <FeatherUsers className="text-heading-2 font-heading-2 text-white" />
              </div>
              <div className="flex grow shrink-0 basis-0 flex-col items-start gap-1">
                <span className="text-heading-2 font-heading-2 text-success-700">
                  156
                </span>
                <span className="text-body font-body text-success-700">
                  Tagged PNMs
                </span>
              </div>
            </div>
          </div>
          <div className="flex w-full items-center gap-4 border-b border-solid border-neutral-border pb-4">
            <div className="flex grow shrink-0 basis-0 items-center gap-2">
              <TextField
                variant="filled"
                label=""
                helpText=""
                icon={<FeatherSearch />}
              >
                <TextField.Input
                  placeholder="Search tags..."
                  value=""
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {}}
                />
              </TextField>
            </div>
            <Button
              variant="neutral-secondary"
              icon={<FeatherFilter />}
              onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
            >
              Filter
            </Button>
          </div>
          <div className="w-full items-start gap-4 grid grid-cols-1">
            <div className="flex grow shrink-0 basis-0 flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-white px-4 py-4 shadow-sm">
              <div className="flex w-full items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 flex-none items-center justify-center rounded-md bg-[#3b82f6ff]">
                    <FeatherTag className="text-body font-body text-white" />
                  </div>
                  <div className="flex flex-col items-start gap-1">
                    <span className="text-body-bold font-body-bold text-default-font">
                      Leadership
                    </span>
                    <Badge>Blue</Badge>
                  </div>
                </div>
                <SubframeCore.DropdownMenu.Root>
                  <SubframeCore.DropdownMenu.Trigger asChild={true}>
                    <IconButton
                      size="small"
                      icon={<FeatherMoreHorizontal />}
                      onClick={(
                        event: React.MouseEvent<HTMLButtonElement>
                      ) => {}}
                    />
                  </SubframeCore.DropdownMenu.Trigger>
                  <SubframeCore.DropdownMenu.Portal>
                    <SubframeCore.DropdownMenu.Content
                      side="bottom"
                      align="end"
                      sideOffset={4}
                    >
                      <DropdownMenu.DropdownItem icon={<FeatherEdit2 />}>
                        Edit
                      </DropdownMenu.DropdownItem>
                      <DropdownMenu.DropdownItem icon={<FeatherCopy />}>
                        Duplicate
                      </DropdownMenu.DropdownItem>
                      <DropdownMenu.DropdownItem icon={<FeatherTrash />}>
                        Delete
                      </DropdownMenu.DropdownItem>
                    </SubframeCore.DropdownMenu.Content>
                  </SubframeCore.DropdownMenu.Portal>
                </SubframeCore.DropdownMenu.Root>
              </div>
              <span className="w-full text-caption font-caption text-subtext-color">
                PNMs who demonstrate strong leadership qualities
              </span>
              <div className="flex w-full items-center justify-between border-t border-solid border-neutral-border pt-3">
                <div className="flex items-center gap-2">
                  <FeatherUsers className="text-caption font-caption text-subtext-color" />
                  <span className="text-caption font-caption text-subtext-color">
                    42 PNMs
                  </span>
                </div>
                <Button
                  variant="neutral-tertiary"
                  size="sm"
                  onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
                >
                  Apply
                </Button>
              </div>
            </div>
            <div className="flex grow shrink-0 basis-0 flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-white px-4 py-4 shadow-sm">
              <div className="flex w-full items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 flex-none items-center justify-center rounded-md bg-[#10b981ff]">
                    <FeatherTag className="text-body font-body text-white" />
                  </div>
                  <div className="flex flex-col items-start gap-1">
                    <span className="text-body-bold font-body-bold text-default-font">
                      Academic
                    </span>
                    <Badge variant="success">Green</Badge>
                  </div>
                </div>
                <SubframeCore.DropdownMenu.Root>
                  <SubframeCore.DropdownMenu.Trigger asChild={true}>
                    <IconButton
                      size="small"
                      icon={<FeatherMoreHorizontal />}
                      onClick={(
                        event: React.MouseEvent<HTMLButtonElement>
                      ) => {}}
                    />
                  </SubframeCore.DropdownMenu.Trigger>
                  <SubframeCore.DropdownMenu.Portal>
                    <SubframeCore.DropdownMenu.Content
                      side="bottom"
                      align="end"
                      sideOffset={4}
                    >
                      <DropdownMenu.DropdownItem icon={<FeatherEdit2 />}>
                        Edit
                      </DropdownMenu.DropdownItem>
                      <DropdownMenu.DropdownItem icon={<FeatherCopy />}>
                        Duplicate
                      </DropdownMenu.DropdownItem>
                      <DropdownMenu.DropdownItem icon={<FeatherTrash />}>
                        Delete
                      </DropdownMenu.DropdownItem>
                    </SubframeCore.DropdownMenu.Content>
                  </SubframeCore.DropdownMenu.Portal>
                </SubframeCore.DropdownMenu.Root>
              </div>
              <span className="w-full text-caption font-caption text-subtext-color">
                High GPA and strong academic performance
              </span>
              <div className="flex w-full items-center justify-between border-t border-solid border-neutral-border pt-3">
                <div className="flex items-center gap-2">
                  <FeatherUsers className="text-caption font-caption text-subtext-color" />
                  <span className="text-caption font-caption text-subtext-color">
                    38 PNMs
                  </span>
                </div>
                <Button
                  variant="neutral-tertiary"
                  size="sm"
                  onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
                >
                  Apply
                </Button>
              </div>
            </div>
            <div className="flex grow shrink-0 basis-0 flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-white px-4 py-4 shadow-sm">
              <div className="flex w-full items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 flex-none items-center justify-center rounded-md bg-[#f59e0bff]">
                    <FeatherTag className="text-body font-body text-white" />
                  </div>
                  <div className="flex flex-col items-start gap-1">
                    <span className="text-body-bold font-body-bold text-default-font">
                      Athletics
                    </span>
                    <Badge variant="warning">Orange</Badge>
                  </div>
                </div>
                <SubframeCore.DropdownMenu.Root>
                  <SubframeCore.DropdownMenu.Trigger asChild={true}>
                    <IconButton
                      size="small"
                      icon={<FeatherMoreHorizontal />}
                      onClick={(
                        event: React.MouseEvent<HTMLButtonElement>
                      ) => {}}
                    />
                  </SubframeCore.DropdownMenu.Trigger>
                  <SubframeCore.DropdownMenu.Portal>
                    <SubframeCore.DropdownMenu.Content
                      side="bottom"
                      align="end"
                      sideOffset={4}
                    >
                      <DropdownMenu.DropdownItem icon={<FeatherEdit2 />}>
                        Edit
                      </DropdownMenu.DropdownItem>
                      <DropdownMenu.DropdownItem icon={<FeatherCopy />}>
                        Duplicate
                      </DropdownMenu.DropdownItem>
                      <DropdownMenu.DropdownItem icon={<FeatherTrash />}>
                        Delete
                      </DropdownMenu.DropdownItem>
                    </SubframeCore.DropdownMenu.Content>
                  </SubframeCore.DropdownMenu.Portal>
                </SubframeCore.DropdownMenu.Root>
              </div>
              <span className="w-full text-caption font-caption text-subtext-color">
                Active in sports and athletic programs
              </span>
              <div className="flex w-full items-center justify-between border-t border-solid border-neutral-border pt-3">
                <div className="flex items-center gap-2">
                  <FeatherUsers className="text-caption font-caption text-subtext-color" />
                  <span className="text-caption font-caption text-subtext-color">
                    29 PNMs
                  </span>
                </div>
                <Button
                  variant="neutral-tertiary"
                  size="sm"
                  onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
                >
                  Apply
                </Button>
              </div>
            </div>
            <div className="flex grow shrink-0 basis-0 flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-white px-4 py-4 shadow-sm">
              <div className="flex w-full items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 flex-none items-center justify-center rounded-md bg-[#8b5cf6ff]">
                    <FeatherTag className="text-body font-body text-white" />
                  </div>
                  <div className="flex flex-col items-start gap-1">
                    <span className="text-body-bold font-body-bold text-default-font">
                      Social
                    </span>
                    <Badge variant="warning">Purple</Badge>
                  </div>
                </div>
                <SubframeCore.DropdownMenu.Root>
                  <SubframeCore.DropdownMenu.Trigger asChild={true}>
                    <IconButton
                      size="small"
                      icon={<FeatherMoreHorizontal />}
                      onClick={(
                        event: React.MouseEvent<HTMLButtonElement>
                      ) => {}}
                    />
                  </SubframeCore.DropdownMenu.Trigger>
                  <SubframeCore.DropdownMenu.Portal>
                    <SubframeCore.DropdownMenu.Content
                      side="bottom"
                      align="end"
                      sideOffset={4}
                    >
                      <DropdownMenu.DropdownItem icon={<FeatherEdit2 />}>
                        Edit
                      </DropdownMenu.DropdownItem>
                      <DropdownMenu.DropdownItem icon={<FeatherCopy />}>
                        Duplicate
                      </DropdownMenu.DropdownItem>
                      <DropdownMenu.DropdownItem icon={<FeatherTrash />}>
                        Delete
                      </DropdownMenu.DropdownItem>
                    </SubframeCore.DropdownMenu.Content>
                  </SubframeCore.DropdownMenu.Portal>
                </SubframeCore.DropdownMenu.Root>
              </div>
              <span className="w-full text-caption font-caption text-subtext-color">
                Strong social skills and networking ability
              </span>
              <div className="flex w-full items-center justify-between border-t border-solid border-neutral-border pt-3">
                <div className="flex items-center gap-2">
                  <FeatherUsers className="text-caption font-caption text-subtext-color" />
                  <span className="text-caption font-caption text-subtext-color">
                    35 PNMs
                  </span>
                </div>
                <Button
                  variant="neutral-tertiary"
                  size="sm"
                  onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
                >
                  Apply
                </Button>
              </div>
            </div>
            <div className="flex grow shrink-0 basis-0 flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-white px-4 py-4 shadow-sm">
              <div className="flex w-full items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 flex-none items-center justify-center rounded-md bg-[#ef4444ff]">
                    <FeatherTag className="text-body font-body text-white" />
                  </div>
                  <div className="flex flex-col items-start gap-1">
                    <span className="text-body-bold font-body-bold text-default-font">
                      Engineering
                    </span>
                    <Badge variant="error">Red</Badge>
                  </div>
                </div>
                <SubframeCore.DropdownMenu.Root>
                  <SubframeCore.DropdownMenu.Trigger asChild={true}>
                    <IconButton
                      size="small"
                      icon={<FeatherMoreHorizontal />}
                      onClick={(
                        event: React.MouseEvent<HTMLButtonElement>
                      ) => {}}
                    />
                  </SubframeCore.DropdownMenu.Trigger>
                  <SubframeCore.DropdownMenu.Portal>
                    <SubframeCore.DropdownMenu.Content
                      side="bottom"
                      align="end"
                      sideOffset={4}
                    >
                      <DropdownMenu.DropdownItem icon={<FeatherEdit2 />}>
                        Edit
                      </DropdownMenu.DropdownItem>
                      <DropdownMenu.DropdownItem icon={<FeatherCopy />}>
                        Duplicate
                      </DropdownMenu.DropdownItem>
                      <DropdownMenu.DropdownItem icon={<FeatherTrash />}>
                        Delete
                      </DropdownMenu.DropdownItem>
                    </SubframeCore.DropdownMenu.Content>
                  </SubframeCore.DropdownMenu.Portal>
                </SubframeCore.DropdownMenu.Root>
              </div>
              <span className="w-full text-caption font-caption text-subtext-color">
                Engineering majors and technical backgrounds
              </span>
              <div className="flex w-full items-center justify-between border-t border-solid border-neutral-border pt-3">
                <div className="flex items-center gap-2">
                  <FeatherUsers className="text-caption font-caption text-subtext-color" />
                  <span className="text-caption font-caption text-subtext-color">
                    24 PNMs
                  </span>
                </div>
                <Button
                  variant="neutral-tertiary"
                  size="sm"
                  onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
                >
                  Apply
                </Button>
              </div>
            </div>
            <div className="flex grow shrink-0 basis-0 flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-white px-4 py-4 shadow-sm">
              <div className="flex w-full items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 flex-none items-center justify-center rounded-md bg-[#64748bff]">
                    <FeatherTag className="text-body font-body text-white" />
                  </div>
                  <div className="flex flex-col items-start gap-1">
                    <span className="text-body-bold font-body-bold text-default-font">
                      Community Service
                    </span>
                    <Badge variant="neutral">Gray</Badge>
                  </div>
                </div>
                <SubframeCore.DropdownMenu.Root>
                  <SubframeCore.DropdownMenu.Trigger asChild={true}>
                    <IconButton
                      size="small"
                      icon={<FeatherMoreHorizontal />}
                      onClick={(
                        event: React.MouseEvent<HTMLButtonElement>
                      ) => {}}
                    />
                  </SubframeCore.DropdownMenu.Trigger>
                  <SubframeCore.DropdownMenu.Portal>
                    <SubframeCore.DropdownMenu.Content
                      side="bottom"
                      align="end"
                      sideOffset={4}
                    >
                      <DropdownMenu.DropdownItem icon={<FeatherEdit2 />}>
                        Edit
                      </DropdownMenu.DropdownItem>
                      <DropdownMenu.DropdownItem icon={<FeatherCopy />}>
                        Duplicate
                      </DropdownMenu.DropdownItem>
                      <DropdownMenu.DropdownItem icon={<FeatherTrash />}>
                        Delete
                      </DropdownMenu.DropdownItem>
                    </SubframeCore.DropdownMenu.Content>
                  </SubframeCore.DropdownMenu.Portal>
                </SubframeCore.DropdownMenu.Root>
              </div>
              <span className="w-full text-caption font-caption text-subtext-color">
                Active in volunteer work and community outreach
              </span>
              <div className="flex w-full items-center justify-between border-t border-solid border-neutral-border pt-3">
                <div className="flex items-center gap-2">
                  <FeatherUsers className="text-caption font-caption text-subtext-color" />
                  <span className="text-caption font-caption text-subtext-color">
                    18 PNMs
                  </span>
                </div>
                <Button
                  variant="neutral-tertiary"
                  size="sm"
                  onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
                >
                  Apply
                </Button>
              </div>
            </div>
          </div>
          <div className="flex w-full flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-white px-6 py-6 shadow-sm">
            <div className="flex w-full items-center justify-between">
              <div className="flex flex-col items-start gap-1">
                <span className="text-heading-3 font-heading-3 text-default-font">
                  Bulk Apply Tags
                </span>
                <span className="text-body font-body text-subtext-color">
                  Apply multiple tags to selected PNMs at once
                </span>
              </div>
              <Button
                icon={<FeatherCheck />}
                onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
              >
                Apply to Selected
              </Button>
            </div>
            <div className="flex w-full items-center gap-2 flex-wrap">
              <Badge icon={<FeatherTag />}>Leadership</Badge>
              <Badge variant="success" icon={<FeatherTag />}>
                Academic
              </Badge>
              <Badge variant="warning" icon={<FeatherTag />}>
                Athletics
              </Badge>
              <Badge variant="warning" icon={<FeatherTag />}>
                Social
              </Badge>
              <Badge variant="error" icon={<FeatherTag />}>
                Engineering
              </Badge>
              <Badge variant="neutral" icon={<FeatherTag />}>
                Community Service
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </DefaultPageLayout>
  );
}

export default AnalyticsAndReports;