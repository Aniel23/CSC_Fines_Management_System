import { CSCOfficer, Student } from "@/types";

// Mock CSC officers for seeding
export const SEED_OFFICERS: CSCOfficer[] = [
  {
    id: "o1",
    name: "Alexandra Chen",
    position: "President",
    description: "Leading with vision and dedication to serve the student body.",
    photo_url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop",
    display_order: 1,
  },
  {
    id: "o2",
    name: "Marcus Rodriguez",
    position: "Vice President",
    description: "Committed to bridging the gap between students and administration.",
    photo_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop",
    display_order: 2,
  },
  {
    id: "o3",
    name: "Sarah Kim",
    position: "Secretary",
    description: "Ensuring efficient documentation and communication.",
    photo_url: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop",
    display_order: 3,
  },
  {
    id: "o4",
    name: "James Wilson",
    position: "Treasurer",
    description: "Managing student funds with transparency and integrity.",
    photo_url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop",
    display_order: 4,
  },
];

export const SEED_STUDENTS: Partial<Student>[] = [
  {
    student_id: "2024-00001",
    name: "Juan Dela Cruz",
    age: 20,
    gender: "Male",
    department: "BSIS",
    address: "123 Main St, Manila",
  },
  {
    student_id: "2024-00002",
    name: "Maria Santos",
    age: 19,
    gender: "Female",
    department: "BPA",
    address: "456 Oak Ave, Quezon City",
  },
  {
    student_id: "2024-00003",
    name: "Pedro Garcia",
    age: 21,
    gender: "Male",
    department: "BTVTED",
    address: "789 Pine Rd, Makati",
  },
  {
    student_id: "2024-00004",
    name: "Ana Reyes",
    age: 20,
    gender: "Female",
    department: "BSIS",
    address: "321 Elm St, Pasig",
  },
  {
    student_id: "2024-00005",
    name: "Carlo Mendoza",
    age: 22,
    gender: "Male",
    department: "BPA",
    address: "654 Maple Dr, Taguig",
  },
];
