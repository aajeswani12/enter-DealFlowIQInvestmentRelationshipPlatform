import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-md text-center">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-brand-foreground">
          <span className="font-display text-xl leading-none">T</span>
        </span>
        <p className="mt-5 label-caps">Page not found</p>
        <h1 className="mt-2 font-display text-4xl tracking-tight">This page is not in the workspace</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Nothing is served at <code className="rounded bg-secondary px-1.5 py-0.5 text-[12px]">{location.pathname}</code>.
          Head back to the deal desk.
        </p>
        <Button asChild className="mt-5">
          <Link to="/">Return to dashboard</Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
