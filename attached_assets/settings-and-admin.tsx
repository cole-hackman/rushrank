import React from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { IconButton } from "@/components/ui/icon-button";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/ui/switch";
import { Table } from "@/components/ui/table";
import { TextField } from "@/components/ui/text-field";
import { ToggleGroup } from "@/components/ui/ui/toggle-group";
import { DefaultPageLayout } from "@/components/layouts/DefaultPageLayout";
import { FeatherEdit2 } from "@subframe/core";
import { FeatherGripVertical } from "@subframe/core";
import { FeatherPlus } from "@subframe/core";
import { FeatherTrash } from "@subframe/core";
import { FeatherUserPlus } from "@subframe/core";

<DefaultPageLayout>
  <div className="flex h-full w-full flex-col items-start gap-6 bg-default-background px-6 py-6">
    <div className="flex w-full flex-col items-start">
      <Breadcrumbs>
        <Breadcrumbs.Item>Home</Breadcrumbs.Item>
        <Breadcrumbs.Divider />
        <Breadcrumbs.Item active={true}>Settings</Breadcrumbs.Item>
      </Breadcrumbs>
    </div>
    <div className="flex w-full items-center justify-between">
      <div className="flex flex-col items-start gap-1">
        <span className="text-heading-1 font-heading-1 text-default-font">
          Settings &amp; Administration
        </span>
        <span className="text-body font-body text-subtext-color">
          Manage round configuration, users, tags, and custom questionnaires
        </span>
      </div>
    </div>
    <div className="flex w-full flex-col items-start gap-6">
      <ToggleGroup value="" onValueChange={(value: string) => {}}>
        <ToggleGroup.Item icon={null} value="798fd770">
          Round Configuration
        </ToggleGroup.Item>
        <ToggleGroup.Item icon={null} value="41ca98ec">
          User Management
        </ToggleGroup.Item>
        <ToggleGroup.Item icon={null} value="a2f9c046">
          Tag Management
        </ToggleGroup.Item>
        <ToggleGroup.Item icon={null} value="550df47e">
          Questionnaire Builder
        </ToggleGroup.Item>
      </ToggleGroup>
      <div className="flex w-full flex-col items-start gap-8 rounded-md border border-solid border-neutral-border bg-white px-8 py-8 shadow-sm">
        <div className="flex w-full flex-col items-start gap-6">
          <div className="flex w-full items-center justify-between">
            <div className="flex flex-col items-start gap-1">
              <span className="text-heading-2 font-heading-2 text-default-font">
                Round Configuration
              </span>
              <span className="text-body font-body text-subtext-color">
                Configure voting behavior and round settings
              </span>
            </div>
          </div>
          <div className="flex h-px w-full flex-none flex-col items-center gap-2 bg-neutral-border" />
          <div className="flex w-full flex-col items-start gap-6">
            <div className="flex w-full items-center justify-between rounded-md border border-solid border-neutral-border bg-neutral-50 px-6 py-4">
              <div className="flex flex-col items-start gap-1">
                <span className="text-body-bold font-body-bold text-default-font">
                  Anonymous Voting
                </span>
                <span className="text-caption font-caption text-subtext-color">
                  Hide voter names from results and other brothers
                </span>
              </div>
              <Switch
                checked={false}
                onCheckedChange={(checked: boolean) => {}}
              />
            </div>
            <div className="flex w-full items-center justify-between rounded-md border border-solid border-neutral-border bg-neutral-50 px-6 py-4">
              <div className="flex flex-col items-start gap-1">
                <span className="text-body-bold font-body-bold text-default-font">
                  Swipe Mode
                </span>
                <span className="text-caption font-caption text-subtext-color">
                  Enable Tinder-style swipe voting interface
                </span>
              </div>
              <Switch
                checked={false}
                onCheckedChange={(checked: boolean) => {}}
              />
            </div>
            <div className="flex w-full flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-neutral-50 px-6 py-4">
              <div className="flex w-full items-center justify-between">
                <div className="flex flex-col items-start gap-1">
                  <span className="text-body-bold font-body-bold text-default-font">
                    Executive Vote Weight
                  </span>
                  <span className="text-caption font-caption text-subtext-color">
                    Multiplier for executive committee member votes
                  </span>
                </div>
                <span className="text-heading-2 font-heading-2 text-[#162238ff]">
                  2.0x
                </span>
              </div>
              <Progress value={66} />
            </div>
            <div className="flex w-full items-start gap-4 flex-wrap">
              <TextField
                className="min-w-[240px] flex-1"
                label="Voting Timer (minutes)"
                helpText="Time limit per PNM during live sessions"
              >
                <TextField.Input
                  placeholder="5"
                  value=""
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {}}
                />
              </TextField>
              <TextField
                className="min-w-[240px] flex-1"
                label="Round Lock Delay (hours)"
                helpText="Hours before round auto-locks"
              >
                <TextField.Input
                  placeholder="48"
                  value=""
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {}}
                />
              </TextField>
            </div>
          </div>
          <div className="flex w-full items-center justify-end gap-2">
            <Button
              variant="neutral-secondary"
              onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
            >
              Reset to Defaults
            </Button>
            <Button
              onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
            >
              Save Changes
            </Button>
          </div>
        </div>
        <div className="flex h-px w-full flex-none flex-col items-center gap-2 bg-neutral-border" />
        <div className="flex w-full flex-col items-start gap-6">
          <div className="flex w-full items-center justify-between">
            <div className="flex flex-col items-start gap-1">
              <span className="text-heading-2 font-heading-2 text-default-font">
                User Management
              </span>
              <span className="text-body font-body text-subtext-color">
                Manage brother accounts, roles, and permissions
              </span>
            </div>
            <Button
              icon={<FeatherUserPlus />}
              onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
            >
              Invite Member
            </Button>
          </div>
          <div className="flex h-px w-full flex-none flex-col items-center gap-2 bg-neutral-border" />
          <div className="flex w-full flex-col items-start gap-2 rounded-md border border-solid border-neutral-border shadow-sm">
            <Table
              header={
                <Table.HeaderRow>
                  <Table.HeaderCell>Name</Table.HeaderCell>
                  <Table.HeaderCell>Email</Table.HeaderCell>
                  <Table.HeaderCell>Role</Table.HeaderCell>
                  <Table.HeaderCell>Status</Table.HeaderCell>
                  <Table.HeaderCell>Actions</Table.HeaderCell>
                </Table.HeaderRow>
              }
            >
              <Table.Row>
                <Table.Cell>
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[#162238ff] text-caption-bold font-caption-bold text-white" />
                    <span className="text-body-bold font-body-bold text-default-font">
                      John Doe
                    </span>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <span className="text-body font-body text-subtext-color">
                    john.doe@example.com
                  </span>
                </Table.Cell>
                <Table.Cell>
                  <Badge>Admin</Badge>
                </Table.Cell>
                <Table.Cell>
                  <Badge variant="success">Active</Badge>
                </Table.Cell>
                <Table.Cell>
                  <div className="flex items-center gap-2">
                    <IconButton
                      size="small"
                      icon={<FeatherEdit2 />}
                      onClick={(
                        event: React.MouseEvent<HTMLButtonElement>
                      ) => {}}
                    />
                    <IconButton
                      size="small"
                      icon={<FeatherTrash />}
                      onClick={(
                        event: React.MouseEvent<HTMLButtonElement>
                      ) => {}}
                    />
                  </div>
                </Table.Cell>
              </Table.Row>
              <Table.Row>
                <Table.Cell>
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[#162238ff] text-caption-bold font-caption-bold text-white" />
                    <span className="text-body-bold font-body-bold text-default-font">
                      Mike Smith
                    </span>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <span className="text-body font-body text-subtext-color">
                    mike.smith@example.com
                  </span>
                </Table.Cell>
                <Table.Cell>
                  <Badge variant="warning">Executive</Badge>
                </Table.Cell>
                <Table.Cell>
                  <Badge variant="success">Active</Badge>
                </Table.Cell>
                <Table.Cell>
                  <div className="flex items-center gap-2">
                    <IconButton
                      size="small"
                      icon={<FeatherEdit2 />}
                      onClick={(
                        event: React.MouseEvent<HTMLButtonElement>
                      ) => {}}
                    />
                    <IconButton
                      size="small"
                      icon={<FeatherTrash />}
                      onClick={(
                        event: React.MouseEvent<HTMLButtonElement>
                      ) => {}}
                    />
                  </div>
                </Table.Cell>
              </Table.Row>
              <Table.Row>
                <Table.Cell>
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[#162238ff] text-caption-bold font-caption-bold text-white" />
                    <span className="text-body-bold font-body-bold text-default-font">
                      Tom Johnson
                    </span>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <span className="text-body font-body text-subtext-color">
                    tom.johnson@example.com
                  </span>
                </Table.Cell>
                <Table.Cell>
                  <Badge variant="neutral">Brother</Badge>
                </Table.Cell>
                <Table.Cell>
                  <Badge variant="success">Active</Badge>
                </Table.Cell>
                <Table.Cell>
                  <div className="flex items-center gap-2">
                    <IconButton
                      size="small"
                      icon={<FeatherEdit2 />}
                      onClick={(
                        event: React.MouseEvent<HTMLButtonElement>
                      ) => {}}
                    />
                    <IconButton
                      size="small"
                      icon={<FeatherTrash />}
                      onClick={(
                        event: React.MouseEvent<HTMLButtonElement>
                      ) => {}}
                    />
                  </div>
                </Table.Cell>
              </Table.Row>
              <Table.Row>
                <Table.Cell>
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[#162238ff] text-caption-bold font-caption-bold text-white" />
                    <span className="text-body-bold font-body-bold text-default-font">
                      Ryan Williams
                    </span>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <span className="text-body font-body text-subtext-color">
                    ryan.williams@example.com
                  </span>
                </Table.Cell>
                <Table.Cell>
                  <Badge variant="neutral">Brother</Badge>
                </Table.Cell>
                <Table.Cell>
                  <Badge variant="neutral">Pending</Badge>
                </Table.Cell>
                <Table.Cell>
                  <div className="flex items-center gap-2">
                    <IconButton
                      size="small"
                      icon={<FeatherEdit2 />}
                      onClick={(
                        event: React.MouseEvent<HTMLButtonElement>
                      ) => {}}
                    />
                    <IconButton
                      size="small"
                      icon={<FeatherTrash />}
                      onClick={(
                        event: React.MouseEvent<HTMLButtonElement>
                      ) => {}}
                    />
                  </div>
                </Table.Cell>
              </Table.Row>
            </Table>
          </div>
        </div>
        <div className="flex h-px w-full flex-none flex-col items-center gap-2 bg-neutral-border" />
        <div className="flex w-full flex-col items-start gap-6">
          <div className="flex w-full items-center justify-between">
            <div className="flex flex-col items-start gap-1">
              <span className="text-heading-2 font-heading-2 text-default-font">
                Tag Management
              </span>
              <span className="text-body font-body text-subtext-color">
                Create and manage tags for categorizing PNMs
              </span>
            </div>
            <Button
              icon={<FeatherPlus />}
              onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
            >
              New Tag
            </Button>
          </div>
          <div className="flex h-px w-full flex-none flex-col items-center gap-2 bg-neutral-border" />
          <div className="flex w-full items-start gap-3 flex-wrap">
            <div className="flex items-center gap-2 rounded-md border border-solid border-neutral-border bg-white px-4 py-3">
              <div className="flex h-4 w-4 flex-none items-start rounded-full bg-[#162238ff]" />
              <span className="text-body-bold font-body-bold text-default-font">
                Top Choice
              </span>
              <div className="flex items-center gap-1">
                <IconButton
                  size="small"
                  icon={<FeatherEdit2 />}
                  onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
                />
                <IconButton
                  size="small"
                  icon={<FeatherTrash />}
                  onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
                />
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-md border border-solid border-neutral-border bg-white px-4 py-3">
              <div className="flex h-4 w-4 flex-none items-start rounded-full bg-[#10b981ff]" />
              <span className="text-body-bold font-body-bold text-default-font">
                Strong Fit
              </span>
              <div className="flex items-center gap-1">
                <IconButton
                  size="small"
                  icon={<FeatherEdit2 />}
                  onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
                />
                <IconButton
                  size="small"
                  icon={<FeatherTrash />}
                  onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
                />
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-md border border-solid border-neutral-border bg-white px-4 py-3">
              <div className="flex h-4 w-4 flex-none items-start rounded-full bg-[#f59e0bff]" />
              <span className="text-body-bold font-body-bold text-default-font">
                Legacy
              </span>
              <div className="flex items-center gap-1">
                <IconButton
                  size="small"
                  icon={<FeatherEdit2 />}
                  onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
                />
                <IconButton
                  size="small"
                  icon={<FeatherTrash />}
                  onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
                />
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-md border border-solid border-neutral-border bg-white px-4 py-3">
              <div className="flex h-4 w-4 flex-none items-start rounded-full bg-[#ef4444ff]" />
              <span className="text-body-bold font-body-bold text-default-font">
                On the Fence
              </span>
              <div className="flex items-center gap-1">
                <IconButton
                  size="small"
                  icon={<FeatherEdit2 />}
                  onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
                />
                <IconButton
                  size="small"
                  icon={<FeatherTrash />}
                  onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
                />
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-md border border-solid border-neutral-border bg-white px-4 py-3">
              <div className="flex h-4 w-4 flex-none items-start rounded-full bg-[#8b5cf6ff]" />
              <span className="text-body-bold font-body-bold text-default-font">
                Athlete
              </span>
              <div className="flex items-center gap-1">
                <IconButton
                  size="small"
                  icon={<FeatherEdit2 />}
                  onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
                />
                <IconButton
                  size="small"
                  icon={<FeatherTrash />}
                  onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
                />
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-md border border-solid border-neutral-border bg-white px-4 py-3">
              <div className="flex h-4 w-4 flex-none items-start rounded-full bg-[#06b6d4ff]" />
              <span className="text-body-bold font-body-bold text-default-font">
                Engineer
              </span>
              <div className="flex items-center gap-1">
                <IconButton
                  size="small"
                  icon={<FeatherEdit2 />}
                  onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
                />
                <IconButton
                  size="small"
                  icon={<FeatherTrash />}
                  onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
                />
              </div>
            </div>
          </div>
          <div className="flex w-full flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-neutral-50 px-6 py-6">
            <span className="text-body-bold font-body-bold text-default-font">
              Create New Tag
            </span>
            <div className="flex w-full items-end gap-4 flex-wrap">
              <TextField
                className="min-w-[240px] flex-1"
                label="Tag Name"
                helpText=""
              >
                <TextField.Input
                  placeholder="Enter tag name"
                  value=""
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {}}
                />
              </TextField>
              <div className="flex flex-col items-start gap-2">
                <span className="text-caption-bold font-caption-bold text-default-font">
                  Color
                </span>
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 flex-none items-start rounded-md border border-solid border-neutral-border bg-[#162238ff] cursor-pointer" />
                  <div className="flex h-10 w-10 flex-none items-start rounded-md border border-solid border-neutral-border bg-[#10b981ff] cursor-pointer" />
                  <div className="flex h-10 w-10 flex-none items-start rounded-md border border-solid border-neutral-border bg-[#f59e0bff] cursor-pointer" />
                  <div className="flex h-10 w-10 flex-none items-start rounded-md border border-solid border-neutral-border bg-[#ef4444ff] cursor-pointer" />
                  <div className="flex h-10 w-10 flex-none items-start rounded-md border border-solid border-neutral-border bg-[#8b5cf6ff] cursor-pointer" />
                </div>
              </div>
              <Button
                onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
              >
                Create Tag
              </Button>
            </div>
          </div>
        </div>
        <div className="flex h-px w-full flex-none flex-col items-center gap-2 bg-neutral-border" />
        <div className="flex w-full flex-col items-start gap-6">
          <div className="flex w-full items-center justify-between">
            <div className="flex flex-col items-start gap-1">
              <span className="text-heading-2 font-heading-2 text-default-font">
                Questionnaire Builder
              </span>
              <span className="text-body font-body text-subtext-color">
                Customize intake form questions for PNMs
              </span>
            </div>
            <Button
              icon={<FeatherPlus />}
              onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
            >
              Add Question
            </Button>
          </div>
          <div className="flex h-px w-full flex-none flex-col items-center gap-2 bg-neutral-border" />
          <div className="flex w-full flex-col items-start gap-3">
            <div className="flex w-full items-center gap-4 rounded-md border border-solid border-neutral-border bg-white px-6 py-4">
              <FeatherGripVertical className="text-heading-3 font-heading-3 text-subtext-color" />
              <div className="flex grow shrink-0 basis-0 flex-col items-start gap-1">
                <span className="text-body-bold font-body-bold text-default-font">
                  What is your major?
                </span>
                <span className="text-caption font-caption text-subtext-color">
                  Text input • Required
                </span>
              </div>
              <div className="flex items-center gap-1">
                <IconButton
                  size="small"
                  icon={<FeatherEdit2 />}
                  onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
                />
                <IconButton
                  size="small"
                  icon={<FeatherTrash />}
                  onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
                />
              </div>
            </div>
            <div className="flex w-full items-center gap-4 rounded-md border border-solid border-neutral-border bg-white px-6 py-4">
              <FeatherGripVertical className="text-heading-3 font-heading-3 text-subtext-color" />
              <div className="flex grow shrink-0 basis-0 flex-col items-start gap-1">
                <span className="text-body-bold font-body-bold text-default-font">
                  What year are you?
                </span>
                <span className="text-caption font-caption text-subtext-color">
                  Dropdown • Required
                </span>
              </div>
              <div className="flex items-center gap-1">
                <IconButton
                  size="small"
                  icon={<FeatherEdit2 />}
                  onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
                />
                <IconButton
                  size="small"
                  icon={<FeatherTrash />}
                  onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
                />
              </div>
            </div>
            <div className="flex w-full items-center gap-4 rounded-md border border-solid border-neutral-border bg-white px-6 py-4">
              <FeatherGripVertical className="text-heading-3 font-heading-3 text-subtext-color" />
              <div className="flex grow shrink-0 basis-0 flex-col items-start gap-1">
                <span className="text-body-bold font-body-bold text-default-font">
                  Tell us about yourself
                </span>
                <span className="text-caption font-caption text-subtext-color">
                  Long text • Optional
                </span>
              </div>
              <div className="flex items-center gap-1">
                <IconButton
                  size="small"
                  icon={<FeatherEdit2 />}
                  onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
                />
                <IconButton
                  size="small"
                  icon={<FeatherTrash />}
                  onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
                />
              </div>
            </div>
            <div className="flex w-full items-center gap-4 rounded-md border border-solid border-neutral-border bg-white px-6 py-4">
              <FeatherGripVertical className="text-heading-3 font-heading-3 text-subtext-color" />
              <div className="flex grow shrink-0 basis-0 flex-col items-start gap-1">
                <span className="text-body-bold font-body-bold text-default-font">
                  Are you interested in intramural sports?
                </span>
                <span className="text-caption font-caption text-subtext-color">
                  Yes/No • Optional
                </span>
              </div>
              <div className="flex items-center gap-1">
                <IconButton
                  size="small"
                  icon={<FeatherEdit2 />}
                  onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
                />
                <IconButton
                  size="small"
                  icon={<FeatherTrash />}
                  onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
                />
              </div>
            </div>
          </div>
          <div className="flex w-full flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-neutral-50 px-6 py-6">
            <span className="text-body-bold font-body-bold text-default-font">
              Add New Question
            </span>
            <div className="flex w-full items-start gap-4 flex-wrap">
              <TextField
                className="min-w-[320px] flex-1"
                label="Question Text"
                helpText=""
              >
                <TextField.Input
                  placeholder="Enter your question"
                  value=""
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {}}
                />
              </TextField>
              <TextField
                className="h-auto w-auto max-w-[240px] flex-none"
                label="Field Type"
                helpText=""
              >
                <TextField.Input
                  placeholder="Text input"
                  value=""
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {}}
                />
              </TextField>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                label="Required field"
                checked={false}
                onCheckedChange={(checked: boolean) => {}}
              />
            </div>
            <div className="flex w-full items-center justify-end gap-2">
              <Button
                variant="neutral-secondary"
                onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
              >
                Cancel
              </Button>
              <Button
                onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
              >
                Add Question
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</DefaultPageLayout>