// Next.js API Route Type Fixes
import { NextRequest } from 'next/server';

declare global {
  namespace App {
    interface PageProps {
      params: Promise<{ [key: string]: string | string[] | undefined }>;
      searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
    }
  }
}

// Fix for Next.js 15 API route parameter types
declare module 'next/server' {
  interface NextRequest {
    params?: Promise<{ [key: string]: string | string[] | undefined }>;
  }
}

export {};