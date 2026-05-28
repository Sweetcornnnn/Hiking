import { create } from 'zustand';
import { resolveApiBaseUrl } from '../config/api';

export interface PasswordChangeRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  respondedAt?: string;
}

interface NotificationState {
  passwordChangeRequests: PasswordChangeRequest[];
  unreadCount: number;
  isLoading: boolean;

  // Actions
  fetchPasswordChangeRequests: (authToken: string) => Promise<void>;
  approvePasswordChange: (requestId: string, authToken: string) => Promise<{ error: string | null }>;
  rejectPasswordChange: (requestId: string, authToken: string) => Promise<{ error: string | null }>;
  markAsRead: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  passwordChangeRequests: [],
  unreadCount: 0,
  isLoading: false,

  fetchPasswordChangeRequests: async (authToken: string) => {
    set({ isLoading: true });
    try {
      const base = await resolveApiBaseUrl();
      console.log(`Fetching password change requests from ${base}/api/password-change-requests`);
      const response = await fetch(`${base}/api/password-change-requests`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
      });

      console.log('Response status:', response.status);
      const data = await response.json();
      console.log('Response data:', data);

      if (!response.ok) {
        console.error('Error fetching requests:', data.error);
        set({ isLoading: false });
        return;
      }

      const pendingCount = data.requests?.filter((r: PasswordChangeRequest) => r.status === 'pending').length || 0;
      set({
        passwordChangeRequests: data.requests || [],
        unreadCount: pendingCount,
        isLoading: false,
      });
    } catch (error: any) {
      console.log('Fetch error:', error.message);
      set({ isLoading: false });
    }
  },

  approvePasswordChange: async (requestId: string, authToken: string) => {
    try {
      const base = await resolveApiBaseUrl();
      console.log(`Approving password change request ${requestId}`);
      const response = await fetch(`${base}/api/password-change-requests/${requestId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
      });

      console.log('Response status:', response.status);
      const data = await response.json();
      console.log('Response data:', data);

      if (!response.ok) {
        return { error: data.error || 'Failed to approve request' };
      }

      // Update the local requests list
      const currentRequests = get().passwordChangeRequests;
      const updated = currentRequests.map(r =>
        r.id === requestId ? { ...r, status: 'approved' as const } : r
      );
      const pendingCount = updated.filter(r => r.status === 'pending').length;
      set({
        passwordChangeRequests: updated,
        unreadCount: pendingCount,
      });

      return { error: null };
    } catch (error: any) {
      console.log('Error:', error.message);
      return { error: error.message || 'Network error' };
    }
  },

  rejectPasswordChange: async (requestId: string, authToken: string) => {
    try {
      const base = await resolveApiBaseUrl();
      console.log(`Rejecting password change request ${requestId}`);
      const response = await fetch(`${base}/api/password-change-requests/${requestId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
      });

      console.log('Response status:', response.status);
      const data = await response.json();
      console.log('Response data:', data);

      if (!response.ok) {
        return { error: data.error || 'Failed to reject request' };
      }

      // Update the local requests list
      const currentRequests = get().passwordChangeRequests;
      const updated = currentRequests.map(r =>
        r.id === requestId ? { ...r, status: 'rejected' as const } : r
      );
      const pendingCount = updated.filter(r => r.status === 'pending').length;
      set({
        passwordChangeRequests: updated,
        unreadCount: pendingCount,
      });

      return { error: null };
    } catch (error: any) {
      console.log('Error:', error.message);
      return { error: error.message || 'Network error' };
    }
  },

  markAsRead: () => {
    set({ unreadCount: 0 });
  },
}));
