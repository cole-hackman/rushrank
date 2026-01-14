import { fontFamily } from "tailwindcss/defaultTheme";
import type { Config } from "tailwindcss";

const config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./ui/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Subframe theme colors
        brand: {
          50: "rgb(239, 246, 255)",
          100: "rgb(219, 234, 254)",
          200: "rgb(191, 219, 254)",
          300: "rgb(147, 197, 253)",
          400: "rgb(96, 165, 250)",
          500: "rgb(59, 130, 246)",
          600: "rgb(37, 99, 235)",
          700: "rgb(29, 78, 216)",
          800: "rgb(30, 64, 175)",
          900: "rgb(30, 58, 138)",
        },
        neutral: {
          0: "rgb(255, 255, 255)",
          50: "rgb(250, 250, 250)",
          100: "rgb(244, 244, 245)",
          200: "rgb(228, 228, 231)",
          300: "rgb(212, 212, 216)",
          400: "rgb(161, 161, 170)",
          500: "rgb(113, 113, 122)",
          600: "rgb(82, 82, 91)",
          700: "rgb(63, 63, 70)",
          800: "rgb(39, 39, 42)",
          900: "rgb(24, 24, 27)",
          950: "rgb(9, 9, 11)",
        },
        error: {
          50: "rgb(254, 242, 242)",
          100: "rgb(254, 226, 226)",
          200: "rgb(254, 202, 202)",
          300: "rgb(252, 165, 165)",
          400: "rgb(248, 113, 113)",
          500: "rgb(239, 68, 68)",
          600: "rgb(220, 38, 38)",
          700: "rgb(185, 28, 28)",
          800: "rgb(153, 27, 27)",
          900: "rgb(127, 29, 29)",
        },
        warning: {
          50: "rgb(245, 243, 255)",
          100: "rgb(237, 233, 254)",
          200: "rgb(221, 214, 254)",
          300: "rgb(196, 181, 253)",
          400: "rgb(167, 139, 250)",
          500: "rgb(139, 92, 246)",
          600: "rgb(124, 58, 237)",
          700: "rgb(109, 40, 217)",
          800: "rgb(91, 33, 182)",
          900: "rgb(76, 29, 149)",
        },
        success: {
          50: "rgb(236, 253, 245)",
          100: "rgb(209, 250, 229)",
          200: "rgb(167, 243, 208)",
          300: "rgb(110, 231, 183)",
          400: "rgb(52, 211, 153)",
          500: "rgb(16, 185, 129)",
          600: "rgb(5, 150, 105)",
          700: "rgb(4, 120, 87)",
          800: "rgb(6, 95, 70)",
          900: "rgb(6, 78, 59)",
        },
        "brand-primary": "rgb(37, 99, 235)",
        "default-font": "hsl(var(--foreground))",
        "subtext-color": "hsl(var(--muted-foreground))",
        "neutral-border": "hsl(var(--border))",
        white: "rgb(255, 255, 255)",
        "default-background": "hsl(var(--background))",
        // Legacy beta colors (keep for backward compatibility)
        beta: {
          navy: "#013068",
          gray: "#bebebe",
          surface: "#fefefe",
        },
        // shadcn/ui colors (keep for backward compatibility)
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      fontSize: {
        caption: [
          "12px",
          {
            lineHeight: "16px",
            fontWeight: "400",
            letterSpacing: "0em",
          },
        ],
        "caption-bold": [
          "12px",
          {
            lineHeight: "16px",
            fontWeight: "500",
            letterSpacing: "0em",
          },
        ],
        body: [
          "14px",
          {
            lineHeight: "20px",
            fontWeight: "400",
            letterSpacing: "0em",
          },
        ],
        "body-bold": [
          "14px",
          {
            lineHeight: "20px",
            fontWeight: "500",
            letterSpacing: "0em",
          },
        ],
        "heading-3": [
          "16px",
          {
            lineHeight: "20px",
            fontWeight: "500",
            letterSpacing: "0em",
          },
        ],
        "heading-2": [
          "20px",
          {
            lineHeight: "24px",
            fontWeight: "500",
            letterSpacing: "0em",
          },
        ],
        "heading-1": [
          "30px",
          {
            lineHeight: "36px",
            fontWeight: "500",
            letterSpacing: "0em",
          },
        ],
        "monospace-body": [
          "14px",
          {
            lineHeight: "20px",
            fontWeight: "400",
            letterSpacing: "0em",
          },
        ],
      },
      fontFamily: {
        caption: '"Work Sans"',
        "caption-bold": '"Work Sans"',
        body: '"Work Sans"',
        "body-bold": '"Work Sans"',
        "heading-3": '"Work Sans"',
        "heading-2": '"Work Sans"',
        "heading-1": '"Work Sans"',
        "monospace-body": "monospace",
        sans: ["Work Sans", "Inter", ...fontFamily.sans],
      },
      boxShadow: {
        sm: "0px 1px 2px 0px rgba(0, 0, 0, 0.05)",
        default: "0px 1px 2px 0px rgba(0, 0, 0, 0.05)",
        md: "0px 4px 16px -2px rgba(0, 0, 0, 0.08), 0px 2px 4px -1px rgba(0, 0, 0, 0.08)",
        lg: "0px 12px 32px -4px rgba(0, 0, 0, 0.08), 0px 4px 8px -2px rgba(0, 0, 0, 0.08)",
        overlay:
          "0px 12px 32px -4px rgba(0, 0, 0, 0.08), 0px 4px 8px -2px rgba(0, 0, 0, 0.08)",
      },
      borderRadius: {
        sm: "8px",
        md: "16px",
        DEFAULT: "16px",
        lg: "24px",
        full: "9999px",
        // Keep shadcn/ui radius vars for backward compatibility
        lgVar: "var(--radius)",
        mdVar: "calc(var(--radius) - 2px)",
        smVar: "calc(var(--radius) - 4px)",
      },
      screens: {
        mobile: {
          max: "767px",
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;

export default config;

