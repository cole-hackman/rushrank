"use client";

import React from "react";
import { Avatar } from "@/ui/components/Avatar";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { IconButton } from "@/ui/components/IconButton";
import { Progress } from "@/ui/components/Progress";
import { DefaultPageLayout } from "@/ui/layouts/DefaultPageLayout";
import { 
  BarChart3, 
  Check, 
  Clock, 
  HelpCircle, 
  Lock, 
  Star, 
  Users, 
  X 
} from "lucide-react";

function RushRankVotingView() {
  return (
    <DefaultPageLayout>
      <div className="flex h-full w-full flex-col items-center bg-neutral-50 overflow-auto">
        <div className="flex w-full max-w-[1280px] grow shrink-0 basis-0 items-start gap-6 px-6 py-8 mobile:flex-col mobile:flex-nowrap mobile:gap-6">
          <div className="flex grow shrink-0 basis-0 flex-col items-center justify-center gap-6">
            <div className="flex w-full max-w-[448px] flex-col items-center gap-6">
              <div className="flex w-full items-center justify-between">
                <span className="text-2xl font-bold text-default-font">
                  Voting Session
                </span>
                <Badge>Round 1</Badge>
              </div>
              <div className="flex w-full flex-col items-center gap-4 overflow-hidden rounded-lg bg-default-background shadow-lg relative">
                <div className="flex w-full flex-col items-center relative">
                  <img
                    className="h-144 w-full flex-none object-cover mobile:h-112 mobile:w-full mobile:flex-none"
                    src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80"
                    alt="PNM"
                  />
                  <div className="flex items-start absolute inset-0 bg-gradient-to-t from-[#162238] via-transparent to-transparent opacity-60" />
                  <div className="flex flex-col items-start gap-3 px-6 py-6 absolute bottom-0 left-0 right-0">
                    <div className="flex w-full items-center gap-2">
                      <span className="text-3xl font-bold text-white">
                        Alex Johnson
                      </span>
                      <IconButton
                        variant="inverse"
                        size="large"
                        icon={<Star />}
                        onClick={(
                          event: React.MouseEvent<HTMLButtonElement>
                        ) => {}}
                      />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="neutral">Computer Science</Badge>
                      <Badge variant="neutral">San Diego, CA</Badge>
                      <Badge variant="neutral">Junior</Badge>
                    </div>
                    <span className="text-sm text-white">
                      Loves surfing, coding, and playing guitar. Looking to
                      build connections and grow as a leader.
                    </span>
                  </div>
                </div>
                <div className="flex w-full items-center justify-center gap-4 px-6 py-6">
                  <Button
                    variant="destructive-secondary"
                    size="large"
                    icon={<X />}
                    onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
                  >
                    No
                  </Button>
                  <Button
                    variant="neutral-secondary"
                    size="large"
                    icon={<HelpCircle />}
                    onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
                  >
                    Don&apos;t Know
                  </Button>
                  <Button
                    size="large"
                    icon={<Check />}
                    onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
                  >
                    Yes
                  </Button>
                </div>
              </div>
              <div className="flex w-full items-center justify-between">
                <span className="text-xs text-neutral-600">
                  Swipe right for Yes, left for No, up for Don&apos;t Know
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-default-font">
                    5 / 24
                  </span>
                  <Progress value={20} />
                </div>
              </div>
            </div>
          </div>
          <div className="flex w-80 flex-none flex-col items-start gap-6 mobile:h-auto mobile:w-full mobile:flex-none">
            <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-6 shadow-sm">
              <div className="flex w-full items-center gap-2">
                <Users className="text-xl text-[#162238ff]" />
                <span className="text-xl font-bold text-default-font">
                  Round Status
                </span>
              </div>
              <div className="flex h-px w-full flex-none flex-col items-center gap-2 bg-neutral-border" />
              <div className="flex w-full flex-col items-start gap-3">
                <div className="flex w-full items-center justify-between">
                  <span className="text-sm text-neutral-600">
                    Votes Collected
                  </span>
                  <span className="text-sm font-bold text-default-font">
                    8 / 12
                  </span>
                </div>
                <div className="flex w-full flex-col items-start gap-2">
                  <Progress value={66} />
                  <span className="text-xs text-neutral-600">
                    66% complete
                  </span>
                </div>
              </div>
              <div className="flex h-px w-full flex-none flex-col items-center gap-2 bg-neutral-border" />
              <div className="flex w-full flex-col items-start gap-3">
                <div className="flex w-full items-center justify-between">
                  <span className="text-sm text-neutral-600">
                    Status
                  </span>
                  <Badge variant="success">Active</Badge>
                </div>
                <div className="flex w-full items-center justify-between">
                  <span className="text-sm text-neutral-600">
                    Timer
                  </span>
                  <div className="flex items-center gap-1">
                    <Clock className="text-sm text-neutral-600" />
                    <span className="text-sm font-bold text-default-font">
                      2:45
                    </span>
                  </div>
                </div>
                <div className="flex w-full items-center justify-between">
                  <span className="text-sm text-neutral-600">
                    Voting Mode
                  </span>
                  <Badge variant="neutral">Swipe</Badge>
                </div>
              </div>
              <div className="flex h-px w-full flex-none flex-col items-center gap-2 bg-neutral-border" />
              <div className="flex w-full flex-col items-start gap-2">
                <span className="text-sm font-bold text-default-font">
                  Active Voters
                </span>
                <div className="flex w-full items-center gap-2 flex-wrap">
                  <Avatar
                    size="small"
                    image="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&q=80"
                  >
                    A
                  </Avatar>
                  <Avatar
                    size="small"
                    image="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=80"
                  >
                    B
                  </Avatar>
                  <Avatar
                    size="small"
                    image="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80"
                  >
                    C
                  </Avatar>
                  <Avatar
                    size="small"
                    image="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&q=80"
                  >
                    D
                  </Avatar>
                  <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-neutral-100">
                    <span className="text-xs font-bold text-neutral-600">
                      +4
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-6 shadow-sm">
              <div className="flex w-full items-center gap-2">
                <BarChart3 className="text-xl text-[#162238ff]" />
                <span className="text-xl font-bold text-default-font">
                  Your Progress
                </span>
              </div>
              <div className="flex h-px w-full flex-none flex-col items-center gap-2 bg-neutral-border" />
              <div className="flex w-full flex-col items-start gap-3">
                <div className="flex w-full items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Check className="text-sm text-green-600" />
                    <span className="text-sm text-neutral-600">
                      Yes
                    </span>
                  </div>
                  <span className="text-sm font-bold text-default-font">
                    3
                  </span>
                </div>
                <div className="flex w-full items-center justify-between">
                  <div className="flex items-center gap-2">
                    <X className="text-sm text-red-600" />
                    <span className="text-sm text-neutral-600">
                      No
                    </span>
                  </div>
                  <span className="text-sm font-bold text-default-font">
                    1
                  </span>
                </div>
                <div className="flex w-full items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="text-sm text-yellow-600" />
                    <span className="text-sm text-neutral-600">
                      Don&apos;t Know
                    </span>
                  </div>
                  <span className="text-sm font-bold text-default-font">
                    1
                  </span>
                </div>
                <div className="flex w-full items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Star className="text-sm text-blue-600" />
                    <span className="text-sm text-neutral-600">
                      Favorites
                    </span>
                  </div>
                  <span className="text-sm font-bold text-default-font">
                    2
                  </span>
                </div>
              </div>
            </div>
            <div className="flex w-full flex-col items-start gap-2 rounded-lg border border-solid border-neutral-border bg-[#162238ff] px-6 py-4">
              <div className="flex w-full items-center gap-2">
                <Lock className="text-sm text-white" />
                <span className="text-sm font-bold text-white">
                  Round will lock in 2:45
                </span>
              </div>
              <span className="text-xs text-neutral-300">
                Submit all votes before the Rush Chair locks the round
              </span>
            </div>
          </div>
        </div>
      </div>
    </DefaultPageLayout>
  );
}

export default RushRankVotingView;

