// API endpoint for contacting administrator
export async function POST({ request }: { request: Request }) {
  try {
    const { name, email, message } = await request.json();

    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return new Response(
        JSON.stringify({ error: 'All fields are required' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Get admin email from environment variables
    const adminEmail = import.meta.env.ADMIN_EMAIL || 'admin@university.edu';
    
    // Send email to admin (you'll need to configure email service)
    console.log('Contact request from:', name, email);
    console.log('Message:', message);
    console.log('Admin email:', adminEmail);
    
    // For now, just log the request - in production, you'd integrate with email service
    // TODO: Configure email service (SendGrid, Resend, Nodemailer, etc.)
    
    return new Response(
      JSON.stringify({ 
        message: 'Contact message received. Administrator will respond to you.',
        name: name,
        email: email
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error in contact admin API:', error);
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
