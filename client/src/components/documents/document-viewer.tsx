import { DocumentList } from "./document-list";

export function DocumentViewer() {
  return (
    <div className="py-6">
      <div className="mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">I miei documenti</h1>
          <p className="mt-1 text-sm text-gray-500">
            Visualizza e scarica le tue buste paga e documenti fiscali.
          </p>
        </div>
        
        <DocumentList />
      </div>
    </div>
  );
}