"use client";

import React from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/DropdownMenu";
import { DropdownMenuSeparator } from "@/components/ui/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { IconWithBackground } from "@/components/ui/icon-with-background";
import { Table } from "@/components/ui/table";
import { TextField } from "@/components/ui/text-field";
import { DefaultPageLayout } from "@/components/layouts/DefaultPageLayout";
import { FeatherEdit } from "@subframe/core";
import { FeatherFilter } from "@subframe/core";
import { FeatherMoreHorizontal } from "@subframe/core";
import { FeatherSearch } from "@subframe/core";
import { FeatherShield } from "@subframe/core";
import { FeatherStar } from "@subframe/core";
import { FeatherTrash } from "@subframe/core";
import { FeatherUser } from "@subframe/core";
import { FeatherUserCheck } from "@subframe/core";
import { FeatherUserPlus } from "@subframe/core";
import { FeatherUsers } from "@subframe/core";
import { FeatherUserX } from "@subframe/core";
import * as SubframeCore from "@subframe/core";

function AnalyticsAndReports() {
  return (
    <DefaultPageLayout>
      <div className="flex h-full w-full flex-col items-start bg-default-background overflow-auto">
        <div className="flex w-full items-center justify-between border-b border-solid border-neutral-border px-12 py-4 mobile:px-6 mobile:py-4">
          <Breadcrumbs>
            <Breadcrumbs.Item>RushRank</Breadcrumbs.Item>
            <Breadcrumbs.Divider />
            <Breadcrumbs.Item>Admin</Breadcrumbs.Item>
            <Breadcrumbs.Divider />
            <Breadcrumbs.Item active={true}>User Management</Breadcrumbs.Item>
          </Breadcrumbs>
          <Button
            icon={<FeatherUserPlus />}
            onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
          >
            Invite Member
          </Button>
        </div>
        <div className="container max-w-none flex w-full grow shrink-0 basis-0 flex-col items-start gap-8 bg-default-background py-12">
          <div className="flex w-full items-center justify-between">
            <span className="text-heading-1 font-heading-1 text-default-font">
              User Management
            </span>
          </div>
          <div className="flex w-full items-start gap-4 flex-wrap mobile:flex-col mobile:flex-nowrap mobile:gap-4">
            <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md bg-neutral-100 px-6 py-6">
              <div className="flex w-full items-center gap-2">
                <IconWithBackground
                  variant="neutral"
                  size="small"
                  icon={<FeatherUsers />}
                />
                <span className="text-caption-bold font-caption-bold text-subtext-color">
                  TOTAL MEMBERS
                </span>
              </div>
              <span className="text-heading-1 font-heading-1 text-default-font">
                24
              </span>
            </div>
            <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md bg-brand-100 px-6 py-6">
              <div className="flex w-full items-center gap-2">
                <IconWithBackground size="small" icon={<FeatherShield />} />
                <span className="text-caption-bold font-caption-bold text-brand-700">
                  ADMINS
                </span>
              </div>
              <span className="text-heading-1 font-heading-1 text-brand-700">
                3
              </span>
            </div>
            <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md bg-warning-100 px-6 py-6">
              <div className="flex w-full items-center gap-2">
                <IconWithBackground
                  variant="warning"
                  size="small"
                  icon={<FeatherStar />}
                />
                <span className="text-caption-bold font-caption-bold text-warning-700">
                  EXECUTIVES
                </span>
              </div>
              <span className="text-heading-1 font-heading-1 text-warning-700">
                6
              </span>
            </div>
            <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md bg-success-100 px-6 py-6">
              <div className="flex w-full items-center gap-2">
                <IconWithBackground
                  variant="success"
                  size="small"
                  icon={<FeatherUser />}
                />
                <span className="text-caption-bold font-caption-bold text-success-700">
                  BROTHERS
                </span>
              </div>
              <span className="text-heading-1 font-heading-1 text-success-700">
                15
              </span>
            </div>
          </div>
          <div className="flex w-full flex-col items-start gap-4">
            <div className="flex w-full items-center gap-4 mobile:flex-col mobile:flex-nowrap mobile:gap-4">
              <TextField
                className="h-auto grow shrink-0 basis-0"
                variant="filled"
                label=""
                helpText=""
                icon={<FeatherSearch />}
              >
                <TextField.Input
                  placeholder="Search members..."
                  value=""
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {}}
                />
              </TextField>
              <div className="flex items-center gap-2">
                <Button
                  variant="neutral-tertiary"
                  icon={<FeatherFilter />}
                  onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
                >
                  All Roles
                </Button>
              </div>
            </div>
          </div>
          <div className="flex w-full flex-col items-start gap-4 overflow-hidden overflow-x-auto">
            <Table
              header={
                <Table.HeaderRow>
                  <Table.HeaderCell>MEMBER</Table.HeaderCell>
                  <Table.HeaderCell>ROLE</Table.HeaderCell>
                  <Table.HeaderCell>STATUS</Table.HeaderCell>
                  <Table.HeaderCell>JOIN DATE</Table.HeaderCell>
                  <Table.HeaderCell>{""}</Table.HeaderCell>
                </Table.HeaderRow>
              }
            >
              <Table.Row>
                <Table.Cell>
                  <div className="flex items-center gap-3">
                    <Avatar image="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400">
                      JD
                    </Avatar>
                    <div className="flex flex-col items-start">
                      <span className="whitespace-nowrap text-body-bold font-body-bold text-default-font">
                        John Doe
                      </span>
                      <span className="text-caption font-caption text-subtext-color">
                        john.doe@example.com
                      </span>
                    </div>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <Badge>Admin</Badge>
                </Table.Cell>
                <Table.Cell>
                  <Badge variant="success">Active</Badge>
                </Table.Cell>
                <Table.Cell>
                  <span className="whitespace-nowrap text-body font-body text-subtext-color">
                    Sep 15, 2023
                  </span>
                </Table.Cell>
                <Table.Cell>
                  <div className="flex items-center justify-end gap-2">
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
                          asChild={true}
                        >
                          <DropdownMenu.DropdownItem icon={<FeatherEdit />}>
                            Edit Role
                          </DropdownMenu.DropdownItem>
                          <DropdownMenu.DropdownItem icon={<FeatherUserX />}>
                            Deactivate
                          </DropdownMenu.DropdownItem>
                          <DropdownMenuSeparator />
                          <DropdownMenu.DropdownItem icon={<FeatherTrash />}>
                            Remove
                          </DropdownMenu.DropdownItem>
                        </SubframeCore.DropdownMenu.Content>
                      </SubframeCore.DropdownMenu.Portal>
                    </SubframeCore.DropdownMenu.Root>
                  </div>
                </Table.Cell>
              </Table.Row>
              <Table.Row>
                <Table.Cell>
                  <div className="flex items-center gap-3">
                    <Avatar image="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400">
                      MS
                    </Avatar>
                    <div className="flex flex-col items-start">
                      <span className="whitespace-nowrap text-body-bold font-body-bold text-default-font">
                        Michael Smith
                      </span>
                      <span className="text-caption font-caption text-subtext-color">
                        michael.smith@example.com
                      </span>
                    </div>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <Badge variant="warning">Executive</Badge>
                </Table.Cell>
                <Table.Cell>
                  <Badge variant="success">Active</Badge>
                </Table.Cell>
                <Table.Cell>
                  <span className="whitespace-nowrap text-body font-body text-subtext-color">
                    Jan 10, 2024
                  </span>
                </Table.Cell>
                <Table.Cell>
                  <div className="flex items-center justify-end gap-2">
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
                          asChild={true}
                        >
                          <DropdownMenu.DropdownItem icon={<FeatherEdit />}>
                            Edit Role
                          </DropdownMenu.DropdownItem>
                          <DropdownMenu.DropdownItem icon={<FeatherUserX />}>
                            Deactivate
                          </DropdownMenu.DropdownItem>
                          <DropdownMenuSeparator />
                          <DropdownMenu.DropdownItem icon={<FeatherTrash />}>
                            Remove
                          </DropdownMenu.DropdownItem>
                        </SubframeCore.DropdownMenu.Content>
                      </SubframeCore.DropdownMenu.Portal>
                    </SubframeCore.DropdownMenu.Root>
                  </div>
                </Table.Cell>
              </Table.Row>
              <Table.Row>
                <Table.Cell>
                  <div className="flex items-center gap-3">
                    <Avatar image="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400">
                      RJ
                    </Avatar>
                    <div className="flex flex-col items-start">
                      <span className="whitespace-nowrap text-body-bold font-body-bold text-default-font">
                        Robert Johnson
                      </span>
                      <span className="text-caption font-caption text-subtext-color">
                        robert.j@example.com
                      </span>
                    </div>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <Badge variant="neutral">Brother</Badge>
                </Table.Cell>
                <Table.Cell>
                  <Badge variant="success">Active</Badge>
                </Table.Cell>
                <Table.Cell>
                  <span className="whitespace-nowrap text-body font-body text-subtext-color">
                    Aug 22, 2023
                  </span>
                </Table.Cell>
                <Table.Cell>
                  <div className="flex items-center justify-end gap-2">
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
                          asChild={true}
                        >
                          <DropdownMenu.DropdownItem icon={<FeatherEdit />}>
                            Edit Role
                          </DropdownMenu.DropdownItem>
                          <DropdownMenu.DropdownItem icon={<FeatherUserX />}>
                            Deactivate
                          </DropdownMenu.DropdownItem>
                          <DropdownMenuSeparator />
                          <DropdownMenu.DropdownItem icon={<FeatherTrash />}>
                            Remove
                          </DropdownMenu.DropdownItem>
                        </SubframeCore.DropdownMenu.Content>
                      </SubframeCore.DropdownMenu.Portal>
                    </SubframeCore.DropdownMenu.Root>
                  </div>
                </Table.Cell>
              </Table.Row>
              <Table.Row>
                <Table.Cell>
                  <div className="flex items-center gap-3">
                    <Avatar image="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400">
                      DW
                    </Avatar>
                    <div className="flex flex-col items-start">
                      <span className="whitespace-nowrap text-body-bold font-body-bold text-default-font">
                        David Williams
                      </span>
                      <span className="text-caption font-caption text-subtext-color">
                        d.williams@example.com
                      </span>
                    </div>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <Badge variant="warning">Executive</Badge>
                </Table.Cell>
                <Table.Cell>
                  <Badge variant="success">Active</Badge>
                </Table.Cell>
                <Table.Cell>
                  <span className="whitespace-nowrap text-body font-body text-subtext-color">
                    Oct 5, 2023
                  </span>
                </Table.Cell>
                <Table.Cell>
                  <div className="flex items-center justify-end gap-2">
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
                          asChild={true}
                        >
                          <DropdownMenu.DropdownItem icon={<FeatherEdit />}>
                            Edit Role
                          </DropdownMenu.DropdownItem>
                          <DropdownMenu.DropdownItem icon={<FeatherUserX />}>
                            Deactivate
                          </DropdownMenu.DropdownItem>
                          <DropdownMenuSeparator />
                          <DropdownMenu.DropdownItem icon={<FeatherTrash />}>
                            Remove
                          </DropdownMenu.DropdownItem>
                        </SubframeCore.DropdownMenu.Content>
                      </SubframeCore.DropdownMenu.Portal>
                    </SubframeCore.DropdownMenu.Root>
                  </div>
                </Table.Cell>
              </Table.Row>
              <Table.Row>
                <Table.Cell>
                  <div className="flex items-center gap-3">
                    <Avatar image="https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=400">
                      JB
                    </Avatar>
                    <div className="flex flex-col items-start">
                      <span className="whitespace-nowrap text-body-bold font-body-bold text-default-font">
                        James Brown
                      </span>
                      <span className="text-caption font-caption text-subtext-color">
                        james.brown@example.com
                      </span>
                    </div>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <Badge variant="neutral">Brother</Badge>
                </Table.Cell>
                <Table.Cell>
                  <Badge variant="neutral">Inactive</Badge>
                </Table.Cell>
                <Table.Cell>
                  <span className="whitespace-nowrap text-body font-body text-subtext-color">
                    May 18, 2023
                  </span>
                </Table.Cell>
                <Table.Cell>
                  <div className="flex items-center justify-end gap-2">
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
                          <DropdownMenu.DropdownItem icon={<FeatherEdit />}>
                            Edit Role
                          </DropdownMenu.DropdownItem>
                          <DropdownMenu.DropdownItem icon={<FeatherUserCheck />}>
                            Activate
                          </DropdownMenu.DropdownItem>
                          <DropdownMenuSeparator />
                            <DropdownMenu.DropdownItem icon={<FeatherTrash />}>
                              Remove
                            </DropdownMenu.DropdownItem>
                        </SubframeCore.DropdownMenu.Content>
                      </SubframeCore.DropdownMenu.Portal>
                    </SubframeCore.DropdownMenu.Root>
                  </div>
                </Table.Cell>
              </Table.Row>
              <Table.Row>
                <Table.Cell>
                  <div className="flex items-center gap-3">
                    <Avatar image="https://images.unsplash.com/photo-1463453091185-61582044d556?w=400">
                      CM
                    </Avatar>
                    <div className="flex flex-col items-start">
                      <span className="whitespace-nowrap text-body-bold font-body-bold text-default-font">
                        Christopher Miller
                      </span>
                      <span className="text-caption font-caption text-subtext-color">
                        c.miller@example.com
                      </span>
                    </div>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <Badge variant="neutral">Brother</Badge>
                </Table.Cell>
                <Table.Cell>
                  <Badge variant="success">Active</Badge>
                </Table.Cell>
                <Table.Cell>
                  <span className="whitespace-nowrap text-body font-body text-subtext-color">
                    Feb 3, 2024
                  </span>
                </Table.Cell>
                <Table.Cell>
                  <div className="flex items-center justify-end gap-2">
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
                          asChild={true}
                        >
                          <DropdownMenu.DropdownItem icon={<FeatherEdit />}>
                            Edit Role
                          </DropdownMenu.DropdownItem>
                          <DropdownMenu.DropdownItem icon={<FeatherUserX />}>
                            Deactivate
                          </DropdownMenu.DropdownItem>
                          <DropdownMenuSeparator />
                          <DropdownMenu.DropdownItem icon={<FeatherTrash />}>
                            Remove
                          </DropdownMenu.DropdownItem>
                        </SubframeCore.DropdownMenu.Content>
                      </SubframeCore.DropdownMenu.Portal>
                    </SubframeCore.DropdownMenu.Root>
                  </div>
                </Table.Cell>
              </Table.Row>
            </Table>
          </div>
        </div>
      </div>
    </DefaultPageLayout>
  );
}

export default AnalyticsAndReports;