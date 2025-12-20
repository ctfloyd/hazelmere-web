import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { type ApiError } from '@/lib/api';

interface ErrorAlertProps {
  error: ApiError | Error;
  onRetry?: () => void;
  title?: string;
}

export function ErrorAlert({ error, onRetry, title = "Something went wrong" }: ErrorAlertProps) {
  const isApiError = (err: any): err is ApiError => {
    return err && typeof err === 'object' && 'status' in err;
  };

  const getErrorMessage = (err: ApiError | Error): string => {
    if (isApiError(err)) {
      switch (err.status) {
        case 404:
          return 'The requested data was not found. This might be because no snapshots exist for this user yet.';
        case 500:
          return 'The server encountered an error. Please try again later.';
        case 503:
          return 'The service is temporarily unavailable. Please try again later.';
        default:
          return err.message;
      }
    }
    return err.message || 'An unexpected error occurred';
  };

  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle className="flex items-center justify-between">
        <span>{title}</span>
        {onRetry && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onRetry}
            className="ml-2"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry
          </Button>
        )}
      </AlertTitle>
      <AlertDescription className="mt-2">
        {getErrorMessage(error)}
      </AlertDescription>
    </Alert>
  );
}