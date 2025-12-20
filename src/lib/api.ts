import type {
  HiscoreSnapshot,
  GetAllSnapshotsForUserResponse,
  GetSnapshotNearestTimestampResponse,
  CreateSnapshotRequest,
  CreateSnapshotResponse,
  GetSnapshotIntervalRequest,
  GetSnapshotIntervalResponse,
  GetAllUsersResponse,
  User,
  AggregationWindow
} from '@/types/api';

// Always use the public API URL
const API_BASE_URL = 'https://api.hazelmere.xyz';

export interface ApiError {
  message: string;
  status: number;
  code?: string;
}

export class HazelmereApiClient {
  private baseUrl: string;
  // Track in-flight requests to deduplicate concurrent identical requests
  private inFlightRequests: Map<string, Promise<GetSnapshotIntervalResponse>> = new Map();

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  // Generate a cache key for interval requests
  private getIntervalCacheKey(
    userId: string,
    startTime: Date,
    endTime: Date,
    aggregationWindow?: AggregationWindow
  ): string {
    return `${userId}-${startTime.toISOString()}-${endTime.toISOString()}-${aggregationWindow || 'none'}`;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      let message = `HTTP ${response.status}: ${response.statusText}`;
      
      try {
        const errorJson = JSON.parse(errorBody);
        if (errorJson.message) {
          message = errorJson.message;
        }
      } catch {
        if (errorBody) {
          message = errorBody;
        }
      }

      const error: ApiError = {
        message,
        status: response.status,
      };
      throw error;
    }

    const text = await response.text();
    if (!text) {
      return {} as T;
    }
    
    try {
      return JSON.parse(text);
    } catch (e) {
      throw new Error('Invalid JSON response from server');
    }
  }

  async getAllSnapshotsForUser(userId: string): Promise<HiscoreSnapshot[]> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/snapshot/${userId}`, {
        headers: {
          'Accept': 'application/json',
        },
      });
      const data = await this.handleResponse<GetAllSnapshotsForUserResponse>(response);
      return data.snapshots || [];
    } catch (error) {
      console.error('Failed to fetch snapshots for user:', userId, error);
      throw error;
    }
  }

  async getSnapshotNearestTimestamp(
    userId: string, 
    timestamp: number
  ): Promise<HiscoreSnapshot> {
    try {
      const response = await fetch(
        `${this.baseUrl}/v1/snapshot/${userId}/nearest/${timestamp}`,
        {
          headers: {
            'Accept': 'application/json',
          },
        }
      );
      const data = await this.handleResponse<GetSnapshotNearestTimestampResponse>(response);
      return data.snapshot;
    } catch (error) {
      console.error('Failed to fetch snapshot nearest timestamp:', { userId, timestamp }, error);
      throw error;
    }
  }

  async createSnapshot(snapshot: HiscoreSnapshot): Promise<HiscoreSnapshot> {
    try {
      const request: CreateSnapshotRequest = { snapshot };
      const response = await fetch(`${this.baseUrl}/v1/snapshot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(request)
      });
      
      const data = await this.handleResponse<CreateSnapshotResponse>(response);
      return data.snapshot;
    } catch (error) {
      console.error('Failed to create snapshot:', error);
      throw error;
    }
  }

  async getSnapshotInterval(
    userId: string,
    startTime: Date,
    endTime: Date,
    aggregationWindow?: AggregationWindow
  ): Promise<GetSnapshotIntervalResponse> {
    const cacheKey = this.getIntervalCacheKey(userId, startTime, endTime, aggregationWindow);

    // Check if there's already an in-flight request for the same parameters
    const inFlight = this.inFlightRequests.get(cacheKey);
    if (inFlight) {
      return inFlight;
    }

    // Create the request promise
    const requestPromise = (async () => {
      try {
        const request: GetSnapshotIntervalRequest = {
          userId,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          ...(aggregationWindow && { aggregationWindow })
        };

        const response = await fetch(`${this.baseUrl}/v1/snapshot/interval`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(request)
        });

        const data = await this.handleResponse<GetSnapshotIntervalResponse>(response);
        return {
          snapshots: data.snapshots || [],
          totalSnapshots: data.totalSnapshots || 0,
          snapshotsWithGains: data.snapshotsWithGains || 0
        };
      } catch (error) {
        console.error('Failed to fetch snapshot interval:', { userId, startTime, endTime, aggregationWindow }, error);
        throw error;
      } finally {
        // Remove from in-flight requests when done (success or error)
        this.inFlightRequests.delete(cacheKey);
      }
    })();

    // Store the promise for deduplication
    this.inFlightRequests.set(cacheKey, requestPromise);

    return requestPromise;
  }

  async getAllUsers(): Promise<User[]> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/user`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      const data = await this.handleResponse<GetAllUsersResponse>(response);
      
      // Extract users array from response
      if (data && Array.isArray(data.users)) {
        return data.users;
      }
      
      return [];
    } catch (error) {
      console.error('Failed to fetch all users:', error);
      throw error;
    }
  }

  // Health check endpoint - try a simple endpoint to test API connectivity
  async healthCheck(): Promise<boolean> {
    try {
      // Try to make a simple request to test API connectivity
      // Since health endpoint might not exist, we'll try the base URL
      await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });
      // Accept any response that's not a network error
      return true;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }
}

export const apiClient = new HazelmereApiClient();