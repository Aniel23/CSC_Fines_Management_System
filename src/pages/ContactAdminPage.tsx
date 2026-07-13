import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, ArrowLeft, Send, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { PublicNavbar } from "@/components/layout/PublicNavbar";
import { supabase } from "@/integrations/supabase/client";
import { useAppSettings } from "@/hooks/useAppSettings";

export default function ContactAdminPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const navigate = useNavigate();
  const { settings } = useAppSettings();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !email.trim() || !message.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsLoading(true);
    
    try {
      // 1. Send contact message to Supabase Database
      const { error: dbError } = await supabase
        .from('contact_messages')
        .insert({
          name: name.trim(),
          email: email.trim(),
          message: message.trim(),
        });

      if (dbError) throw dbError;

      // 2. Trigger Edge Function to send email
      const { data, error: emailError } = await supabase.functions.invoke('send-contact-email', {
        body: {
          name: name.trim(),
          email: email.trim(),
          message: message.trim(),
          adminEmail: settings?.admin_email || "jhendel190@gmail.com" // Pass dynamic admin email
        },
      });

      if (emailError) {
        console.error("Failed to send email via Edge Function:", emailError);
        // Try to parse the error body if available
        if (emailError instanceof Error && 'context' in emailError) {
            const context = (emailError as any).context;
            if (context && typeof context.json === 'function') {
                 const errorBody = await context.json();
                 console.error("Edge Function Error Body:", errorBody);
                 
                 // Handle Resend specific error structure
                 let detailedError = "Unknown error";
                 if (errorBody.error && typeof errorBody.error === 'object') {
                   // If error is an object (like Resend often returns), try to extract message
                   detailedError = errorBody.error.message || JSON.stringify(errorBody.error);
                 } else if (typeof errorBody.error === 'string') {
                   detailedError = errorBody.error;
                 } else if (errorBody.message) {
                   detailedError = errorBody.message;
                 }
                 
                 toast.error(`Email sending failed: ${detailedError}`);
             }
         } else {
             toast.error("Email sending failed. Check console for details.");
        }
      } else {
          console.log("Email sent successfully:", data);
      }

      setIsSubmitted(true);
      toast.success("Message sent to administrator successfully");
    } catch (error: any) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message: " + (error.message || "Unknown error"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <PublicNavbar />
      <div className="container mx-auto px-4 py-24 max-w-2xl">
        {/* Back to Login */}
        <div className="mb-6">
          <Link to="/">
            <Button variant="outline" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Login
            </Button>
          </Link>
        </div>

        {/* Contact Form */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-center text-2xl">
              Contact Administrator
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {isSubmitted ? (
              <div className="text-center py-8">
                <CheckCircle className="h-16 w-16 text-success mx-auto mb-4" />
                <h2 className="text-2xl font-semibold mb-2">Message Sent!</h2>
                <p className="text-muted-foreground mb-6">
                  Your message has been sent to the administrator.
                </p>
                <p className="text-sm text-muted-foreground mb-6">
                  We will get back to you as soon as possible.
                </p>
                <Link to="/">
                  <Button variant="outline">
                    Back to Login
                  </Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="name" className="text-sm font-medium">
                    Your Name
                  </label>
                  <Input
                    id="name"
                    placeholder="Enter your full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium">
                    Your Email
                  </label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="message" className="text-sm font-medium">
                    Message
                  </label>
                  <textarea
                    id="message"
                    className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="How can we help you?"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                  />
                </div>
                
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>Sending...</>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" /> Send Message
                    </>
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
