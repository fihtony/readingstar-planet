import Link from "next/link";

export default function ReadNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="text-6xl">📚</div>
      <h1 className="text-2xl font-bold text-gray-800">Book Not Available</h1>
      <p className="max-w-sm text-gray-500">
        This book could not be found, or you don&apos;t have permission to read
        it. Please check the link or contact your administrator for access.
      </p>
      <Link
        href="/library"
        className="mt-2 rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-sky-600"
      >
        Back to Library
      </Link>
    </div>
  );
}
