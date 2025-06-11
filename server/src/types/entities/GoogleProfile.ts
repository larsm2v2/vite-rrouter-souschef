// types/GoogleProfile.ts
export interface GoogleProfile {
  id: string;
  display_name: string;
  emails: { value: string; verified: boolean }[];
}
