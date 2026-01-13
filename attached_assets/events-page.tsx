"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/DropdownMenu";
import { DropdownMenuSeparator } from "@/components/ui/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { IconWithBackground } from "@/components/ui/icon-with-background";
import { Progress } from "@/components/ui/progress";
import { Table } from "@/components/ui/table";
import { TextField } from "@/components/ui/text-field";
import { DefaultPageLayout } from "@/components/layouts/DefaultPageLayout";
import { FeatherAward } from "@subframe/core";
import { FeatherCalendar } from "@subframe/core";
import { FeatherClock } from "@subframe/core";
import { FeatherDownload } from "@subframe/core";
import { FeatherDumbbell } from "@subframe/core";
import { FeatherEdit } from "@subframe/core";
import { FeatherEye } from "@subframe/core";
import { FeatherFilter } from "@subframe/core";
import { FeatherGamepad } from "@subframe/core";
import { FeatherHome } from "@subframe/core";
import { FeatherMapPin } from "@subframe/core";
import { FeatherMoreHorizontal } from "@subframe/core";
import { FeatherPlus } from "@subframe/core";
import { FeatherSave } from "@subframe/core";
import { FeatherSearch } from "@subframe/core";
import { FeatherTrash } from "@subframe/core";
import { FeatherTrendingUp } from "@subframe/core";
import { FeatherUserCheck } from "@subframe/core";
import { FeatherUsers } from "@subframe/core";
import { FeatherUtensils } from "@subframe/core";
import { FeatherX } from "@subframe/core";
import * as SubframeCore from "@subframe/core";

function RushRankEventPage() {
  return (
    <DefaultPageLayout>
      <div className="flex h-full w-full flex-col items-start bg-default-background overflow-auto">
        <div className="flex w-full items-center justify-between border-b border-solid border-neutral-border px-12 py-4 mobile:px-6 mobile:py-4">
          <Breadcrumbs>
            <Breadcrumbs.Item>RushRank</Breadcrumbs.Item>
            <Breadcrumbs.Divider />
            <Breadcrumbs.Item active={true}>Events</Breadcrumbs.Item>
          </Breadcrumbs>
          <Button
            icon={<FeatherPlus />}
            onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
          >
            Create Event
          </Button>
        </div>
        <div className="container max-w-none flex w-full grow shrink-0 basis-0 flex-col items-start gap-8 bg-default-background py-12">
          <div className="flex w-full items-center justify-between">
            <span className="text-heading-1 font-heading-1 text-default-font">
              Events
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="neutral-secondary"
                icon={<FeatherDownload />}
                onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
              >
                Export Attendance
              </Button>
            </div>
          </div>
          <div className="flex w-full items-start gap-4 flex-wrap mobile:flex-col mobile:flex-nowrap mobile:gap-4">
            <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md bg-neutral-100 px-6 py-6">
              <div className="flex w-full items-center gap-2">
                <IconWithBackground
                  variant="neutral"
                  size="small"
                  icon={<FeatherCalendar />}
                />
                <span className="text-caption-bold font-caption-bold text-subtext-color">
                  TOTAL EVENTS
                </span>
              </div>
              <span className="text-heading-1 font-heading-1 text-default-font">
                6
              </span>
            </div>
            <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md bg-success-100 px-6 py-6">
              <div className="flex w-full items-center gap-2">
                <IconWithBackground
                  variant="success"
                  size="small"
                  icon={<FeatherUsers />}
                />
                <span className="text-caption-bold font-caption-bold text-success-700">
                  TOTAL ATTENDANCE
                </span>
              </div>
              <span className="text-heading-1 font-heading-1 text-success-700">
                248
              </span>
            </div>
            <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md bg-brand-100 px-6 py-6">
              <div className="flex w-full items-center gap-2">
                <IconWithBackground size="small" icon={<FeatherTrendingUp />} />
                <span className="text-caption-bold font-caption-bold text-brand-700">
                  AVG ATTENDANCE
                </span>
              </div>
              <span className="text-heading-1 font-heading-1 text-brand-700">
                41
              </span>
            </div>
            <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md bg-warning-100 px-6 py-6">
              <div className="flex w-full items-center gap-2">
                <IconWithBackground
                  variant="warning"
                  size="small"
                  icon={<FeatherClock />}
                />
                <span className="text-caption-bold font-caption-bold text-warning-700">
                  UPCOMING
                </span>
              </div>
              <span className="text-heading-1 font-heading-1 text-warning-700">
                2
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
                  placeholder="Search events..."
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
                  Filter
                </Button>
              </div>
            </div>
          </div>
          <div className="flex w-full flex-col items-start gap-4 overflow-hidden overflow-x-auto">
            <Table
              header={
                <Table.HeaderRow>
                  <Table.HeaderCell>EVENT NAME</Table.HeaderCell>
                  <Table.HeaderCell>DATE &amp; TIME</Table.HeaderCell>
                  <Table.HeaderCell>LOCATION</Table.HeaderCell>
                  <Table.HeaderCell>ATTENDANCE</Table.HeaderCell>
                  <Table.HeaderCell>STATUS</Table.HeaderCell>
                  <Table.HeaderCell>{""}</Table.HeaderCell>
                </Table.HeaderRow>
              }
            >
              <Table.Row>
                <Table.Cell>
                  <div className="flex items-center gap-2">
                    <IconWithBackground size="small" />
                    <span className="whitespace-nowrap text-body-bold font-body-bold text-default-font">
                      Fall BBQ
                    </span>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <div className="flex flex-col items-start">
                    <span className="whitespace-nowrap text-body-bold font-body-bold text-default-font">
                      Sep 15, 2024
                    </span>
                    <span className="text-caption font-caption text-subtext-color">
                      6:00 PM - 9:00 PM
                    </span>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <span className="whitespace-nowrap text-body font-body text-subtext-color">
                    Beta House Backyard
                  </span>
                </Table.Cell>
                <Table.Cell>
                  <div className="flex items-center gap-2">
                    <Progress className="h-auto w-16 flex-none" value={85} />
                    <span className="whitespace-nowrap text-body-bold font-body-bold text-default-font">
                      42/50
                    </span>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <Badge variant="neutral">Completed</Badge>
                </Table.Cell>
                <Table.Cell>
                  <div className="flex items-center justify-end gap-2">
                    <IconButton
                      size="small"
                      icon={<FeatherUserCheck />}
                      onClick={(
                        event: React.MouseEvent<HTMLButtonElement>
                      ) => {}}
                    />
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
                          <DropdownMenu.DropdownItem icon={<FeatherEye />}>
                            View Details
                          </DropdownMenu.DropdownItem>
                          <DropdownMenu.DropdownItem icon={<FeatherEdit />}>
                            Edit Event
                          </DropdownMenu.DropdownItem>
                          <DropdownMenu.DropdownItem icon={<FeatherDownload />}>
                            Export Attendance
                          </DropdownMenu.DropdownItem>
                          <DropdownMenuSeparator />
                          <DropdownMenu.DropdownItem icon={<FeatherTrash />}>
                            Delete
                          </DropdownMenu.DropdownItem>
                        </SubframeCore.DropdownMenu.Content>
                      </SubframeCore.DropdownMenu.Portal>
                    </SubframeCore.DropdownMenu.Root>
                  </div>
                </Table.Cell>
              </Table.Row>
              <Table.Row>
                <Table.Cell>
                  <div className="flex items-center gap-2">
                    <IconWithBackground size="small" icon={<FeatherHome />} />
                    <span className="whitespace-nowrap text-body-bold font-body-bold text-default-font">
                      House Tours
                    </span>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <div className="flex flex-col items-start">
                    <span className="whitespace-nowrap text-body-bold font-body-bold text-default-font">
                      Sep 17, 2024
                    </span>
                    <span className="text-caption font-caption text-subtext-color">
                      4:00 PM - 7:00 PM
                    </span>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <span className="whitespace-nowrap text-body font-body text-subtext-color">
                    Beta Theta Pi House
                  </span>
                </Table.Cell>
                <Table.Cell>
                  <div className="flex items-center gap-2">
                    <Progress className="h-auto w-16 flex-none" value={70} />
                    <span className="whitespace-nowrap text-body-bold font-body-bold text-default-font">
                      35/50
                    </span>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <Badge variant="neutral">Completed</Badge>
                </Table.Cell>
                <Table.Cell>
                  <div className="flex items-center justify-end gap-2">
                    <IconButton
                      size="small"
                      icon={<FeatherUserCheck />}
                      onClick={(
                        event: React.MouseEvent<HTMLButtonElement>
                      ) => {}}
                    />
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
                          <DropdownMenu.DropdownItem icon={<FeatherEye />}>
                            View Details
                          </DropdownMenu.DropdownItem>
                          <DropdownMenu.DropdownItem icon={<FeatherEdit />}>
                            Edit Event
                          </DropdownMenu.DropdownItem>
                          <DropdownMenu.DropdownItem icon={<FeatherDownload />}>
                            Export Attendance
                          </DropdownMenu.DropdownItem>
                          <DropdownMenuSeparator />
                          <DropdownMenu.DropdownItem icon={<FeatherTrash />}>
                            Delete
                          </DropdownMenu.DropdownItem>
                        </SubframeCore.DropdownMenu.Content>
                      </SubframeCore.DropdownMenu.Portal>
                    </SubframeCore.DropdownMenu.Root>
                  </div>
                </Table.Cell>
              </Table.Row>
              <Table.Row>
                <Table.Cell>
                  <div className="flex items-center gap-2">
                    <IconWithBackground
                      size="small"
                      icon={<FeatherDumbbell />}
                    />
                    <span className="whitespace-nowrap text-body-bold font-body-bold text-default-font">
                      Sports Day
                    </span>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <div className="flex flex-col items-start">
                    <span className="whitespace-nowrap text-body-bold font-body-bold text-default-font">
                      Sep 18, 2024
                    </span>
                    <span className="text-caption font-caption text-subtext-color">
                      2:00 PM - 6:00 PM
                    </span>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <span className="whitespace-nowrap text-body font-body text-subtext-color">
                    Rec Center Fields
                  </span>
                </Table.Cell>
                <Table.Cell>
                  <div className="flex items-center gap-2">
                    <Progress className="h-auto w-16 flex-none" value={60} />
                    <span className="whitespace-nowrap text-body-bold font-body-bold text-default-font">
                      30/50
                    </span>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <Badge variant="neutral">Completed</Badge>
                </Table.Cell>
                <Table.Cell>
                  <div className="flex items-center justify-end gap-2">
                    <IconButton
                      size="small"
                      icon={<FeatherUserCheck />}
                      onClick={(
                        event: React.MouseEvent<HTMLButtonElement>
                      ) => {}}
                    />
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
                          <DropdownMenu.DropdownItem icon={<FeatherEye />}>
                            View Details
                          </DropdownMenu.DropdownItem>
                          <DropdownMenu.DropdownItem icon={<FeatherEdit />}>
                            Edit Event
                          </DropdownMenu.DropdownItem>
                          <DropdownMenu.DropdownItem icon={<FeatherDownload />}>
                            Export Attendance
                          </DropdownMenu.DropdownItem>
                          <DropdownMenuSeparator />
                          <DropdownMenu.DropdownItem icon={<FeatherTrash />}>
                            Delete
                          </DropdownMenu.DropdownItem>
                        </SubframeCore.DropdownMenu.Content>
                      </SubframeCore.DropdownMenu.Portal>
                    </SubframeCore.DropdownMenu.Root>
                  </div>
                </Table.Cell>
              </Table.Row>
              <Table.Row>
                <Table.Cell>
                  <div className="flex items-center gap-2">
                    <IconWithBackground
                      size="small"
                      icon={<FeatherGamepad />}
                    />
                    <span className="whitespace-nowrap text-body-bold font-body-bold text-default-font">
                      Game Night
                    </span>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <div className="flex flex-col items-start">
                    <span className="whitespace-nowrap text-body-bold font-body-bold text-default-font">
                      Sep 19, 2024
                    </span>
                    <span className="text-caption font-caption text-subtext-color">
                      7:00 PM - 10:00 PM
                    </span>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <span className="whitespace-nowrap text-body font-body text-subtext-color">
                    Beta House Living Room
                  </span>
                </Table.Cell>
                <Table.Cell>
                  <div className="flex items-center gap-2">
                    <Progress className="h-auto w-16 flex-none" value={88} />
                    <span className="whitespace-nowrap text-body-bold font-body-bold text-default-font">
                      44/50
                    </span>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <Badge variant="neutral">Completed</Badge>
                </Table.Cell>
                <Table.Cell>
                  <div className="flex items-center justify-end gap-2">
                    <IconButton
                      size="small"
                      icon={<FeatherUserCheck />}
                      onClick={(
                        event: React.MouseEvent<HTMLButtonElement>
                      ) => {}}
                    />
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
                          <DropdownMenu.DropdownItem icon={<FeatherEye />}>
                            View Details
                          </DropdownMenu.DropdownItem>
                          <DropdownMenu.DropdownItem icon={<FeatherEdit />}>
                            Edit Event
                          </DropdownMenu.DropdownItem>
                          <DropdownMenu.DropdownItem icon={<FeatherDownload />}>
                            Export Attendance
                          </DropdownMenu.DropdownItem>
                          <DropdownMenuSeparator />
                          <DropdownMenu.DropdownItem icon={<FeatherTrash />}>
                            Delete
                          </DropdownMenu.DropdownItem>
                        </SubframeCore.DropdownMenu.Content>
                      </SubframeCore.DropdownMenu.Portal>
                    </SubframeCore.DropdownMenu.Root>
                  </div>
                </Table.Cell>
              </Table.Row>
              <Table.Row>
                <Table.Cell>
                  <div className="flex items-center gap-2">
                    <IconWithBackground
                      variant="warning"
                      size="small"
                      icon={<FeatherUtensils />}
                    />
                    <span className="whitespace-nowrap text-body-bold font-body-bold text-default-font">
                      Casual Dinner
                    </span>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <div className="flex flex-col items-start">
                    <span className="whitespace-nowrap text-body-bold font-body-bold text-default-font">
                      Sep 21, 2024
                    </span>
                    <span className="text-caption font-caption text-subtext-color">
                      6:00 PM - 8:00 PM
                    </span>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <span className="whitespace-nowrap text-body font-body text-subtext-color">
                    Beta House Dining Room
                  </span>
                </Table.Cell>
                <Table.Cell>
                  <div className="flex items-center gap-2">
                    <Progress className="h-auto w-16 flex-none" value={38} />
                    <span className="whitespace-nowrap text-body-bold font-body-bold text-default-font">
                      19/50
                    </span>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <Badge variant="warning">Upcoming</Badge>
                </Table.Cell>
                <Table.Cell>
                  <div className="flex items-center justify-end gap-2">
                    <IconButton
                      size="small"
                      icon={<FeatherUserCheck />}
                      onClick={(
                        event: React.MouseEvent<HTMLButtonElement>
                      ) => {}}
                    />
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
                          <DropdownMenu.DropdownItem icon={<FeatherEye />}>
                            View Details
                          </DropdownMenu.DropdownItem>
                          <DropdownMenu.DropdownItem icon={<FeatherEdit />}>
                            Edit Event
                          </DropdownMenu.DropdownItem>
                          <DropdownMenu.DropdownItem icon={<FeatherDownload />}>
                            Export Attendance
                          </DropdownMenu.DropdownItem>
                          <DropdownMenuSeparator />
                          <DropdownMenu.DropdownItem icon={<FeatherTrash />}>
                            Delete
                          </DropdownMenu.DropdownItem>
                        </SubframeCore.DropdownMenu.Content>
                      </SubframeCore.DropdownMenu.Portal>
                    </SubframeCore.DropdownMenu.Root>
                  </div>
                </Table.Cell>
              </Table.Row>
              <Table.Row>
                <Table.Cell>
                  <div className="flex items-center gap-2">
                    <IconWithBackground
                      variant="warning"
                      size="small"
                      icon={<FeatherAward />}
                    />
                    <span className="whitespace-nowrap text-body-bold font-body-bold text-default-font">
                      Bid Day Celebration
                    </span>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <div className="flex flex-col items-start">
                    <span className="whitespace-nowrap text-body-bold font-body-bold text-default-font">
                      Sep 24, 2024
                    </span>
                    <span className="text-caption font-caption text-subtext-color">
                      5:00 PM - 11:00 PM
                    </span>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <span className="whitespace-nowrap text-body font-body text-subtext-color">
                    Beta House
                  </span>
                </Table.Cell>
                <Table.Cell>
                  <div className="flex items-center gap-2">
                    <Progress className="h-auto w-16 flex-none" value={0} />
                    <span className="whitespace-nowrap text-body-bold font-body-bold text-default-font">
                      0/60
                    </span>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <Badge variant="warning">Upcoming</Badge>
                </Table.Cell>
                <Table.Cell>
                  <div className="flex items-center justify-end gap-2">
                    <IconButton
                      size="small"
                      icon={<FeatherUserCheck />}
                      onClick={(
                        event: React.MouseEvent<HTMLButtonElement>
                      ) => {}}
                    />
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
                          <DropdownMenu.DropdownItem icon={<FeatherEye />}>
                            View Details
                          </DropdownMenu.DropdownItem>
                          <DropdownMenu.DropdownItem icon={<FeatherEdit />}>
                            Edit Event
                          </DropdownMenu.DropdownItem>
                          <DropdownMenu.DropdownItem icon={<FeatherDownload />}>
                            Export Attendance
                          </DropdownMenu.DropdownItem>
                          <DropdownMenuSeparator />
                          <DropdownMenu.DropdownItem icon={<FeatherTrash />}>
                            Delete
                          </DropdownMenu.DropdownItem>
                        </SubframeCore.DropdownMenu.Content>
                      </SubframeCore.DropdownMenu.Portal>
                    </SubframeCore.DropdownMenu.Root>
                  </div>
                </Table.Cell>
              </Table.Row>
            </Table>
          </div>
          <div className="flex w-full flex-col items-start gap-6 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6 shadow-sm">
            <div className="flex w-full items-center justify-between">
              <span className="text-heading-2 font-heading-2 text-default-font">
                Create New Event
              </span>
              <Button
                variant="neutral-tertiary"
                size="sm"
                icon={<FeatherX />}
                onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
              >
                Cancel
              </Button>
            </div>
            <div className="flex w-full flex-col items-start gap-4">
              <div className="flex w-full items-start gap-4 mobile:flex-col mobile:flex-nowrap mobile:gap-4">
                <TextField
                  className="h-auto grow shrink-0 basis-0"
                  label="Event Name"
                  helpText=""
                >
                  <TextField.Input
                    placeholder="e.g., Fall BBQ"
                    value=""
                    onChange={(
                      event: React.ChangeEvent<HTMLInputElement>
                    ) => {}}
                  />
                </TextField>
                <TextField
                  className="h-auto grow shrink-0 basis-0"
                  label="Location"
                  helpText=""
                  icon={<FeatherMapPin />}
                >
                  <TextField.Input
                    placeholder="e.g., Beta House Backyard"
                    value=""
                    onChange={(
                      event: React.ChangeEvent<HTMLInputElement>
                    ) => {}}
                  />
                </TextField>
              </div>
              <div className="flex w-full items-start gap-4 mobile:flex-col mobile:flex-nowrap mobile:gap-4">
                <TextField
                  className="h-auto grow shrink-0 basis-0"
                  label="Date"
                  helpText=""
                  icon={<FeatherCalendar />}
                >
                  <TextField.Input
                    placeholder="MM/DD/YYYY"
                    value=""
                    onChange={(
                      event: React.ChangeEvent<HTMLInputElement>
                    ) => {}}
                  />
                </TextField>
                <TextField
                  className="h-auto grow shrink-0 basis-0"
                  label="Start Time"
                  helpText=""
                  icon={<FeatherClock />}
                >
                  <TextField.Input
                    placeholder="6:00 PM"
                    value=""
                    onChange={(
                      event: React.ChangeEvent<HTMLInputElement>
                    ) => {}}
                  />
                </TextField>
                <TextField
                  className="h-auto grow shrink-0 basis-0"
                  label="End Time"
                  helpText=""
                  icon={<FeatherClock />}
                >
                  <TextField.Input
                    placeholder="9:00 PM"
                    value=""
                    onChange={(
                      event: React.ChangeEvent<HTMLInputElement>
                    ) => {}}
                  />
                </TextField>
              </div>
              <TextField
                className="h-auto w-full flex-none"
                label="Description"
                helpText="Optional details about the event"
              >
                <TextField.Input
                  placeholder="Add event description..."
                  value=""
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {}}
                />
              </TextField>
              <TextField
                className="h-auto w-full flex-none"
                label="Capacity Limit"
                helpText="Optional maximum number of attendees"
                icon={<FeatherUsers />}
              >
                <TextField.Input
                  placeholder="e.g., 50"
                  value=""
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {}}
                />
              </TextField>
            </div>
            <div className="flex w-full items-center justify-end gap-2">
              <Button
                variant="neutral-secondary"
                onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
              >
                Cancel
              </Button>
              <Button
                icon={<FeatherSave />}
                onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
              >
                Create Event
              </Button>
            </div>
          </div>
        </div>
      </div>
    </DefaultPageLayout>
  );
}

export default RushRankEventPage;