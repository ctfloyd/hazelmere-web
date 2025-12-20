import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { User as UserIcon, ChevronDown } from 'lucide-react';
import { useAllUsers } from '@/hooks/useApi';
import { Skeleton } from '@/components/ui/skeleton';

interface UserSelectorProps {
  userId: string | null;
  onUserIdChange: (userId: string | null) => void;
}

function getAccountTypeIcon(accountType: string): string {
  switch (accountType) {
    case 'NORMAL': return '👤';
    case 'IRONMAN': return '⚔️';
    case 'HARDCORE_IRONMAN': return '💀';
    case 'ULTIMATE_IRONMAN': return '🔥';
    case 'GROUP_IRONMAN': return '👥';
    default: return '';
  }
}

export function UserSelector({ userId, onUserIdChange }: UserSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const { data: users, loading, error } = useAllUsers();
  
  const enabledUsers = Array.isArray(users) ? users.filter(user => user.trackingStatus === 'ENABLED') : [];
  const filteredUsers = enabledUsers.filter(user =>
    user.runescapeName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedUser = Array.isArray(users) ? users.find(user => user.id === userId) : undefined;

  useEffect(() => {
    // Auto-select first user if none selected and users are loaded
    if (!userId && enabledUsers.length > 0) {
      onUserIdChange(enabledUsers[0].id);
    }
  }, [users, userId]);

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserIcon className="h-5 w-5" />
          Select Player
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
        ) : error ? (
          <div className="text-red-600 dark:text-red-400">
            Failed to load users. Please check your connection.
          </div>
        ) : (
          <div className="relative">
            <Button
              variant="outline"
              onClick={() => setIsOpen(!isOpen)}
              className="w-full justify-between"
            >
              <div className="flex items-center gap-2">
                {selectedUser ? (
                  <>
                    <span>{getAccountTypeIcon(selectedUser.accountType)}</span>
                    <span>{selectedUser.runescapeName}</span>
                  </>
                ) : (
                  <span className="text-muted-foreground">Select a player...</span>
                )}
              </div>
              <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </Button>

            {isOpen && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-background border border-border rounded-lg shadow-lg max-h-96 overflow-hidden">
                <div className="p-3 border-b">
                  <Input
                    placeholder="Search players..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full"
                    autoFocus
                  />
                </div>

                <div className="max-h-64 overflow-y-auto">
                  {filteredUsers.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground">
                      {searchTerm ? 'No players found' : 'No players available'}
                    </div>
                  ) : (
                    <div className="p-1">
                      {filteredUsers.map((user) => (
                        <Button
                          key={user.id}
                          variant={userId === user.id ? "default" : "ghost"}
                          size="sm"
                          onClick={() => {
                            onUserIdChange(user.id);
                            setIsOpen(false);
                            setSearchTerm('');
                          }}
                          className="w-full justify-start text-sm mb-1"
                        >
                          <span className="mr-2">{getAccountTypeIcon(user.accountType)}</span>
                          <span className="flex-1 text-left">{user.runescapeName}</span>
                          {user.accountType !== 'NORMAL' && (
                            <span className="text-xs text-muted-foreground ml-2">
                              {user.accountType.replace(/_/g, ' ').toLowerCase()}
                            </span>
                          )}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>

                {enabledUsers.length > 0 && (
                  <div className="p-3 border-t bg-muted/50">
                    <p className="text-xs text-muted-foreground">
                      {enabledUsers.length} player{enabledUsers.length !== 1 ? 's' : ''} available
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="mt-4 text-xs text-muted-foreground">
          <p><strong>Note:</strong> Only players with tracking enabled are shown.</p>
          {selectedUser && (
            <p className="mt-1">Selected: <strong>{selectedUser.runescapeName}</strong> (ID: {selectedUser.id.substring(0, 8)}...)</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}