import { useApiHealth } from '@/hooks/useApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ApiStatus() {
  const { isHealthy, checking, checkHealth } = useApiHealth();

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {checking ? (
            <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
          ) : isHealthy ? (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-600" />
          )}
          API Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <p className="text-sm">
            <strong>Endpoint:</strong> <code>https://api.hazelmere.xyz</code>
          </p>
          
          {!isHealthy && !checking && (
            <div className="space-y-3">
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                  API Not Available
                </h4>
                <p className="text-xs text-yellow-700 dark:text-yellow-300">
                  The Hazelmere API is not responding. To test this application with real data, you'll need:
                </p>
                <ul className="text-xs text-yellow-700 dark:text-yellow-300 mt-2 space-y-1 list-disc list-inside">
                  <li>A running instance of the Hazelmere API</li>
                  <li>Some user snapshots created via the API</li>
                  <li>Valid user IDs (UUIDs) to query</li>
                </ul>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={checkHealth}
                >
                  Retry Connection
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  asChild
                >
                  <a 
                    href="https://github.com/ctfloyd/hazelmere-api" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1"
                  >
                    API Docs
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              </div>
            </div>
          )}
          
          {isHealthy && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
              <p className="text-xs text-green-700 dark:text-green-300">
                ✅ API is responding. You can now enter user IDs to view their hiscore data!
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}