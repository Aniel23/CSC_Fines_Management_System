import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { name, email, message, adminEmail } = await req.json();

    if (!RESEND_API_KEY) {
      console.error("Missing RESEND_API_KEY environment variable");
      return new Response(JSON.stringify({ error: "Missing API Key" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    // Use RESEND_FROM_EMAIL if available, otherwise default to onboarding@resend.dev
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";
    
    let toEmail = "lestermadrigal870@gmail.com"; 
    
    console.log(`Sending email from ${fromEmail} to ${toEmail}`);

    const emailPayload = {
        from: fromEmail,
        to: [toEmail],
        subject: `Contact Message: ${name}`,
        html: `
          <h3>New Message</h3>
          <p><strong>From:</strong> ${name} (${email})</p>
          <p><strong>Message:</strong></p>
          <pre>${message}</pre>
        `,
      };

    let res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify(emailPayload),
    });

    let data = await res.json();
    
    // Auto-Fallback Logic for Testing Mode Restrictions
    if (!res.ok && res.status === 403) {
        // Check if error is about "only send testing emails to your own email address"
        // Example: "You can only send testing emails to your own email address (jhendel190@gmail.com)..."
        const errorMessage = data.message || "";
        const match = errorMessage.match(/address \(([^)]+)\)/);
        
        if (match && match[1]) {
            const allowedEmail = match[1];
            console.warn(`Resend restricted recipient. Retrying with allowed email: ${allowedEmail}`);
            
            // Retry with the allowed email
            emailPayload.to = [allowedEmail];
            
            res = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${RESEND_API_KEY}`,
                },
                body: JSON.stringify(emailPayload),
            });
            
            data = await res.json();
        }
    }

    if (!res.ok) {
      console.error("Resend API Error:", data);
      return new Response(JSON.stringify({ error: data, message: "Failed to send email via Resend" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: res.status,
      });
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
};

serve(handler);
