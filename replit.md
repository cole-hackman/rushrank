# RushRank - Digital Rush Voting Platform

## Overview

RushRank is a mobile-optimized web application designed to streamline fraternity rush voting processes. The platform provides a comprehensive digital solution for managing potential new members (PNMs), conducting real-time voting rounds, and analyzing results. Built as a Progressive Web App (PWA), it combines a React-based frontend with a FastAPI backend, featuring Supabase authentication, multi-tenant architecture, and secure file storage capabilities.

## Recent Changes (January 2025)

### FastAPI Migration Complete
- **Backend Migration**: Successfully migrated from Express.js to FastAPI with Python 3.11
- **Authentication**: Integrated Supabase JWT authentication with JWKS verification
- **Multi-tenancy**: Implemented chapter-based data isolation with Row-Level Security
- **Enhanced Schema**: Added users, chapters, memberships, events, and notes tables
- **Security**: Comprehensive RLS policies for data protection and access control
- **API Testing**: All endpoints tested and working with Pydantic models

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
- **Runtime**: FastAPI with Python 3.11 (migrated from Express.js)
- **Language**: Python with async/await support
- **Database**: AsyncPG with PostgreSQL connection pooling
- **Authentication**: Supabase JWT verification with JWKS validation
- **Real-time Features**: WebSocket server using 'ws' library for live voting updates (to be migrated)
- **File Storage**: Google Cloud Storage integration with ACL-based access control
- **API Design**: RESTful FastAPI endpoints with Pydantic models
- **Error Handling**: FastAPI exception handlers with structured responses
- **Multi-tenancy**: Chapter-based data isolation with Row-Level Security

### Data Storage Solutions
- **Primary Database**: Neon serverless PostgreSQL database (Supabase-compatible)
- **Connection Pooling**: AsyncPG with connection pool management
- **Schema Management**: SQL migrations in /supabase directory with RLS policies
- **Object Storage**: Google Cloud Storage for photo uploads with custom ACL policies
- **Multi-tenancy**: Chapter-based data isolation with memberships table

### Authentication and Authorization
- **Supabase Authentication**: JWT-based auth with magic link/email OTP
- **JWT Verification**: Server-side validation against Supabase JWKS endpoint
- **Multi-tenant Access**: Chapter-based memberships with admin/member/observer roles
- **Row-Level Security**: Comprehensive RLS policies for data isolation
- **Room-based Access Control**: 6-character room codes for joining voting rounds
- **Object-level Security**: Custom ACL system for file access control

### Real-time Communication
- **WebSocket Integration**: Bidirectional communication for live voting updates
- **Room-based Broadcasting**: Messages scoped to specific voting rounds
- **Automatic Reconnection**: Client-side reconnection logic with exponential backoff
- **Message Types**: Round state updates, PNM changes, vote updates, and round completion

### Core Data Models
- **Users**: Supabase auth users mirrored in application database
- **Chapters**: Organizations/fraternities with domain allowlists
- **Memberships**: User-chapter relationships with role-based access
- **PNMs**: Comprehensive profiles with personal information, tags, and photo storage
- **Voting Rounds**: Session management with room codes, PNM selection, and state tracking  
- **Votes**: Individual voting records with authenticated voter IDs and scoring
- **Events**: Rush events with attendance tracking capabilities
- **Notes**: Per-PNM notes with author tracking and tag system
- **Analytics**: Aggregated voting statistics and result calculations

### Mobile Optimization
- **Swipe Interface**: Touch-friendly card-based voting with gesture recognition
- **Progressive Web App**: Offline-capable with service worker support
- **Responsive Design**: Mobile-first CSS with desktop adaptations
- **Touch Interactions**: Optimized for mobile voting gestures and navigation

## External Dependencies

### Cloud Services
- **Supabase**: Authentication service with JWT verification and user management
- **Neon Database**: Serverless PostgreSQL hosting with connection pooling
- **Google Cloud Storage**: Object storage for PNM photos with ACL management
- **Replit Infrastructure**: Development and deployment platform integration

### Backend Dependencies
- **FastAPI**: Modern Python web framework with async support
- **AsyncPG**: PostgreSQL async database driver with connection pooling
- **Pydantic**: Data validation and serialization with type hints
- **Python-JOSE**: JWT token verification library
- **Uvicorn**: ASGI server for FastAPI applications
- **HTTPX**: Async HTTP client for external API calls

### Frontend Dependencies
- **UI Framework**: React ecosystem with TypeScript support
- **Component Library**: Radix UI primitives with shadcn/ui styling
- **File Uploads**: Uppy with AWS S3 integration for photo management
- **Form Handling**: React Hook Form with Zod validation
- **Animation Library**: Framer Motion for gesture-based interactions
- **Development Tools**: Vite build system with TypeScript configuration

### Development Dependencies
- **Build Tools**: Vite for frontend bundling, Python packaging for backend
- **Database Tools**: SQL migrations for schema management with RLS
- **Type Safety**: TypeScript for frontend, Python type hints for backend
- **Testing**: Pytest for backend testing, React Testing Library for frontend