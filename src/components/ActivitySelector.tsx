import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, ChevronDown } from 'lucide-react';
import type { ActivityType } from '@/types/api';
import { 
  SKILL_ACTIVITY_TYPES, 
  BOSS_ACTIVITY_TYPES, 
  ACTIVITY_ACTIVITY_TYPES 
} from '@/types/api';
import { formatActivityTypeName } from '@/lib/dataUtils';

interface ActivitySelectorProps {
  selectedActivity: ActivityType;
  onActivityChange: (activity: ActivityType) => void;
}

interface ActivityCategory {
  name: string;
  activities: ActivityType[];
}

const ACTIVITY_CATEGORIES: ActivityCategory[] = [
  { name: 'Skills', activities: SKILL_ACTIVITY_TYPES },
  { name: 'Bosses', activities: BOSS_ACTIVITY_TYPES },
  { name: 'Activities', activities: ACTIVITY_ACTIVITY_TYPES }
];

export function ActivitySelector({ selectedActivity, onActivityChange }: ActivitySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredCategories = ACTIVITY_CATEGORIES.map(category => ({
    ...category,
    activities: category.activities.filter(activity =>
      formatActivityTypeName(activity).toLowerCase().includes(searchTerm.toLowerCase())
    )
  })).filter(category => category.activities.length > 0);

  return (
    <div className="relative">
      <Button
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full justify-between h-9 px-2 sm:px-3"
      >
        <div className="flex items-center gap-1 min-w-0">
          <Search className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
          <span className="truncate text-xs sm:text-sm">
            {formatActivityTypeName(selectedActivity)}
          </span>
        </div>
        <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
      </Button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-background border border-border rounded-lg shadow-lg max-h-[60vh] sm:max-h-96 overflow-hidden">
            <div className="p-3 border-b">
              <Input
                placeholder="Search activities..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            
            <div className="max-h-64 overflow-y-auto">
              {filteredCategories.map((category) => (
                <div key={category.name}>
                  <div className="px-3 py-2 text-xs font-medium text-muted-foreground bg-muted/50">
                    {category.name}
                  </div>
                  <div className="p-1">
                    {category.activities.map((activity) => (
                      <Button
                        key={activity}
                        variant={selectedActivity === activity ? "default" : "ghost"}
                        size="sm"
                        onClick={() => {
                          onActivityChange(activity);
                          setIsOpen(false);
                        }}
                        className="w-full justify-start text-sm mb-1"
                      >
                        {formatActivityTypeName(activity)}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}