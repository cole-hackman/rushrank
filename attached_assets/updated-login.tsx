"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { FeatherUsers } from "@subframe/core";

function RushRankLogin() {
  return (
    <div className="flex w-full flex-col items-center justify-center bg-neutral-50 h-screen">
      <div className="flex w-full max-w-[384px] flex-col items-center gap-8 rounded-md border border-solid border-neutral-border bg-white px-12 py-12 shadow-md">
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 flex-none items-center justify-center rounded-md bg-[#162238ff]">
            <FeatherUsers className="text-heading-2 font-heading-2 text-white" />
          </div>
          <span className="text-heading-1 font-heading-1 text-default-font">
            RushRank
          </span>
          <span className="text-body font-body text-subtext-color text-center">
            Sign in to your account
          </span>
        </div>
        <div className="flex w-full flex-col items-start gap-6">
          <TextField
            className="h-auto w-full flex-none"
            label="Email"
            helpText=""
          >
            <TextField.Input
              placeholder="your.email@example.com"
              value=""
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => {}}
            />
          </TextField>
          <TextField
            className="h-auto w-full flex-none"
            label="Password"
            helpText=""
          >
            <TextField.Input
              type="password"
              placeholder="Enter your password"
              value=""
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => {}}
            />
          </TextField>
        </div>
        <div className="flex w-full flex-col items-center gap-3">
          <Button
            className="h-10 w-full flex-none"
            size="large"
            onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
          >
            Sign in
          </Button>
          <Button
            className="h-auto w-auto flex-none"
            variant="brand-tertiary"
            size="small"
            onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
          >
            Forgot password?
          </Button>
        </div>
        <span className="text-caption font-caption text-subtext-color">
          Beta Theta Pi • Cal Poly SLO
        </span>
      </div>
    </div>
  );
}

export default RushRankLogin;