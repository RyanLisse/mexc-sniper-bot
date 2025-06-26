import { handleAuth } from "@kinde-oss/kinde-auth-nextjs/server";
import { getCookieConfig } from "@/src/lib/security-config";

// Configure cookie settings based on environment
const cookieConfig = getCookieConfig();

export const GET = handleAuth({
  // Use environment-specific cookie configuration
  cookies: {
    httpOnly: cookieConfig.httpOnly,
    secure: cookieConfig.secure,
    sameSite: cookieConfig.sameSite,
    maxAge: cookieConfig.maxAge,
  },
});
