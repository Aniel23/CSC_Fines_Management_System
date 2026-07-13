# Database Setup Guide

## Departments Table Setup

The departments table needs to be created in your Supabase database. Follow these steps:

### Method 1: Using Supabase Dashboard (Recommended)

1. **Go to Supabase Dashboard**
   - Navigate to https://khonhcrzchrqqbgmamjs.supabase.co
   - Go to **SQL Editor** from the sidebar

2. **Run the SQL Script**
   - Copy the contents of `database/create_departments_table.sql`
   - Paste it into the SQL Editor
   - Click **Run** to execute

3. **Verify Table Creation**
   - Go to **Table Editor** from the sidebar
   - You should see the `departments` table

### Method 2: Using Supabase CLI

If you have the Supabase CLI installed:

```bash
# Apply the migration
supabase db push
```

### What the Script Creates

The `departments` table includes:

- **id** - UUID primary key
- **name** - Department name (required)
- **description** - Department description (optional)
- **head_of_department** - Department head name (optional)
- **office_location** - Physical office location (optional)
- **contact_email** - Department contact email (optional)
- **created_at** - Creation timestamp
- **updated_at** - Last update timestamp

### Security Features

- **Row Level Security (RLS)** enabled
- **Read access** for all authenticated users
- **Full access** for administrators only
- **Automatic timestamps** with triggers

### After Setup

Once the table is created:

1. **Restart your application**
2. **Login as administrator**
3. **Navigate to Departments** (`/departments`)
4. **Start adding departments**

### Troubleshooting

If you encounter issues:

1. **Check table exists**: Run `SELECT * FROM departments LIMIT 1;`
2. **Check permissions**: Ensure RLS policies are created
3. **Refresh schema**: Sometimes Supabase needs a moment to update

### Sample Data (Optional)

You can add sample departments to test:

```sql
INSERT INTO public.departments (name, description, head_of_department, office_location, contact_email) VALUES
('Computer Science', 'Department of Computer Science and Information Technology', 'Dr. Juan Santos', 'Building A, Room 101', 'cs@university.edu'),
('Business Administration', 'Department of Business and Public Administration', 'Dr. Maria Reyes', 'Building B, Room 205', 'ba@university.edu'),
('Teacher Education', 'Department of Teacher Education', 'Dr. Jose Cruz', 'Building C, Room 150', 'ted@university.edu');
```

---

**Note**: Make sure you have the correct Supabase URL and keys in your `.env` file before proceeding.
