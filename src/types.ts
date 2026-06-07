import { Timestamp } from 'firebase/firestore';

export interface Reply {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  authorPhotoUrl?: string;
  createdAt: number; // Storing as timestamp number in array
  likes?: string[];
}

export interface Message {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  authorPhotoUrl?: string;
  color: string;
  createdAt: Timestamp;
  likes?: string[];
  replies?: Reply[];
}

export const STICKY_COLORS = [
  'bg-yellow-200',
  'bg-pink-200',
  'bg-blue-200',
  'bg-green-200',
  'bg-purple-200',
];
