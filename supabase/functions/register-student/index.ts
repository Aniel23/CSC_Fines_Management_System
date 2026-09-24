import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { student_id, name, age, gender, department, department_id, address, email, password } = await req.json();

    if (!student_id || !name || !email || !password) {
      throw new Error("Missing required fields: student_id, name, email, password");
    }

    const normalizedStudentId = String(student_id).trim();
    const normalizedName = String(name).trim().replace(/\s+/g, " ");
    const normalizedDepartment = String(department || "").trim();
    const normalizedAddress = address ? String(address).trim().replace(/\s+/g, " ") : null;
    const normalizedEmail = String(email).trim().replace(/\s+/g, "").toLowerCase();

    // 1. Create the user in auth.users
    const { data: authData, error: authError } = await supabaseClient.auth.admin.createUser({
      email: normalizedEmail,
      password: password,
      email_confirm: true,
      user_metadata: { name: normalizedName, role: 'student', student_id: normalizedStudentId }
    });

    if (authError) {
      console.error("Error creating auth user:", authError);
      // Check if user already exists
      if (authError.code === "email_exists" || authError.message.toLowerCase().includes("already registered")) {
        throw new Error("This email address is already registered. Please use a different email or log in.");
      }
      throw authError;
    }

    const userId = authData.user.id;

    // 2. Call the database function to create/link the student profile
    // Note: age, gender, department should be passed correctly
    const { error: dbError } = await supabaseClient.rpc("register_new_student", {
      p_student_id: normalizedStudentId,
      p_name: normalizedName,
      p_age: Number(age),
      p_gender: gender,
      p_department: normalizedDepartment,
      p_user_id: userId,
      p_department_id: department_id || null,
      p_address: normalizedAddress,
      p_email: normalizedEmail
    });

    if (dbError) {
      console.error("Error linking student profile:", dbError);
      await supabaseClient.auth.admin.deleteUser(userId);
      throw dbError;
    }

    return new Response(
      JSON.stringify({ 
        message: "Student registered successfully", 
        user: authData.user 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unable to register student";
    console.error("Error in register-student function:", error);
    return new Response(
      JSON.stringify({ error: message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
