import type { Course, Source } from "./types";

// Keep these lists in sync with config/sources.json. The scope picker and the
// history filter read courses from here; sources are replaced by /api/sources
// once the backend responds.
export const COURSES: Course[] = [
  { id: "OS-101", name: "Operating Systems Fundamentals" },
  { id: "SE-200", name: "Software Engineering Practice" },
  { id: "WEB-110", name: "Web Development Basics" },
  { id: "WEB-210", name: "Intermediate Web Development" },
];

export const FALLBACK_SOURCES: Source[] = [
  { id: "os-concepts", title: "Operating Systems Concepts", course_ids: ["OS-101"] },
  { id: "computer-hardware", title: "Computer Hardware Basics", course_ids: ["OS-101"] },
  { id: "web-development", title: "Introduction to Web Development", course_ids: ["WEB-110", "WEB-210"] },
  { id: "professional-practice", title: "Professional Software Practice", course_ids: ["SE-200"] },
];
