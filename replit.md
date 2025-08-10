# RushRank - Digital Rush Voting Platform

## Overview

RushRank is a mobile-optimized web application designed to streamline fraternity rush voting processes. The platform provides a comprehensive digital solution for managing potential new members (PNMs), conducting real-time voting rounds, and analyzing results. Built as a Progressive Web App (PWA), it combines a React-based frontend with an Express.js backend, featuring real-time communication through WebSockets and secure file storage capabilities.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite for build tooling
- **UI Components**: Radix UI components with shadcn/ui design system
- **Styling**: Tailwind CSS with custom design tokens and CSS variables
- **State Management**: TanStack Query for server state management
- **Routing**: Wouter for client-side routing
- **Real-time Communication**: Custom WebSocket manager for live updates
- **Animations**: Framer Motion for swipe gestures and transitions
- **Mobile-First Design**: Responsive layout optimized for mobile devices

### Backend Architecture
- **Runtime**: Node.js with Express.js server framework
- **Language**: TypeScript with ES modules
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **Real-time Features**: WebSocket server using 'ws' library for live voting updates
- **File Storage**: Google Cloud Storage integration with ACL-based access control
- **API Design**: RESTful endpoints with JSON responses
- **Error Handling**: Centralized error middleware with structured responses

### Data Storage Solutions
- **Primary Database**: Neon serverless PostgreSQL database
- **Connection Pooling**: @neondatabase/serverless with connection pool management
- **Schema Management**: Drizzle migrations in /migrations directory
- **Object Storage**: Google Cloud Storage for photo uploads with custom ACL policies

### Authentication and Authorization
- **Session-based Authentication**: Temporary voter IDs stored in sessionStorage
- **Room-based Access Control**: 6-character room codes for joining voting rounds
- **Role-based Permissions**: Admin (Rush Chair) and Participant (Brother) roles
- **Object-level Security**: Custom ACL system for file access control

### Real-time Communication
- **WebSocket Integration**: Bidirectional communication for live voting updates
- **Room-based Broadcasting**: Messages scoped to specific voting rounds
- **Automatic Reconnection**: Client-side reconnection logic with exponential backoff
- **Message Types**: Round state updates, PNM changes, vote updates, and round completion

### Core Data Models
- **PNMs**: Comprehensive profiles with personal information, tags, and photo storage
- **Voting Rounds**: Session management with room codes, PNM selection, and state tracking
- **Votes**: Individual voting records with voter identification and favorite marking
- **Analytics**: Aggregated voting statistics and result calculations

### Mobile Optimization
- **Swipe Interface**: Touch-friendly card-based voting with gesture recognition
- **Progressive Web App**: Offline-capable with service worker support
- **Responsive Design**: Mobile-first CSS with desktop adaptations
- **Touch Interactions**: Optimized for mobile voting gestures and navigation

## External Dependencies

### Cloud Services
- **Neon Database**: Serverless PostgreSQL hosting with connection pooling
- **Google Cloud Storage**: Object storage for PNM photos with ACL management
- **Replit Infrastructure**: Development and deployment platform integration

### Third-party Libraries
- **UI Framework**: React ecosystem with TypeScript support
- **Component Library**: Radix UI primitives with shadcn/ui styling
- **File Uploads**: Uppy with AWS S3 integration for photo management
- **Form Handling**: React Hook Form with Zod validation
- **Animation Library**: Framer Motion for gesture-based interactions
- **Development Tools**: Vite build system with TypeScript configuration

### Development Dependencies
- **Build Tools**: Vite for frontend bundling, esbuild for server compilation
- **Database Tools**: Drizzle Kit for schema migrations and management
- **Type Safety**: TypeScript with strict configuration across frontend and backend
- **Code Quality**: PostCSS for CSS processing with Tailwind integration