"use client";
import * as React from "react";
import { Hexagon } from "lucide-react";

const avatarUrls = [
  "https://images.unsplash.com/photo-1502685104226-ee32379fefbe?w=64&h=64&fit=crop&crop=faces&auto=format",
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=64&h=64&fit=crop&crop=faces&auto=format",
  "https://images.unsplash.com/photo-1541534401786-2077eed87a72?w=64&h=64&fit=crop&crop=faces&auto=format",
  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=64&h=64&fit=crop&crop=faces&auto=format",
];

const SignIn1: React.FC = () => {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");

  const validateEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const handleSignIn = () => {
    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }
    if (!validateEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    setError("");
    alert("Sign in successful! (Demo)");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#121212] relative overflow-hidden w-full rounded-xl">
      <div className="relative z-10 w-full max-w-sm rounded-3xl bg-gradient-to-r from-[#ffffff10] to-[#121212] backdrop-blur-sm shadow-2xl p-8 flex flex-col items-center">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-white/20 mb-6 shadow-lg">
          <Hexagon className="w-6 h-6 text-white" />
        </div>
        <h2 className="text-2xl font-semibold text-white mb-6 text-center">HextaUI</h2>
        <div className="flex flex-col w-full gap-4">
          <div className="w-full flex flex-col gap-3">
            <input
              placeholder="Email"
              type="email"
              value={email}
              className="w-full px-5 py-3 rounded-xl bg-white/10 text-white placeholder-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              placeholder="Password"
              type="password"
              value={password}
              className="w-full px-5 py-3 rounded-xl bg-white/10 text-white placeholder-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && <div className="text-sm text-red-400 text-left">{error}</div>}
          </div>
          <hr className="opacity-10" />
          <div>
            <button
              onClick={handleSignIn}
              className="w-full bg-white/10 text-white font-medium px-5 py-3 rounded-full shadow hover:bg-white/20 transition mb-3 text-sm"
            >
              Sign in
            </button>
            <button className="w-full flex items-center justify-center gap-2 bg-gradient-to-b from-[#232526] to-[#2d2e30] rounded-full px-5 py-3 font-medium text-white shadow hover:brightness-110 transition mb-2 text-sm">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 48 48"
                className="w-5 h-5"
              >
                <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.651,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12 s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24 s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
                <path fill="#FF3D00" d="M6.306,14.691l6.571,4.817C14.57,16.249,18.961,13,24,13c3.059,0,5.842,1.154,7.961,3.039 l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
                <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.197l-6.19-5.238C29.211,35.091,26.715,36,24,36 c-5.202,0-9.62-3.323-11.283-7.958l-6.485,5.004C9.55,39.556,16.227,44,24,44z"/>
                <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.793,2.236-2.231,4.166-4.094,5.565 c0.002-0.001,0.003-0.002,0.005-0.003l6.19,5.238C36.94,39.581,44,35,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
              </svg>
              Continue with Google
            </button>
            <div className="w-full text-center mt-2">
              <span className="text-xs text-gray-400">
                Don&apos;t have an account?{" "}
                <a href="#" className="underline text-white/80 hover:text-white">
                  Sign up, it&apos;s free!
                </a>
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="relative z-10 mt-12 flex flex-col items-center text-center">
        <p className="text-gray-400 text-sm mb-2">
          Join <span className="font-medium text-white">thousands</span> of developers who are already using HextaUI.
        </p>
        <div className="flex">
          {avatarUrls.map((src, idx) => (
            <img
              key={idx}
              src={src}
              alt="user"
              className="w-8 h-8 -ml-2 first:ml-0 rounded-full border-2 border-[#181824] object-cover"
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export { SignIn1 };


