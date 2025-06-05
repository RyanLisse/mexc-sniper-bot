// Temporarily disabled Inngest route due to environment variable parsing issues
// The Inngest library is trying to parse malformed URLs from environment variables

export async function GET() {
  return new Response(JSON.stringify({ 
    status: "disabled", 
    message: "Inngest temporarily disabled - environment configuration issue",
    issue: "URL parsing error in Inngest library with malformed env vars"
  }), {
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST() {
  return new Response(JSON.stringify({ 
    status: "disabled", 
    message: "Inngest temporarily disabled" 
  }), {
    headers: { "Content-Type": "application/json" },
  });
}

export async function PUT() {
  return new Response(JSON.stringify({ 
    status: "disabled", 
    message: "Inngest temporarily disabled" 
  }), {
    headers: { "Content-Type": "application/json" },
  });
}