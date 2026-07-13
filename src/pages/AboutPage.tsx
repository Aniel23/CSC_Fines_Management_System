import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, ArrowLeft, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { getCSCOfficers } from "@/integrations/supabase/queries";
import { PublicNavbar } from "@/components/layout/PublicNavbar";

export default function AboutPage() {
  const { user } = useAuth();

  const { data: officers, isLoading, error } = useQuery({
    queryKey: ["csc_officers"],
    queryFn: getCSCOfficers,
  });

  if (error) {
    console.error("Error fetching officers:", error);
  }

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      {/* Background Watermark */}
      <img
        src="/csc-logo.png"
        alt="CSC Watermark"
        className="pointer-events-none select-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.05] dark:opacity-[0.08]"
        style={{ width: "min(70vmin, 600px)" }}
        onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/csc-logo.jpg'; }}
      />

      <PublicNavbar />

      <div className="flex-1 p-4 md:p-6 mt-20 relative z-10">
        <Link to={user ? (user?.role === 'admin' ? "/dashboard" : "/student-dashboard") : "/"} className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-6 w-fit">
          <ArrowLeft className="h-4 w-4" />
          {user ? "Back to Dashboard" : "Back to Login"}
        </Link>

        <div className="max-w-4xl mx-auto w-full">
          <div className="mb-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <h1 className="font-display text-3xl font-bold text-foreground">
              About CSC
            </h1>
            <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
              Meet the dedicated officers of the Central Student Council who work
              tirelessly to represent and serve the student body.
            </p>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {officers && officers.length > 0 ? (
                officers.map((officer) => (
                  <Card
                    key={officer.id}
                    className="card-elevated overflow-hidden group"
                  >
                    <div className="aspect-square relative overflow-hidden bg-muted">
                      {officer.photo_url ? (
                        <img
                          src={officer.photo_url}
                          alt={officer.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Users className="h-20 w-20 text-muted-foreground/50" />
                        </div>
                      )}
                    </div>
                    <CardContent className="p-6">
                      <h3 className="font-display font-semibold text-lg">
                        {officer.name}
                      </h3>
                      <p className="text-primary font-medium text-sm mb-2">
                        {officer.position}
                      </p>
                      {officer.description && (
                        <p className="text-sm text-muted-foreground">
                          {officer.description}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="col-span-full text-center py-12">
                  <p className="text-muted-foreground mb-4">No officers information available yet.</p>
                  {user?.role === 'admin' && (
                    <Link to="/manage-about">
                      <Button variant="outline" size="sm">
                        Go to Management Page
                      </Button>
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Mission Statement */}
          <Card className="card-elevated mt-12">
            <CardHeader>
              <CardTitle className="font-display text-center">
                Our Mission
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center max-w-3xl mx-auto">
              <p className="text-muted-foreground leading-relaxed">
                The Central Student Council is committed to fostering a vibrant
                and inclusive campus community. We strive to be the voice of every
                student, advocating for their rights, addressing their concerns,
                and creating opportunities for growth and development. Through
                transparency, integrity, and dedication, we work to enhance the
                overall student experience and build lasting connections within
                our academic institution.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
