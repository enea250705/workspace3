import { useLocation } from 'wouter';
import { cn } from '@/lib/utils';

interface MobileNavProps {
  isMobileMenuOpen: boolean;
  toggleMobileMenu: () => void;
}

export function MobileNav({ isMobileMenuOpen, toggleMobileMenu }: MobileNavProps) {
  const [location] = useLocation();

  return (
    <div className="md:hidden">
      <button
        onClick={toggleMobileMenu}
        className="p-2 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/70"
        aria-label={isMobileMenuOpen ? "Chiudi menu" : "Apri menu"}
      >
        <div className="w-6 h-6 flex flex-col justify-center items-center">
          <span
            className={cn(
              "w-6 h-0.5 bg-gray-600 block mb-1.5 rounded-full transition-all duration-100",
              isMobileMenuOpen && "transform rotate-45 translate-y-2"
            )}
          />
          <span
            className={cn(
              "w-6 h-0.5 bg-gray-600 block mb-1.5 rounded-full transition-opacity",
              isMobileMenuOpen && "opacity-0"
            )}
          />
          <span
            className={cn(
              "w-6 h-0.5 bg-gray-600 block rounded-full transition-all duration-100",
              isMobileMenuOpen && "transform -rotate-45 -translate-y-2"
            )}
          />
        </div>
      </button>
    </div>
  );
}