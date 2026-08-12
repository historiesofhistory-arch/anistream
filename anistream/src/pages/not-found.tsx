import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="flex flex-col h-[60vh] items-center justify-center space-y-4 text-center px-4">
      <div className="text-8xl font-display font-black text-primary/20">404</div>
      <h1 className="text-2xl font-display font-bold">Page not found</h1>
      <p className="text-muted-foreground">The page you're looking for doesn't exist.</p>
      <Link href="/" className="px-5 py-2 bg-primary text-white font-bold text-sm rounded-sm hover:bg-primary/90 transition-colors">
        Go Home
      </Link>
    </div>
  );
}
