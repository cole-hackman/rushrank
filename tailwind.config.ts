import type { Config } from "tailwindcss";

export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        display: ['Space Grotesk', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        serif: ["var(--font-serif)"],
        mono: ["var(--font-mono)"],
      },
      colors: {
        // RushRank unified design tokens
        rr: {
          bg: '#0e0e0f',           // page background
          surface: '#17181a',      // cards, panels
          border: 'rgba(255,255,255,.08)',
          text: '#ffffff',
          muted: 'rgba(255,255,255,.70)',
          accent: '#ff7a18',       // orange accent
          accentDark: '#ff5418',   // darker orange
          accentFaint: 'rgba(255,122,24,.15)',
        },
        brand: {
          50:  '#eef6ff',
          100: '#d9ebff',
          200: '#b6d5ff',
          300: '#8fbaff',
          400: '#5f97ff',
          500: '#3a76ff',    // primary
          600: '#285adb',
          700: '#2048ad',
          800: '#1d3c8a',
          900: '#182f6b',
        },
        accent: {
          500: '#ff7a18', // mid orange
          600: '#ff5418', // darker orange
        },
      },
      extend: {
        borderRadius: {
          md: '12px',
          lg: '18px', 
          xl: '22px'
        },
        boxShadow: {
          rr: '0 10px 30px rgba(0,0,0,.35)',
          rrGlow: '0 0 0 1px rgba(255,255,255,.06), 0 8px 24px rgba(0,0,0,.35)'
        },
      },
        surface: {
          DEFAULT: 'var(--surface)',
          muted: 'var(--surface-muted)',
        },
        text: {
          DEFAULT: 'var(--text)',
          muted: 'var(--text-muted)',
        },
        ring: {
          DEFAULT: 'var(--ring)',
        },
        
        // Legacy tokens for compatibility
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accentLegacy: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        border: "var(--border)",
        input: "var(--input)",
        chart: {
          "1": "var(--chart-1)",
          "2": "var(--chart-2)",
          "3": "var(--chart-3)",
          "4": "var(--chart-4)",
          "5": "var(--chart-5)",
        },
        sidebar: {
          DEFAULT: "var(--sidebar-background)",
          foreground: "var(--sidebar-foreground)",
          primary: "var(--sidebar-primary)",
          "primary-foreground": "var(--sidebar-primary-foreground)",
          accent: "var(--sidebar-accent)",
          "accent-foreground": "var(--sidebar-accent-foreground)",
          border: "var(--sidebar-border)",
          ring: "var(--sidebar-ring)",
        },
      },

      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
