// API endpoint for forgot password functionality
export async function POST({ request }: { request: Request }) {
  try {
    const { email } = await request.json();

    if (!email || !email.trim()) {
      return new Response(
        JSON.stringify({ error: 'Email address is required' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Get admin email from environment variables
    const adminEmail = import.meta.env.ADMIN_EMAIL || 'admin@university.edu';
    
    // Send email to admin (you'll need to configure email service)
    console.log('Password reset request for:', email);
    console.log('Admin email:', adminEmail);
    
    // For now, just log the request - in production, you'd integrate with email service
    // TODO: Configure email service (SendGrid, Resend, Nodemailer, etc.)
    
    return new Response(
      JSON.stringify({ 
        message: 'Password reset request received. Administrator will contact you.',
        email: email 
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error in forgot password API:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Handle other HTTP methods
export async function GET() {
  return new Response(
    JSON.stringify({ error: 'Method not allowed' }),
    { 
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}
