import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req: Request) => {
  // 1. Handle CORS preflight requests from the browser
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { email, code } = await req.json()

    // 2. Validate inputs
    if (!email || !code) {
      throw new Error("Missing email or code in the request body.")
    }

    // 3. Securely fetch the API Key from the environment
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")

    if (!RESEND_API_KEY) {
      throw new Error("Missing RESEND_API_KEY in environment variables. Run 'supabase secrets set RESEND_API_KEY=...'")
    }

    // 4. Dispatch the email via Resend
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "OSA FAGOS <onboarding@resend.dev>", // NOTE: Change to your verified domain later (e.g., noreply@cdm.edu.ph)
        to: [email],
        subject: `${code} is your OSA Verification Code`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px; background-color: #ffffff;">
            <div style="text-align: center; margin-bottom: 20px;">
              <h2 style="color: #333333; margin: 0;">Two-Step Verification</h2>
            </div>
            <p style="color: #555555; line-height: 1.5;">You requested to sign in to the OSA FAGOS portal. Please use the verification code below to complete your login:</p>
            <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 28px; font-weight: bold; letter-spacing: 8px; border-radius: 6px; margin: 25px 0; color: #111111;">
              ${code}
            </div>
            <p style="color: #777777; font-size: 13px; line-height: 1.4;">This code will expire in 5 minutes. If you did not request this code, please ignore this email or contact your system administrator.</p>
          </div>
        `,
      }),
    })

    // 5. Parse the exact response from Resend
    const resData = await res.json()

    // 6. Catch Resend-specific errors (e.g., Sandbox restrictions)
    if (!res.ok) {
      console.error("Resend API Error:", resData)
      throw new Error(resData.message || "Failed to send email via Resend.")
    }

    // 7. Success
    return new Response(JSON.stringify({ success: true, id: resData.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    })
    
  } catch (error) {
    // Log the error to the Supabase Dashboard for debugging
    console.error("Edge Function Error:", error.message)
    
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    })
  }
})