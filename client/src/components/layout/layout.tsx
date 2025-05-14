import { PropsWithChildren, useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { NotificationBar } from "@/components/layout/notification-bar";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useInView } from "react-intersection-observer";
import { useAuth } from "@/hooks/use-auth";

export function Layout({ children }: PropsWithChildren) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [location] = useLocation();
  const [scrolled, setScrolled] = useState(false);
  
  // Hook per rilevare se l'utente ha fatto scroll
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
  
  // Close mobile menu on location change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  // Animazione per il contenitore principale
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.3 } }
  };

  return (
    <motion.div 
      className="min-h-screen flex flex-col md:flex-row bg-gray-50"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      <Sidebar mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} />
      
      <div className={cn(
        "flex-1 overflow-x-hidden transition-all duration-300",
        mobileMenuOpen && "hidden md:block"
      )}>
        <div className={cn(
          "sticky top-0 z-30 transition-all duration-300",
          scrolled && "shadow-md"
        )}>
          <NotificationBar />
        </div>
        
        <AnimatePresence mode="wait">
          <motion.div
            key={location}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.3 }}
            className="p-4 md:p-6 pb-20"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
