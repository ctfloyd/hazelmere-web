import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { TrendingUp } from 'lucide-react';

const navigation = [
  { name: 'Gains Tracker', href: '/', icon: TrendingUp },
];

export function Sidebar() {
  return (
    <div className="flex flex-col w-64 bg-card border-r">
      <div className="flex items-center px-6 py-4 border-b">
        <h1 className="text-xl font-bold">Hazelmere</h1>
      </div>
      
      <nav className="flex-1 px-4 py-4 space-y-2">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            className={({ isActive }) =>
              cn(
                'flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              )
            }
          >
            <item.icon className="mr-3 h-4 w-4" />
            {item.name}
          </NavLink>
        ))}
      </nav>
      
      <div className="p-4 border-t">
        <div className="text-xs text-muted-foreground">
          <p>RuneScape Hiscore Tracker</p>
          <p>Built with React & TypeScript</p>
        </div>
      </div>
    </div>
  );
}