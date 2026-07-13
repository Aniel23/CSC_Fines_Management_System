# Supabase Configuration & Setup Guide

## Database Connection

The application is now configured to use Supabase with the following project:
- **Project ID**: `ugycsiauylmnxonxbtwt`
- **URL**: `https://ugycsiauylmnxonxbtwt.supabase.co`

### Environment Variables

The following environment variables are already configured in `.env`:

```
VITE_SUPABASE_PROJECT_ID=ugycsiauylmnxonxbtwt
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_SUPABASE_URL=https://ugycsiauylmnxonxbtwt.supabase.co
```

## Database Schema

### Tables Created by Migration

1. **students** - Stores student information
   - Fields: id, student_id, name, age, address, gender, department, created_at, updated_at
   - Department enum: BSIS, BPA, BTVTED

2. **fines** - Stores fine records
   - Fields: id, student_id, fine_type, amount, balance, status, notes, created_at, updated_at
   - Status enum: Paid, Pending

3. **csc_officers** - Stores CSC officer information
   - Fields: id, name, position, photo_url, description, display_order, created_at

4. **user_roles** - Maps auth users to roles and students
   - Fields: id, user_id, role, student_id
   - Role enum: admin, student

5. **transactions** - Tracks fine payments
   - Fields: id, fine_id, amount_paid, payment_date, recorded_by, notes

## Authentication

### Admin Login
- Sign in with email and password
- Assigned role: "admin"
- Full access to all student and fine records

### Student Login
- Sign in with student ID and password
- System looks up student by student_id
- Can view own fine records

### Implementation

The `AuthContext` in `src/contexts/AuthContext.tsx` handles:
- Session management
- User role loading
- Authentication state persistence
- Logout functionality

## Running Migrations

To apply the database migration to Supabase:

### Option 1: Using Supabase CLI
```bash
supabase db push
```

### Option 2: Manual SQL Execution
1. Open the Supabase dashboard
2. Navigate to the SQL editor
3. Copy the contents of `supabase/migrations/20260129100307_c0bd3f16-03f6-4ff3-832e-4c5814bfea3f.sql`
4. Execute the SQL

## Database Helper Functions

The following helper functions are available in `src/integrations/supabase/queries.ts`:

### Student Operations
- `getStudents()` - Fetch all students
- `getStudentById(id)` - Fetch a specific student
- `getStudentByStudentId(studentId)` - Fetch by student ID string
- `createStudent(data)` - Create a new student
- `updateStudent(id, updates)` - Update student information
- `deleteStudent(id)` - Delete a student

### Fine Operations
- `getFines()` - Fetch all fines
- `getFinesByStudentId(studentId)` - Get fines for a specific student
- `createFine(data)` - Create a new fine record
- `updateFine(id, updates)` - Update a fine record
- `deleteFine(id)` - Delete a fine record

### Transaction Operations
- `getTransactions()` - Fetch all payment transactions
- `createTransaction(data)` - Record a payment

### CSC Officer Operations
- `getCSCOfficers()` - Fetch all officers
- `createCSCOfficer(data)` - Add a new officer
- `updateCSCOfficer(id, updates)` - Update officer info
- `deleteCSCOfficer(id)` - Remove an officer

### User Role Operations
- `getUserRole(userId)` - Get user's role and student link
- `createUserRole(data)` - Assign a role to a user
- `updateUserRole(id, updates)` - Update user role

## Usage Examples

### Fetching Students
```typescript
import { getStudents } from "@/integrations/supabase/queries";

const students = await getStudents();
```

### Creating a Fine
```typescript
import { createFine } from "@/integrations/supabase/queries";

const fine = await createFine({
  student_id: "uuid-of-student",
  fine_type: "Not wearing ID",
  amount: 50,
  balance: 50,
  status: "Pending"
});
```

### Recording a Payment
```typescript
import { createTransaction, updateFine } from "@/integrations/supabase/queries";

const transaction = await createTransaction({
  fine_id: "uuid-of-fine",
  amount_paid: 25
});

// Update the fine balance
await updateFine(fineId, { balance: 25 });
```

## Row Level Security (RLS) Policies

The following RLS policies are implemented:

### Students Table
- ✅ Admins can view all students
- ✅ Admins can create, update, delete students
- ✅ Students can view their own record only

### Fines Table
- ✅ Admins can view and manage all fines
- ✅ Students can view their own fines only

### Transactions Table
- ✅ Admins can view and record all transactions

### CSC Officers Table
- ✅ Anyone can view officers
- ✅ Only admins can create, update, delete officers

## Important Notes

1. **Authentication Email**: For student login, the system uses `{student_id}@student.local` as the email pattern for database lookups
2. **Admin Access**: Only users with the "admin" role can modify student and fine records
3. **Session Persistence**: User sessions are automatically persisted in localStorage
4. **Auto Refresh**: Auth tokens are automatically refreshed for long-lived sessions

## Testing the Setup

1. Access the Supabase dashboard at: `https://supabase.com`
2. Navigate to your project: `ugycsiauylmnxonxbtwt`
3. Check the SQL editor to verify migration status
4. Review the Tables section to confirm all tables exist
5. Set up test users in the Auth tab

## Next Steps

1. ✅ Run the database migration
2. ✅ Create test users in Supabase Auth
3. ✅ Populate initial CSC officers data
4. ✅ Test admin login
5. ✅ Test student login
6. ✅ Verify RLS policies are working

## Quick Setup Script

You can generate a `.env` file locally using the provided PowerShell helper:

```powershell
# From project root
.\scripts\set-supabase.ps1
```

This will prompt for `VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_PUBLISHABLE_KEY` and write a `.env` file.

## npm helper

If you have the Supabase CLI available (or `npx` permitted), you can run the migration with:

```bash
npm run supabase:push
```


## Troubleshooting

### Migration Failures
- Ensure you're connected to the correct Supabase project
- Check for syntax errors in the SQL migration
- Verify no table names conflict with existing tables

### Authentication Issues
- Verify environment variables are set correctly
- Check that VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are valid
- Ensure users exist in the Supabase Auth section

### Permission Errors
- Verify user roles are properly assigned in the user_roles table
- Check RLS policy status in the Supabase dashboard
- Ensure the user_id exists in auth.users table

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Supabase Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase Database](https://supabase.com/docs/guides/database)
