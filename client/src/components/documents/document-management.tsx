import { DocumentUpload } from "./document-upload";
import { DocumentList } from "./document-list";

export function DocumentManagement() {
  return (
    <div className="py-6">
      <div className="mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Gestione documenti</h1>
          <p className="mt-1 text-sm text-gray-500">
            Carica e gestisci buste paga e CUD per i dipendenti.
          </p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <DocumentUpload />
          </div>
          <div className="lg:col-span-2">
            <DocumentList />
          </div>
        </div>
      </div>
    </div>
  );
}