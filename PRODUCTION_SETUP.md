# Production Setup Guide

This guide will help you configure the CSC Fines Management System for production deployment.

## 🚀 **Environment Configuration**

### **1. Environment Variables**

Create a `.env.production` file with the following variables:

```bash
# Database Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Application Configuration
NEXT_PUBLIC_APP_URL=https://your-domain.com
NEXT_PUBLIC_APP_NAME=CSC Fines Management System

# Email Configuration (for password reset)
ADMIN_EMAIL=admin@your-domain.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@your-domain.com

# PayMongo Configuration
NEXT_PUBLIC_PAYMONGO_PUBLIC_KEY=pk_live_xxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_PAYMONGO_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_PAYMONGO_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxx

# Security
NEXTAUTH_SECRET=your-super-secret-jwt-key-here
NEXTAUTH_URL=https://your-domain.com/api/auth

# Node Environment
NODE_ENV=production
```

### **2. Supabase Production Setup**

#### **Database Schema**
Run these SQL commands in your Supabase SQL Editor:

```sql
-- Enable Row Level Security
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE fines ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Create Policies
CREATE POLICY "Users can view their own profile" ON students
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can manage all students" ON students
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Similar policies for other tables...
```

## 🌐 **Deployment Options**

### **Option 1: Vercel (Recommended)**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Environment Variables (set in Vercel dashboard)
# Add all variables from .env.production
```

### **Option 2: Docker**
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
```

### **Option 3: Traditional Server**
```bash
# Build
npm run build

# Run with PM2
pm2 start ecosystem.config.js

# Or with systemd
sudo systemctl start csc-fines
```

## 📧 **Build Configuration**

### **1. Package.json Scripts**
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "prod": "next build && next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit"
  }
}
```

### **2. Next.js Configuration**
Create `next.config.js`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    optimizeCss: true,
  },
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
  async headers() {
    return [
      {
        key: 'X-Frame-Options',
        value: 'DENY',
      },
      {
        key: 'X-Content-Type-Options',
        value: 'nosniff',
      },
      {
        key: 'Referrer-Policy',
        value: 'strict-origin-when-cross-origin',
      },
    ];
  },
};

module.exports = nextConfig;
```

## 🔐 **Security Checklist**

### **1. Authentication**
- ✅ JWT secrets configured
- ✅ Secure cookie settings
- ✅ HTTPS only in production
- ✅ Session management configured

### **2. Database Security**
- ✅ Row Level Security enabled
- ✅ Proper RLS policies
- ✅ Service role keys secured
- ✅ Connection pooling configured

### **3. API Security**
- ✅ Rate limiting implemented
- ✅ CORS configured
- ✅ Input validation
- ✅ SQL injection prevention
- ✅ XSS protection

## 📊 **Performance Optimization**

### **1. Next.js Optimizations**
```javascript
// Dynamic imports for better code splitting
const DynamicComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <div>Loading...</div>,
  ssr: false
});

// Image optimization
const Image = ({ src, alt, ...props }) => (
  <img
    src={src}
    alt={alt}
    loading="lazy"
    {...props}
  />
);
```

### **2. Database Optimization**
```sql
-- Add indexes for better query performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_students_email ON students(email);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_students_department ON students(department);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_students_student_id ON students(student_id);

-- Optimize queries
EXPLAIN ANALYZE SELECT * FROM students WHERE department = 'BSIS';
```

## 📱 **Mobile Optimization**

### **1. Responsive Design**
- ✅ Mobile-first CSS approach
- ✅ Touch-friendly interface
- ✅ Optimized images
- ✅ Fast loading times

### **2. PWA Configuration**
```json
// manifest.json
{
  "name": "CSC Fines Management",
  "short_name": "CSC Fines",
  "description": "Student fines management system",
  "start_url": ".",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#000000",
  "orientation": "portrait"
}
```

## 🔍 **Monitoring & Logging**

### **1. Error Tracking**
```javascript
// Global error handler
window.addEventListener('error', (event) => {
  console.error('Application Error:', event.error);
  // Send to monitoring service
  if (window.gtag) {
    window.gtag('event', 'exception', {
      error_message: event.error.message,
      fatal: false
    });
  }
});
```

### **2. Performance Monitoring**
```javascript
// Performance metrics
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    console.log('Performance Entry:', entry);
  }
});

observer.observe({ entryTypes: ['navigation', 'paint', 'network'] });
```

## 🚨 **Troubleshooting**

### **Common Issues & Solutions**

#### **Build Errors**
```bash
# Out of memory
NODE_OPTIONS="--max-old-space-size=4096"

# Increase memory limit
NODE_OPTIONS="--max-old-space-size=8192"
```

#### **Database Connection**
```bash
# Connection timeout
DATABASE_URL=postgresql://user:password@localhost:5432/cscfines?connect_timeout=60

# Connection pool
DATABASE_POOL_SIZE=20
```

#### **API Rate Limits**
```javascript
// Rate limiting middleware
const rateLimit = require('express-rate-limit');

app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests
  message: 'Too many requests from this IP'
}));
```

## 📋 **Pre-Deployment Checklist**

### **Before Going Live:**
- [ ] Test all user flows
- [ ] Verify email functionality
- [ ] Test payment processing
- [ ] Test department management
- [ ] Verify mobile responsiveness
- [ ] Check all form validations
- [ ] Test error handling
- [ ] Verify database connections
- [ ] Check environment variables
- [ ] Performance testing
- [ ] Security audit
- [ ] Backup strategy ready

### **Deployment Commands**
```bash
# Deploy to Vercel
vercel --prod --env=.env.production

# Deploy with Docker
docker build -t csc-fines:latest
docker run -d -p 3000:3000 csc-fines:latest

# Deploy to traditional server
npm run build
scp -r build/ user@server:/var/www/csc-fines/
```

## 🎯 **Post-Deployment**

### **1. Monitoring Setup**
- Set up Google Analytics
- Configure error reporting (Sentry)
- Set up uptime monitoring
- Monitor database performance
- Track user analytics

### **2. Backup Strategy**
```bash
# Database backup
pg_dump cscfines > backup_$(date +%Y%m%d).sql

# File backup
tar -czf backup_$(date +%Y%m%d).tar.gz src/

# Automated backups (cron)
0 2 * * * * /usr/bin/pg_dump cscfines > /backups/cscfines_$(date +\%Y\%m\%d).sql
```

### **3. Maintenance**
- Regular security updates
- Database optimization
- Performance monitoring
- User feedback collection
- Bug tracking and resolution

## 📞 **Support & Documentation**

### **For Issues:**
1. Check this guide
2. Review error logs
3. Monitor performance metrics
4. Check security configurations
5. Test in staging environment first

### **Documentation:**
- User manual for administrators
- API documentation for developers
- Deployment guide for IT team
- Troubleshooting guide for common issues

---

**🚀 Ready for Production!**

Follow this guide step by step to deploy your CSC Fines Management System to production.
