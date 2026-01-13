"use client";

import React from "react";
import { Alert } from "@/components/ui/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/ui/dropdown-menu";
import { IconWithBackground } from "@/components/ui/icon-with-background";
import { Progress } from "@/components/ui/progress";
import { Table } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { DefaultPageLayout } from "@/components/layouts/DefaultPageLayout";
import { FeatherAlertTriangle } from "@subframe/core";
import { FeatherBarChart } from "@subframe/core";
import { FeatherCalendar } from "@subframe/core";
import { FeatherCheck } from "@subframe/core";
import { FeatherCheckCircle } from "@subframe/core";
import { FeatherChevronDown } from "@subframe/core";
import { FeatherClock } from "@subframe/core";
import { FeatherDatabase } from "@subframe/core";
import { FeatherDownload } from "@subframe/core";
import { FeatherFileText } from "@subframe/core";
import { FeatherFilter } from "@subframe/core";
import { FeatherHelpCircle } from "@subframe/core";
import { FeatherImage } from "@subframe/core";
import { FeatherShield } from "@subframe/core";
import { FeatherStar } from "@subframe/core";
import { FeatherTarget } from "@subframe/core";
import { FeatherTrendingDown } from "@subframe/core";
import { FeatherTrendingUp } from "@subframe/core";
import { FeatherUser } from "@subframe/core";
import { FeatherUsers } from "@subframe/core";
import { FeatherXCircle } from "@subframe/core";
import * as SubframeCore from "@subframe/core";

function AnalyticsAndReports() {
  return (
    <DefaultPageLayout>
      <div className="container max-w-none flex h-full w-full flex-col items-start gap-6 bg-default-background py-6">
        <div className="flex w-full items-center justify-between">
          <div className="flex flex-col items-start gap-1">
            <span className="text-heading-1 font-heading-1 text-default-font">
              Analytics &amp; Reports
            </span>
            <span className="text-body font-body text-subtext-color">
              Track voting patterns, PNM progression, and event engagement
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="neutral-secondary"
              icon={<FeatherDownload />}
              onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
            >
              Export All Data
            </Button>
            <Button
              icon={<FeatherFileText />}
              onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
            >
              Generate Report
            </Button>
          </div>
        </div>
        <div className="w-full items-start gap-4 grid grid-cols-1">
          <div className="flex flex-col items-start gap-3 rounded-lg border border-solid border-neutral-border bg-white px-6 py-4">
            <div className="flex items-center gap-2">
              <IconWithBackground size="medium" />
              <span className="text-caption-bold font-caption-bold text-subtext-color">
                TOTAL VOTES CAST
              </span>
            </div>
            <span className="text-heading-1 font-heading-1 text-default-font">
              2,847
            </span>
            <div className="flex items-center gap-1">
              <Badge variant="success" icon={<FeatherTrendingUp />}>
                +12%
              </Badge>
              <span className="text-caption font-caption text-subtext-color">
                vs last round
              </span>
            </div>
          </div>
          <div className="flex flex-col items-start gap-3 rounded-lg border border-solid border-neutral-border bg-white px-6 py-4">
            <div className="flex items-center gap-2">
              <IconWithBackground
                variant="success"
                size="medium"
                icon={<FeatherUsers />}
              />
              <span className="text-caption-bold font-caption-bold text-subtext-color">
                AVG PARTICIPATION
              </span>
            </div>
            <span className="text-heading-1 font-heading-1 text-default-font">
              87%
            </span>
            <div className="flex items-center gap-1">
              <Badge variant="success" icon={<FeatherTrendingUp />}>
                +5%
              </Badge>
              <span className="text-caption font-caption text-subtext-color">
                vs last round
              </span>
            </div>
          </div>
          <div className="flex flex-col items-start gap-3 rounded-lg border border-solid border-neutral-border bg-white px-6 py-4">
            <div className="flex items-center gap-2">
              <IconWithBackground
                variant="warning"
                size="medium"
                icon={<FeatherAlertTriangle />}
              />
              <span className="text-caption-bold font-caption-bold text-subtext-color">
                CONTROVERSIAL PNMS
              </span>
            </div>
            <span className="text-heading-1 font-heading-1 text-default-font">
              8
            </span>
            <div className="flex items-center gap-1">
              <Badge variant="warning">40-60% range</Badge>
            </div>
          </div>
          <div className="flex flex-col items-start gap-3 rounded-lg border border-solid border-neutral-border bg-white px-6 py-4">
            <div className="flex items-center gap-2">
              <IconWithBackground
                variant="neutral"
                size="medium"
                icon={<FeatherCalendar />}
              />
              <span className="text-caption-bold font-caption-bold text-subtext-color">
                COMPLETED ROUNDS
              </span>
            </div>
            <span className="text-heading-1 font-heading-1 text-default-font">
              3
            </span>
            <div className="flex items-center gap-1">
              <span className="text-caption font-caption text-subtext-color">
                1 in progress
              </span>
            </div>
          </div>
        </div>
        <Tabs>
          <Tabs.Item active={true}>Round Comparison</Tabs.Item>
          <Tabs.Item>Voting Patterns</Tabs.Item>
          <Tabs.Item>Attendance</Tabs.Item>
          <Tabs.Item>Exports</Tabs.Item>
        </Tabs>
        <div className="flex w-full flex-col items-start gap-6 rounded-lg border border-solid border-neutral-border bg-white px-6 py-6">
          <div className="flex w-full items-center justify-between">
            <div className="flex flex-col items-start gap-1">
              <span className="text-heading-2 font-heading-2 text-default-font">
                Round-by-Round PNM Score Evolution
              </span>
              <span className="text-body font-body text-subtext-color">
                Track how PNM scores changed across voting rounds
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="neutral-tertiary"
                size="small"
                icon={<FeatherFilter />}
                onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
              >
                Filter PNMs
              </Button>
              <SubframeCore.DropdownMenu.Root>
                <SubframeCore.DropdownMenu.Trigger asChild={true}>
                  <Button
                    variant="neutral-secondary"
                    size="small"
                    iconRight={<FeatherChevronDown />}
                    onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
                  >
                    Round 1-3
                  </Button>
                </SubframeCore.DropdownMenu.Trigger>
                <SubframeCore.DropdownMenu.Portal>
                  <SubframeCore.DropdownMenu.Content
                    side="bottom"
                    align="end"
                    sideOffset={4}
                    asChild={true}
                  >
                    <DropdownMenu>
                      <DropdownMenu.DropdownItem icon={<FeatherCheck />}>
                        All Rounds
                      </DropdownMenu.DropdownItem>
                      <DropdownMenu.DropdownItem icon={null}>
                        Round 1-2
                      </DropdownMenu.DropdownItem>
                      <DropdownMenu.DropdownItem icon={null}>
                        Round 2-3
                      </DropdownMenu.DropdownItem>
                    </DropdownMenu>
                  </SubframeCore.DropdownMenu.Content>
                </SubframeCore.DropdownMenu.Portal>
              </SubframeCore.DropdownMenu.Root>
            </div>
          </div>
          <div className="flex w-full flex-col items-start gap-4">
            <div className="flex w-full items-start gap-4 rounded-md border border-solid border-neutral-border bg-neutral-50 px-4 py-4">
              <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2">
                <div className="flex items-center gap-2">
                  <Avatar
                    size="small"
                    image="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop"
                  >
                    JD
                  </Avatar>
                  <div className="flex flex-col items-start">
                    <span className="text-body-bold font-body-bold text-default-font">
                      John Davis
                    </span>
                    <span className="text-caption font-caption text-subtext-color">
                      Computer Science • Class of 2026
                    </span>
                  </div>
                </div>
                <div className="flex w-full flex-col items-start gap-2">
                  <div className="flex w-full items-center gap-2">
                    <span className="w-20 flex-none text-caption font-caption text-subtext-color">
                      Round 1
                    </span>
                    <Progress
                      className="h-2 grow shrink-0 basis-0"
                      value={45}
                    />
                    <span className="text-body-bold font-body-bold text-default-font">
                      45%
                    </span>
                  </div>
                  <div className="flex w-full items-center gap-2">
                    <span className="w-20 flex-none text-caption font-caption text-subtext-color">
                      Round 2
                    </span>
                    <Progress
                      className="h-2 grow shrink-0 basis-0"
                      value={62}
                    />
                    <span className="text-body-bold font-body-bold text-default-font">
                      62%
                    </span>
                  </div>
                  <div className="flex w-full items-center gap-2">
                    <span className="w-20 flex-none text-caption font-caption text-subtext-color">
                      Round 3
                    </span>
                    <Progress
                      className="h-2 grow shrink-0 basis-0"
                      value={78}
                    />
                    <span className="text-body-bold font-body-bold text-default-font">
                      78%
                    </span>
                  </div>
                </div>
                <Badge variant="success" icon={<FeatherTrendingUp />}>
                  +33% improvement
                </Badge>
              </div>
            </div>
            <div className="flex w-full items-start gap-4 rounded-md border border-solid border-neutral-border bg-neutral-50 px-4 py-4">
              <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2">
                <div className="flex items-center gap-2">
                  <Avatar
                    size="small"
                    image="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop"
                  >
                    MS
                  </Avatar>
                  <div className="flex flex-col items-start">
                    <span className="text-body-bold font-body-bold text-default-font">
                      Michael Smith
                    </span>
                    <span className="text-caption font-caption text-subtext-color">
                      Business Admin • Class of 2027
                    </span>
                  </div>
                </div>
                <div className="flex w-full flex-col items-start gap-2">
                  <div className="flex w-full items-center gap-2">
                    <span className="w-20 flex-none text-caption font-caption text-subtext-color">
                      Round 1
                    </span>
                    <Progress
                      className="h-2 grow shrink-0 basis-0"
                      value={82}
                    />
                    <span className="text-body-bold font-body-bold text-default-font">
                      82%
                    </span>
                  </div>
                  <div className="flex w-full items-center gap-2">
                    <span className="w-20 flex-none text-caption font-caption text-subtext-color">
                      Round 2
                    </span>
                    <Progress
                      className="h-2 grow shrink-0 basis-0"
                      value={88}
                    />
                    <span className="text-body-bold font-body-bold text-default-font">
                      88%
                    </span>
                  </div>
                  <div className="flex w-full items-center gap-2">
                    <span className="w-20 flex-none text-caption font-caption text-subtext-color">
                      Round 3
                    </span>
                    <Progress
                      className="h-2 grow shrink-0 basis-0"
                      value={91}
                    />
                    <span className="text-body-bold font-body-bold text-default-font">
                      91%
                    </span>
                  </div>
                </div>
                <Badge variant="success" icon={<FeatherTrendingUp />}>
                  +9% improvement
                </Badge>
              </div>
            </div>
            <div className="flex w-full items-start gap-4 rounded-md border border-solid border-neutral-border bg-neutral-50 px-4 py-4">
              <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2">
                <div className="flex items-center gap-2">
                  <Avatar
                    size="small"
                    image="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=200&fit=crop"
                  >
                    AL
                  </Avatar>
                  <div className="flex flex-col items-start">
                    <span className="text-body-bold font-body-bold text-default-font">
                      Alex Lee
                    </span>
                    <span className="text-caption font-caption text-subtext-color">
                      Mechanical Engineering • Class of 2026
                    </span>
                  </div>
                </div>
                <div className="flex w-full flex-col items-start gap-2">
                  <div className="flex w-full items-center gap-2">
                    <span className="w-20 flex-none text-caption font-caption text-subtext-color">
                      Round 1
                    </span>
                    <Progress
                      className="h-2 grow shrink-0 basis-0"
                      value={68}
                    />
                    <span className="text-body-bold font-body-bold text-default-font">
                      68%
                    </span>
                  </div>
                  <div className="flex w-full items-center gap-2">
                    <span className="w-20 flex-none text-caption font-caption text-subtext-color">
                      Round 2
                    </span>
                    <Progress
                      className="h-2 grow shrink-0 basis-0"
                      value={52}
                    />
                    <span className="text-body-bold font-body-bold text-default-font">
                      52%
                    </span>
                  </div>
                  <div className="flex w-full items-center gap-2">
                    <span className="w-20 flex-none text-caption font-caption text-subtext-color">
                      Round 3
                    </span>
                    <Progress
                      className="h-2 grow shrink-0 basis-0"
                      value={47}
                    />
                    <span className="text-body-bold font-body-bold text-default-font">
                      47%
                    </span>
                  </div>
                </div>
                <Badge variant="error" icon={<FeatherTrendingDown />}>
                  -21% decline
                </Badge>
              </div>
            </div>
          </div>
        </div>
        <div className="flex w-full flex-col items-start gap-6 rounded-lg border border-solid border-neutral-border bg-white px-6 py-6">
          <div className="flex w-full items-center justify-between">
            <div className="flex flex-col items-start gap-1">
              <span className="text-heading-2 font-heading-2 text-default-font">
                Brother Voting Patterns
              </span>
              <span className="text-body font-body text-subtext-color">
                Analyze individual voting behavior and participation rates
              </span>
            </div>
            <Button
              variant="neutral-secondary"
              size="small"
              icon={<FeatherDownload />}
              onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
            >
              Export Data
            </Button>
          </div>
          <Alert
            variant="brand"
            title="How voting patterns are calculated"
            description="Harshness is determined by yes-vote percentage relative to chapter average. Participation shows votes cast vs total opportunities."
          />
          <Table
            header={
              <Table.HeaderRow>
                <Table.HeaderCell icon={<FeatherUser />}>
                  Brother
                </Table.HeaderCell>
                <Table.HeaderCell icon={<FeatherTrendingUp />}>
                  Participation
                </Table.HeaderCell>
                <Table.HeaderCell icon={<FeatherCheckCircle />}>
                  Yes Votes
                </Table.HeaderCell>
                <Table.HeaderCell icon={<FeatherXCircle />}>
                  No Votes
                </Table.HeaderCell>
                <Table.HeaderCell icon={<FeatherHelpCircle />}>
                  Unknown
                </Table.HeaderCell>
                <Table.HeaderCell icon={<FeatherBarChart />}>
                  Pattern
                </Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
              </Table.HeaderRow>
            }
          >
            <Table.Row>
              <Table.Cell>
                <div className="flex items-center gap-2">
                  <Avatar
                    size="small"
                    image="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop"
                  >
                    TJ
                  </Avatar>
                  <div className="flex flex-col items-start">
                    <span className="text-body-bold font-body-bold text-default-font">
                      Tyler Johnson
                    </span>
                    <span className="text-caption font-caption text-subtext-color">
                      Executive
                    </span>
                  </div>
                </div>
              </Table.Cell>
              <Table.Cell>
                <div className="flex items-center gap-2">
                  <Progress className="h-2 w-24 flex-none" value={94} />
                  <span className="text-body-bold font-body-bold text-default-font">
                    94%
                  </span>
                </div>
              </Table.Cell>
              <Table.Cell>
                <span className="text-body font-body text-default-font">
                  67
                </span>
              </Table.Cell>
              <Table.Cell>
                <span className="text-body font-body text-default-font">
                  24
                </span>
              </Table.Cell>
              <Table.Cell>
                <span className="text-body font-body text-default-font">3</span>
              </Table.Cell>
              <Table.Cell>
                <Badge variant="success">Supportive</Badge>
              </Table.Cell>
              <Table.Cell>
                <Badge variant="neutral" icon={<FeatherCheck />}>
                  Active
                </Badge>
              </Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell>
                <div className="flex items-center gap-2">
                  <Avatar
                    size="small"
                    image="https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=200&h=200&fit=crop"
                  >
                    BR
                  </Avatar>
                  <div className="flex flex-col items-start">
                    <span className="text-body-bold font-body-bold text-default-font">
                      Brad Roberts
                    </span>
                    <span className="text-caption font-caption text-subtext-color">
                      Brother
                    </span>
                  </div>
                </div>
              </Table.Cell>
              <Table.Cell>
                <div className="flex items-center gap-2">
                  <Progress className="h-2 w-24 flex-none" value={78} />
                  <span className="text-body-bold font-body-bold text-default-font">
                    78%
                  </span>
                </div>
              </Table.Cell>
              <Table.Cell>
                <span className="text-body font-body text-default-font">
                  28
                </span>
              </Table.Cell>
              <Table.Cell>
                <span className="text-body font-body text-default-font">
                  45
                </span>
              </Table.Cell>
              <Table.Cell>
                <span className="text-body font-body text-default-font">1</span>
              </Table.Cell>
              <Table.Cell>
                <Badge variant="error">Harsh</Badge>
              </Table.Cell>
              <Table.Cell>
                <Badge variant="neutral" icon={<FeatherCheck />}>
                  Active
                </Badge>
              </Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell>
                <div className="flex items-center gap-2">
                  <Avatar
                    size="small"
                    image="https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=200&h=200&fit=crop"
                  >
                    DS
                  </Avatar>
                  <div className="flex flex-col items-start">
                    <span className="text-body-bold font-body-bold text-default-font">
                      David Santos
                    </span>
                    <span className="text-caption font-caption text-subtext-color">
                      Brother
                    </span>
                  </div>
                </div>
              </Table.Cell>
              <Table.Cell>
                <div className="flex items-center gap-2">
                  <Progress className="h-2 w-24 flex-none" value={88} />
                  <span className="text-body-bold font-body-bold text-default-font">
                    88%
                  </span>
                </div>
              </Table.Cell>
              <Table.Cell>
                <span className="text-body font-body text-default-font">
                  51
                </span>
              </Table.Cell>
              <Table.Cell>
                <span className="text-body font-body text-default-font">
                  32
                </span>
              </Table.Cell>
              <Table.Cell>
                <span className="text-body font-body text-default-font">0</span>
              </Table.Cell>
              <Table.Cell>
                <Badge variant="neutral">Balanced</Badge>
              </Table.Cell>
              <Table.Cell>
                <Badge variant="neutral" icon={<FeatherCheck />}>
                  Active
                </Badge>
              </Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell>
                <div className="flex items-center gap-2">
                  <Avatar
                    size="small"
                    image="https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?w=200&h=200&fit=crop"
                  >
                    MW
                  </Avatar>
                  <div className="flex flex-col items-start">
                    <span className="text-body-bold font-body-bold text-default-font">
                      Marcus Williams
                    </span>
                    <span className="text-caption font-caption text-subtext-color">
                      Brother
                    </span>
                  </div>
                </div>
              </Table.Cell>
              <Table.Cell>
                <div className="flex items-center gap-2">
                  <Progress className="h-2 w-24 flex-none" value={42} />
                  <span className="text-body-bold font-body-bold text-default-font">
                    42%
                  </span>
                </div>
              </Table.Cell>
              <Table.Cell>
                <span className="text-body font-body text-default-font">
                  23
                </span>
              </Table.Cell>
              <Table.Cell>
                <span className="text-body font-body text-default-font">
                  16
                </span>
              </Table.Cell>
              <Table.Cell>
                <span className="text-body font-body text-default-font">1</span>
              </Table.Cell>
              <Table.Cell>
                <Badge variant="neutral">Balanced</Badge>
              </Table.Cell>
              <Table.Cell>
                <Badge variant="warning" icon={<FeatherAlertTriangle />}>
                  Low Activity
                </Badge>
              </Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell>
                <div className="flex items-center gap-2">
                  <Avatar
                    size="small"
                    image="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop"
                  >
                    JC
                  </Avatar>
                  <div className="flex flex-col items-start">
                    <span className="text-body-bold font-body-bold text-default-font">
                      James Carter
                    </span>
                    <span className="text-caption font-caption text-subtext-color">
                      Executive
                    </span>
                  </div>
                </div>
              </Table.Cell>
              <Table.Cell>
                <div className="flex items-center gap-2">
                  <Progress className="h-2 w-24 flex-none" value={100} />
                  <span className="text-body-bold font-body-bold text-default-font">
                    100%
                  </span>
                </div>
              </Table.Cell>
              <Table.Cell>
                <span className="text-body font-body text-default-font">
                  72
                </span>
              </Table.Cell>
              <Table.Cell>
                <span className="text-body font-body text-default-font">
                  22
                </span>
              </Table.Cell>
              <Table.Cell>
                <span className="text-body font-body text-default-font">0</span>
              </Table.Cell>
              <Table.Cell>
                <Badge variant="success">Supportive</Badge>
              </Table.Cell>
              <Table.Cell>
                <Badge variant="success" icon={<FeatherStar />}>
                  Top Contributor
                </Badge>
              </Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell>
                <div className="flex items-center gap-2">
                  <Avatar
                    size="small"
                    image="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop"
                  >
                    RG
                  </Avatar>
                  <div className="flex flex-col items-start">
                    <span className="text-body-bold font-body-bold text-default-font">
                      Ryan Garcia
                    </span>
                    <span className="text-caption font-caption text-subtext-color">
                      Brother
                    </span>
                  </div>
                </div>
              </Table.Cell>
              <Table.Cell>
                <div className="flex items-center gap-2">
                  <Progress className="h-2 w-24 flex-none" value={85} />
                  <span className="text-body-bold font-body-bold text-default-font">
                    85%
                  </span>
                </div>
              </Table.Cell>
              <Table.Cell>
                <span className="text-body font-body text-default-font">
                  59
                </span>
              </Table.Cell>
              <Table.Cell>
                <span className="text-body font-body text-default-font">
                  21
                </span>
              </Table.Cell>
              <Table.Cell>
                <span className="text-body font-body text-default-font">0</span>
              </Table.Cell>
              <Table.Cell>
                <Badge variant="success">Supportive</Badge>
              </Table.Cell>
              <Table.Cell>
                <Badge variant="neutral" icon={<FeatherCheck />}>
                  Active
                </Badge>
              </Table.Cell>
            </Table.Row>
          </Table>
        </div>
        <div className="flex w-full flex-col items-start gap-6 rounded-lg border border-solid border-neutral-border bg-white px-6 py-6">
          <div className="flex w-full items-center justify-between">
            <div className="flex flex-col items-start gap-1">
              <span className="text-heading-2 font-heading-2 text-default-font">
                Event Attendance Trends
              </span>
              <span className="text-body font-body text-subtext-color">
                Track engagement and attendance patterns across rush events
              </span>
            </div>
            <Button
              variant="neutral-secondary"
              size="small"
              icon={<FeatherDownload />}
              onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
            >
              Export Data
            </Button>
          </div>
          <div className="flex w-full flex-col items-start gap-4">
            <div className="flex w-full items-center gap-4 rounded-md border border-solid border-neutral-border bg-neutral-50 px-4 py-4">
              <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2">
                <div className="flex w-full items-center justify-between">
                  <div className="flex flex-col items-start">
                    <span className="text-body-bold font-body-bold text-default-font">
                      Welcome BBQ
                    </span>
                    <span className="text-caption font-caption text-subtext-color">
                      Sept 15, 2024 • 6:00 PM
                    </span>
                  </div>
                  <Badge variant="success" icon={<FeatherCheck />}>
                    Completed
                  </Badge>
                </div>
                <div className="flex w-full items-center gap-2">
                  <span className="text-caption font-caption text-subtext-color">
                    Attendance:
                  </span>
                  <Progress className="h-2 grow shrink-0 basis-0" value={92} />
                  <span className="text-body-bold font-body-bold text-default-font">
                    58 / 63 PNMs
                  </span>
                </div>
              </div>
            </div>
            <div className="flex w-full items-center gap-4 rounded-md border border-solid border-neutral-border bg-neutral-50 px-4 py-4">
              <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2">
                <div className="flex w-full items-center justify-between">
                  <div className="flex flex-col items-start">
                    <span className="text-body-bold font-body-bold text-default-font">
                      Game Night
                    </span>
                    <span className="text-caption font-caption text-subtext-color">
                      Sept 17, 2024 • 7:30 PM
                    </span>
                  </div>
                  <Badge variant="success" icon={<FeatherCheck />}>
                    Completed
                  </Badge>
                </div>
                <div className="flex w-full items-center gap-2">
                  <span className="text-caption font-caption text-subtext-color">
                    Attendance:
                  </span>
                  <Progress className="h-2 grow shrink-0 basis-0" value={78} />
                  <span className="text-body-bold font-body-bold text-default-font">
                    49 / 63 PNMs
                  </span>
                </div>
              </div>
            </div>
            <div className="flex w-full items-center gap-4 rounded-md border border-solid border-neutral-border bg-neutral-50 px-4 py-4">
              <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2">
                <div className="flex w-full items-center justify-between">
                  <div className="flex flex-col items-start">
                    <span className="text-body-bold font-body-bold text-default-font">
                      Sports Day
                    </span>
                    <span className="text-caption font-caption text-subtext-color">
                      Sept 19, 2024 • 3:00 PM
                    </span>
                  </div>
                  <Badge variant="success" icon={<FeatherCheck />}>
                    Completed
                  </Badge>
                </div>
                <div className="flex w-full items-center gap-2">
                  <span className="text-caption font-caption text-subtext-color">
                    Attendance:
                  </span>
                  <Progress className="h-2 grow shrink-0 basis-0" value={85} />
                  <span className="text-body-bold font-body-bold text-default-font">
                    54 / 63 PNMs
                  </span>
                </div>
              </div>
            </div>
            <div className="flex w-full items-center gap-4 rounded-md border border-solid border-neutral-border bg-neutral-50 px-4 py-4">
              <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2">
                <div className="flex w-full items-center justify-between">
                  <div className="flex flex-col items-start">
                    <span className="text-body-bold font-body-bold text-default-font">
                      Formal Dinner
                    </span>
                    <span className="text-caption font-caption text-subtext-color">
                      Sept 21, 2024 • 6:00 PM
                    </span>
                  </div>
                  <Badge variant="warning" icon={<FeatherClock />}>
                    Upcoming
                  </Badge>
                </div>
                <div className="flex w-full items-center gap-2">
                  <span className="text-caption font-caption text-subtext-color">
                    Expected:
                  </span>
                  <Progress className="h-2 grow shrink-0 basis-0" value={0} />
                  <span className="text-body-bold font-body-bold text-default-font">
                    0 / 63 PNMs
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex w-full items-center gap-2 rounded-md border border-solid border-brand-200 bg-brand-50 px-4 py-3">
            <FeatherTrendingUp className="text-body font-body text-brand-700" />
            <span className="text-body font-body text-brand-900">
              Average attendance rate across all events: 85%
            </span>
          </div>
        </div>
        <div className="flex w-full flex-col items-start gap-6 rounded-lg border border-solid border-neutral-border bg-white px-6 py-6">
          <div className="flex w-full flex-col items-start gap-1">
            <span className="text-heading-2 font-heading-2 text-default-font">
              Export Center
            </span>
            <span className="text-body font-body text-subtext-color">
              Download comprehensive reports and data exports
            </span>
          </div>
          <div className="w-full items-start gap-4 grid grid-cols-1">
            <div className="flex flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-neutral-50 px-4 py-4">
              <div className="flex items-center gap-2">
                <IconWithBackground size="medium" icon={<FeatherFileText />} />
                <div className="flex flex-col items-start">
                  <span className="text-body-bold font-body-bold text-default-font">
                    PNM Master List
                  </span>
                  <span className="text-caption font-caption text-subtext-color">
                    All PNM data with scores
                  </span>
                </div>
              </div>
              <Button
                className="h-8 w-full flex-none"
                variant="neutral-secondary"
                icon={<FeatherDownload />}
                onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
              >
                Download CSV
              </Button>
            </div>
            <div className="flex flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-neutral-50 px-4 py-4">
              <div className="flex items-center gap-2">
                <IconWithBackground
                  variant="success"
                  size="medium"
                  icon={<FeatherBarChart />}
                />
                <div className="flex flex-col items-start">
                  <span className="text-body-bold font-body-bold text-default-font">
                    Voting Analytics
                  </span>
                  <span className="text-caption font-caption text-subtext-color">
                    Brother voting patterns
                  </span>
                </div>
              </div>
              <Button
                className="h-8 w-full flex-none"
                variant="neutral-secondary"
                icon={<FeatherDownload />}
                onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
              >
                Download CSV
              </Button>
            </div>
            <div className="flex flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-neutral-50 px-4 py-4">
              <div className="flex items-center gap-2">
                <IconWithBackground
                  variant="warning"
                  size="medium"
                  icon={<FeatherCalendar />}
                />
                <div className="flex flex-col items-start">
                  <span className="text-body-bold font-body-bold text-default-font">
                    Event Attendance
                  </span>
                  <span className="text-caption font-caption text-subtext-color">
                    Attendance by event
                  </span>
                </div>
              </div>
              <Button
                className="h-8 w-full flex-none"
                variant="neutral-secondary"
                icon={<FeatherDownload />}
                onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
              >
                Download CSV
              </Button>
            </div>
            <div className="flex flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-neutral-50 px-4 py-4">
              <div className="flex items-center gap-2">
                <IconWithBackground
                  variant="error"
                  size="medium"
                  icon={<FeatherTarget />}
                />
                <div className="flex flex-col items-start">
                  <span className="text-body-bold font-body-bold text-default-font">
                    Bid Decision Report
                  </span>
                  <span className="text-caption font-caption text-subtext-color">
                    Final recommendations
                  </span>
                </div>
              </div>
              <Button
                className="h-8 w-full flex-none"
                variant="neutral-secondary"
                icon={<FeatherDownload />}
                onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
              >
                Download PDF
              </Button>
            </div>
            <div className="flex flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-neutral-50 px-4 py-4">
              <div className="flex items-center gap-2">
                <IconWithBackground
                  variant="neutral"
                  size="medium"
                  icon={<FeatherImage />}
                />
                <div className="flex flex-col items-start">
                  <span className="text-body-bold font-body-bold text-default-font">
                    Visual Report
                  </span>
                  <span className="text-caption font-caption text-subtext-color">
                    Charts and graphics
                  </span>
                </div>
              </div>
              <Button
                className="h-8 w-full flex-none"
                variant="neutral-secondary"
                icon={<FeatherDownload />}
                onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
              >
                Download PNG
              </Button>
            </div>
            <div className="flex flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-neutral-50 px-4 py-4">
              <div className="flex items-center gap-2">
                <IconWithBackground size="medium" icon={<FeatherDatabase />} />
                <div className="flex flex-col items-start">
                  <span className="text-body-bold font-body-bold text-default-font">
                    Complete Database
                  </span>
                  <span className="text-caption font-caption text-subtext-color">
                    All data (admin only)
                  </span>
                </div>
              </div>
              <Button
                className="h-8 w-full flex-none"
                variant="neutral-secondary"
                icon={<FeatherDownload />}
                onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
              >
                Download ZIP
              </Button>
            </div>
          </div>
          <Alert
            icon={<FeatherShield />}
            title="Data Privacy Notice"
            description="All exports contain sensitive PNM data. Handle with care and follow chapter privacy policies."
          />
        </div>
      </div>
    </DefaultPageLayout>
  );
}

export default AnalyticsAndReports;