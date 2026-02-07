const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export interface ApiResponse<T> {
  success?: boolean;
  data?: T;
  error?: {
    message: string;
  };
}

export interface AuthResponse {
  success: boolean;
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    userType: string;
    profilePhotoUrl?: string;
    oauthProvider?: 'google' | 'apple';
  };
}

// Get auth token from localStorage
export function getAuthToken(): string | null {
  return localStorage.getItem('auth_token');
}

// Set auth token in localStorage
export function setAuthToken(token: string): void {
  localStorage.setItem('auth_token', token);
}

// Remove auth token from localStorage
export function removeAuthToken(): void {
  localStorage.removeItem('auth_token');
}

// API client with auth header
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API error response:', errorText);
      let error;
      try {
        error = JSON.parse(errorText);
      } catch {
        error = { error: { message: errorText || 'Network error or server unavailable' } };
      }
      throw new Error(error.error?.message || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('API request failed:', error);
    if (error.message) {
      throw error;
    }
    throw new Error('Network error: Could not connect to backend server. Make sure the backend is running.');
  }
}

// Axios-like API client for convenience
export const api = {
  async get<T = any>(endpoint: string): Promise<T> {
    return apiRequest<T>(endpoint, { method: 'GET' });
  },
  
  async post<T = any>(endpoint: string, data?: any): Promise<T> {
    return apiRequest<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  },
  
  async put<T = any>(endpoint: string, data?: any): Promise<T> {
    return apiRequest<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  },

  async patch<T = any>(endpoint: string, data?: any): Promise<T> {
    return apiRequest<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  },
  
  async delete<T = any>(endpoint: string): Promise<T> {
    return apiRequest<T>(endpoint, { method: 'DELETE' });
  },
};

// Auth API functions
export const authApi = {
  // Verify Google ID token
  async verifyGoogleToken(idToken: string): Promise<AuthResponse> {
    return apiRequest<AuthResponse>('/auth/google/verify-token', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    });
  },

  // Verify Apple ID token
  async verifyAppleToken(idToken: string): Promise<AuthResponse> {
    return apiRequest<AuthResponse>('/auth/apple/verify-token', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    });
  },

  // Email/password signup
  async signup(email: string, password: string, name: string, userType?: 'stylist' | 'client'): Promise<AuthResponse> {
    const body: any = { email, password, name };
    // Only include userType if explicitly provided (let backend determine otherwise)
    if (userType) {
      body.userType = userType;
    }
    return apiRequest<AuthResponse>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  // Email/password login
  async login(email: string, password: string): Promise<AuthResponse> {
    return apiRequest<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  // Health check
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return fetch(`${API_BASE_URL.replace('/api', '')}/health`).then((res) =>
      res.json()
    );
  },
};
