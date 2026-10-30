import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="text-6xl">🌾</div>
      <h1 className="mt-4 text-3xl font-bold text-brand-800">Page not found</h1>
      <p className="mt-2 text-brand-600">The page you're looking for doesn't exist.</p>
      <Link to="/" className="btn-primary mt-6">Back to home</Link>
    </div>
  );
}
