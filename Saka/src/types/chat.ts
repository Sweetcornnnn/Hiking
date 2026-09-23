// types/chat.ts

export type Profile = {
  id: string;
  full_name: string | null;
  username: string | null;
  email: string | null;
  avatar_url: string | null;
  bio: string | null;
  status: 'online' | 'offline' | 'away';
  last_seen: string;
  updated_at: string;
  created_at: string;
};

export type ChatMessage = {
  id: number;
  user_id: string;
  content: string;
  type: 'text' | 'image' | 'file';
  media_url: string | null;
  created_at: string;
  updated_at: string;
  profiles?: {
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
};

export type PrivateMessage = {
  id: number;
  sender_id: string;
  recipient_id: string;
  content: string;
  type: 'text' | 'image' | 'file';
  media_url: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Group = {
  id: number;
  name: string;
  description: string | null;
  creator_id: string;
  avatar_url: string | null;
  is_private: boolean;
  created_at: string;
  updated_at: string;
};

export type GroupMember = {
  id: number;
  group_id: number;
  user_id: string;
  role: 'admin' | 'moderator' | 'member';
  joined_at: string;
};

export type GroupMessage = {
  id: number;
  group_id: number;
  sender_id: string;
  content: string;
  type: 'text' | 'image' | 'file';
  media_url: string | null;
  created_at: string;
  updated_at: string;
};

export type Conversation = {
  id: number;
  participant1_id: string;
  participant2_id: string;
  last_message_id: number | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
};