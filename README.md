# Student Fines Hub

A comprehensive student fines management system built with React, TypeScript, and Supabase. Admins can manage student records, fines, and payment approvals while students can view their fines and submit payments.

## Project Structure

```
student-fines-hub/
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   └── AppLayout.tsx
│   │   │   └── PublicNavbar.tsx
│   │   ├── payment/
│   │   │   └── PaymentGateway.tsx
│   │   └── ui/
│   │       ├── button.tsx
│   │       ├── input.tsx
│   │       ├── table.tsx
│   │       ├── dialog.tsx
│   │       └── ... (other UI components)
│   ├── contexts/
│   │   └── AuthContext.tsx
│   ├── hooks/
│   │   ├── useStudents.ts
│   │   ├── useFines.ts
│   │   ├── useAppSettings.ts
│   │   └── ...
│   ├── integrations/
│   │   └── supabase/
│   │       ├── client.ts
│   │       ├── queries.ts
│   │       └── types.ts
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── RegisterPage.tsx
│   │   ├── StudentDashboardPage.tsx
│   │   ├── AdminFinesPage.tsx
│   │   ├── StudentsPage.tsx
│   │   ├── ProfilePage.tsx
│   │   └── ... (other pages)
│   ├── lib/
│   │   ├── constants.ts
│   │   ├── utils.ts
│   │   └── seed-data.ts
│   ├── types/
│   │   └── index.ts
│   ├── App.tsx
│   └── main.tsx
├── supabase/
│   ├── config.toml
│   ├── functions/
│   ├── migrations/
│   │   ├── 20260129100307_*.sql (Initial schema)
│   │   ├── 20260311000003_add_admin_student_policies.sql
│   │   ├── 20260311000004_fix_ambiguous_user_id_aggressive.sql
│   │   └── 20260311000005_delete_student_with_auth.sql
│   └── ...
├── public/
│   ├── api/
│   ├── robots.txt
│   └── _redirects
├── package.json
├── vite.config.ts
├── tsconfig.json
└── tailwind.config.ts
```

## Technology Stack

- **Frontend Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **UI Component Library**: shadcn/ui
- **Styling**: Tailwind CSS
- **Backend**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Payment Gateway**: PayMongo
- **Form Validation**: React Hook Form + Zod

## Setup Instructions

### Prerequisites
- Node.js (v16+)
- npm or yarn
- Git account configured

### Installation

```bash
# Clone the repository
git clone <YOUR_GIT_URL>
cd student-fines-hub

# Install dependencies
npm install

# Start development server
npm run dev
```

The application will run on `http://localhost:8080` (or another available port).

### Environment Variables

Create a `.env` file in the root directory with:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_ADMIN_EMAIL=admin@example.com
```

## Key Features

### Admin Features
- ✅ Manage student records (create, read, update, delete)
- ✅ Create and manage student fines
- ✅ Approve/reject student payments
- ✅ View all student transactions
- ✅ Generate reports
- ✅ Manage Payment QR code

### Student Features
- ✅ View personal fines
- ✅ Submit payment proofs
- ✅ Track payment history
- ✅ Update profile information
- ✅ View CSC officer information

## Recent Changes (March 11, 2026)

### Bug Fixes & RLS Policy Updates

#### 1. **Fixed Ambiguous `user_id` Error in RLS Policies** 
   - **File**: `supabase/migrations/20260311000003_add_admin_student_policies.sql`
   - **Issue**: DELETE operations on students table were returning 400 errors due to ambiguous column reference
   - **Fix**: Fully qualified all table references in the `has_role()` function and SELECT policies
   - **Deploy**: Applied migration 20260311000004 with CASCADE drop of dependent policies

#### 2. **Removed Seed Data Function from UI**
   - **Files**: `src/pages/StudentsPage.tsx`
   - **Changes**: 
     - Removed `handleSeedData()` function
     - Removed "Seed Database" button from the interface
     - Removed unused imports (`SEED_STUDENTS`, `RefreshCw`)
   - **Reason**: Prevent accidental data corruption

#### 3. **Fixed Password Field Eye Icon Alignment**
   - **Files**: 
     - `src/pages/LoginPage.tsx`
     - `src/pages/RegisterPage.tsx`
   - **Changes**: Changed eye icon positioning from `top-[18px]` to `top-1/2 -translate-y-1/2` for proper vertical centering
   - **Affected Elements**: 
     - Login password field
     - Register password field
     - Register confirm password field

#### 4. **Fixed Student ID Validation on Registration**
   - **File**: `src/pages/RegisterPage.tsx`
   - **Issue**: Already registered students were being allowed to proceed with "new student" flow
   - **Changes**:
     - Changed from `.ilike()` to `.eq()` for exact student ID matching
     - Changed from `.maybeSingle()` to array check for more comprehensive validation
     - Retrieved full user_roles details instead of just ID
     - Enhanced error handling and user feedback
   - **Result**: Proper detection of existing registrations

#### 5. **Added Delete Button to Admin Fines Table**
   - **File**: `src/pages/AdminFinesPage.tsx`
   - **Added Features**:
     - Delete button in desktop table view
     - Delete button in mobile card view
     - Confirmation dialog with fine details
     - Toast notifications for success/error
     - Loading state during deletion
   - **Imports Added**: `Trash2` icon, `toast` from sonner, `deleteFine` function

#### 6. **Removed Admin Email Editing from Profile**
   - **File**: `src/pages/ProfilePage.tsx`
   - **Changes**:
     - Removed `adminEmailLocal` state
     - Removed `useEffect` that initialized admin email
     - Removed `handleSaveAdminEmail()` function
     - Removed email input UI and save button
     - Updated card description to only mention Payment QR management
   - **Reason**: Admin email now managed through environment variables only

#### 7. **Fixed Student Deletion to Include Auth Account Removal**
   - **Files**:
     - `supabase/migrations/20260311000005_delete_student_with_auth.sql` (NEW)
     - `src/integrations/supabase/queries.ts`
     - `src/pages/StudentsPage.tsx`
   - **Issue**: Deleting a student left their authentication account intact, allowing continued login
   - **Fix**: Created RPC function `delete_student_with_auth()` that:
     - Finds associated auth user_id from user_roles
     - Deletes user_roles records
     - **Deletes auth.users record** (prevents login)
     - Deletes student record
   - **Implementation**: Updated `deleteStudent()` to use RPC function instead of direct database deletion

## Available Scripts

```bash
# Development
npm run dev          # Start development server with HMR

# Build & Deploy
npm run build        # Build for production
npm run preview      # Preview production build

# Code Quality
npm run lint         # Run ESLint
npm run test         # Run tests with Vitest

# Database
npm run supabase:push  # Push migrations to Supabase
```

## Database Migrations

All database changes are managed through Supabase migrations in `/supabase/migrations/`:

```bash
# Push migrations to remote Supabase
npx supabase db push

# Pull changes from remote database
npx supabase db pull

# Repair migration history if needed
npx supabase migration repair --status reverted <migration_id>
```

## API Endpoints

### Supabase Functions
- `public.has_role(_user_id: UUID, _role: app_role)` - Check user role
- `public.register_new_student(...)` - Register new student
- `public.delete_student_with_auth(...)` - Delete student with auth removal

### Database Tables
- `students` - Student records
- `fines` - Fine records
- `user_roles` - User-role associations
- `transactions` - Payment transactions
- `csc_officers` - CSC officer profiles

## How to Deploy

### Build for Production
```bash
npm run build
```

### Deploy Options
1. **Vercel** (Recommended)
   - Connect GitHub repository
   - Select `npm run build` as build command
   - Set output directory to `dist`

2. **Netlify**
   - Connect GitHub repository
   - Build command: `npm run build`
   - Publish directory: `dist`

3. **GitHub Pages**
   ```bash
   npm run build
   # Upload dist/ folder contents
   ```

## Troubleshooting

### Common Issues

**Port 8080 Already in Use**
```bash
npm run dev  # Vite will automatically find an available port
```

**Database Connection Issues**
- Verify Supabase credentials in `.env`
- Check RLS policies are enabled
- Ensure migrations have been applied

**RLS Policy Errors**
- Check fully qualified table references in policies
- Verify user has appropriate role in `user_roles` table
- Use `auth.uid()` consistently in policies

## Contributing

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Commit changes: `git commit -m "Add your feature"`
3. Push to branch: `git push origin feature/your-feature`
4. Create Pull Request

## Additional Documentation

- [Supabase Setup Guide](./SUPABASE_SETUP.md)
- [Database Schema](./DATABASE_SETUP.md)
- [PayMongo Integration](./PAYMONGO_SETUP.md)
- [Production Setup](./PRODUCTION_SETUP.md)
- [Domain Verification](./docs/DOMAIN_VERIFICATION.md)

## Support

For issues or questions:
1. Check existing GitHub issues
2. Review documentation files
3. Contact development team

---

Last Updated: March 11, 2026
